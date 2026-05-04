import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getUpstashRedis } from "@/lib/upstash-redis";

const PREFIX = "ronfax:cs-meta:";
const TTL_SEC = 60 * 60 * 24;

/** Mirrors Stripe session.metadata keys (all strings) for webhook fallback. */
export type CheckoutMetaStash = {
  blobPathname: string;
  fileUrl: string;
  faxNumber: string;
  faxTo: string;
  pageCount: string;
  priceCents: string;
  filename: string;
  contactName: string;
  contactEmail: string;
};

/**
 * Call immediately after `checkout.sessions.create` so webhooks that arrive with
 * empty `session.metadata` (CLI forwarding, API quirks) can still resolve fax fields.
 */
export async function stashCheckoutSessionMetadata(
  sessionId: string,
  data: CheckoutMetaStash,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return false;
  try {
    await r.set(`${PREFIX}${sessionId}`, JSON.stringify(data), { ex: TTL_SEC });
    return true;
  } catch (e) {
    console.error("[checkout-meta-stash] stash failed", e);
    return false;
  }
}

export async function getCheckoutSessionMetadataStash(
  sessionId: string,
): Promise<CheckoutMetaStash | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  try {
    const raw = await r.get<string>(`${PREFIX}${sessionId}`);
    if (!raw || typeof raw !== "string") return null;
    return JSON.parse(raw) as CheckoutMetaStash;
  } catch {
    return null;
  }
}

function metaObject(m: Stripe.Metadata | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const [k, v] of Object.entries(m)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

function stashToFlat(s: CheckoutMetaStash): Record<string, string> {
  return { ...s };
}

/**
 * Merge Stripe webhook payload, live `sessions.retrieve`, Redis stash, and
 * `client_reference_id` so fax fields exist even when `session.metadata` is empty.
 */
export async function resolveFaxCheckoutMetadata(
  session: Stripe.Checkout.Session,
): Promise<{
  merged: Record<string, string>;
  usedStash: boolean;
  usedRetrieve: boolean;
}> {
  const fromEvent = metaObject(session.metadata);
  let fromRetrieve: Record<string, string> = {};
  let usedRetrieve = false;
  const needsStripeRetrieve =
    Object.keys(fromEvent).length === 0 ||
    !fromEvent.blobPathname?.trim() ||
    !fromEvent.faxTo?.trim();
  if (needsStripeRetrieve) {
    try {
      const full = await getStripe().checkout.sessions.retrieve(session.id);
      fromRetrieve = metaObject(full.metadata);
      usedRetrieve = Object.keys(fromRetrieve).length > 0;
    } catch (e) {
      console.error("[resolveFaxCheckoutMetadata] sessions.retrieve failed", e);
    }
  }

  const stash = await getCheckoutSessionMetadataStash(session.id);
  const fromStash = stash ? stashToFlat(stash) : {};
  const usedStash = Boolean(stash);

  // Later keys win: event payload from Stripe is authoritative when present.
  const merged: Record<string, string> = {
    ...fromStash,
    ...fromRetrieve,
    ...fromEvent,
  };

  if (!merged.blobPathname && session.client_reference_id) {
    const cr = session.client_reference_id;
    const sep = "::";
    const idx = cr.indexOf(sep);
    if (idx > 0 && idx < cr.length - sep.length) {
      if (!merged.faxNumber) merged.faxNumber = cr.slice(0, idx);
      merged.blobPathname = cr.slice(idx + sep.length);
    }
  }

  return { merged, usedStash, usedRetrieve };
}

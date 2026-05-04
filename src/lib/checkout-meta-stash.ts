import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-server";

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

export async function stashCheckoutSessionMetadata(
  sessionId: string,
  data: CheckoutMetaStash,
): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return false;
  try {
    const { error } = await sup.from("checkout_session_meta").upsert(
      {
        session_id: sessionId,
        data: data as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );
    if (error) {
      console.error("[checkout-meta-stash] upsert failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[checkout-meta-stash] stash failed", e);
    return false;
  }
}

export async function getCheckoutSessionMetadataStash(
  sessionId: string,
): Promise<CheckoutMetaStash | null> {
  const sup = getSupabaseAdmin();
  if (!sup) return null;
  try {
    const { data, error } = await sup
      .from("checkout_session_meta")
      .select("data")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error || !data?.data) return null;
    return data.data as unknown as CheckoutMetaStash;
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

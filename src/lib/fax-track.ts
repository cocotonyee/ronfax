import { getRedisKey, TRACK_RECORD_TTL_SEC } from "@/lib/redis-keys";
import {
  getUpstashRedis,
  getUpstashRestUrlTailForDiagnostics,
} from "@/lib/upstash-redis";

/** True for Stripe Checkout session ids and dev ids like `cs_dev_*`. */
export function isCheckoutSessionId(id: string): boolean {
  return String(id).trim().startsWith("cs_");
}

/** Trim and validate — use at HTTP boundaries so Redis keys always match `ronfax:track:{cs_*}`. */
export function parseCheckoutSessionId(
  raw: string | undefined | null,
): string | null {
  const sid = String(raw ?? "").trim();
  return isCheckoutSessionId(sid) ? sid : null;
}

export type FaxTrackRecord = {
  stripeSessionId: string;
  /** Reply-matching code printed in fax header, e.g. RF-1234 */
  refCode?: string;
  contactEmail: string;
  contactName?: string;
  faxTo: string;
  pageCount: number;
  amountCents: number;
  /** Sinch: ULID string; legacy Phaxio: number */
  faxId: string | number | null;
  /** processing | submitted | success | failure | sent */
  deliveryStatus: string;
  phaxioLastStatus?: string;
  errorMessage?: string;
  /** `checkout.session.completed` — payment is valid */
  paymentVerified?: boolean;
  /** Row present and pipeline-linked (legacy flag; always true when keyed by session) */
  linked?: boolean;
  /** Denormalized for Redis viewers; status API also derives progress from delivery + Sinch state */
  progressPercent?: number;
  /** Public Vercel Blob URL for the uploaded outbound PDF — cleared after terminal delivery + cleanup */
  pdfUrl?: string | null;
  updatedAt: number;
};

/**
 * Redis key for the track JSON document: `ronfax:track:{checkoutSessionId}`.
 * `checkoutSessionId` is always the Stripe (or dev) session id from the success URL.
 */
export function trackRecordRedisKey(checkoutSessionId: string): string {
  return getRedisKey("track", checkoutSessionId);
}

export async function saveTrackRecord(
  checkoutSessionId: string,
  rec: FaxTrackRecord,
): Promise<boolean> {
  const sid = String(checkoutSessionId).trim();
  if (!isCheckoutSessionId(sid)) {
    console.error(
      "[fax-track] saveTrackRecord: id must start with cs_ (Stripe Checkout session id)",
      sid.slice(0, 16),
    );
    return false;
  }

  const r = getUpstashRedis();
  if (!r) return false;
  const key = getRedisKey("track", sid);
  const merged: FaxTrackRecord = {
    ...rec,
    stripeSessionId: sid,
  };
  let payload: string;
  try {
    payload = JSON.stringify(merged);
  } catch (e) {
    console.error("[fax-track] saveTrackRecord: JSON.stringify failed", e);
    return false;
  }

  try {
    await r.set(key, payload, { ex: TRACK_RECORD_TTL_SEC });
    return true;
  } catch (e) {
    console.error("[fax-track] saveTrackRecord: set failed", e, {
      key,
      payloadBytes: payload.length,
    });
    return false;
  }
}

export async function getTrackRecord(
  checkoutSessionId: string,
): Promise<FaxTrackRecord | null> {
  const sid = String(checkoutSessionId).trim();
  if (!isCheckoutSessionId(sid)) return null;
  const r = getUpstashRedis();
  if (!r) return null;
  const raw = await r.get<string>(getRedisKey("track", sid));
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as FaxTrackRecord;
  } catch {
    return null;
  }
}

async function getTrackRecordWithRetry(
  checkoutSessionId: string,
  attempts: number,
  pauseMs: number,
): Promise<FaxTrackRecord | null> {
  for (let i = 0; i < attempts; i++) {
    const cur = await getTrackRecord(checkoutSessionId);
    if (cur) return cur;
    if (i < attempts - 1) {
      await new Promise((res) => setTimeout(res, pauseMs));
    }
  }
  return null;
}

/**
 * GET → JSON.parse → merge patch → SET with refreshed TTL.
 * Short retry helps occasional read-after-write lag on REST Redis.
 */
export async function updateTrackRecord(
  checkoutSessionId: string,
  patch: Partial<FaxTrackRecord>,
): Promise<boolean> {
  const sid = String(checkoutSessionId).trim();
  if (!isCheckoutSessionId(sid)) return false;

  const r = getUpstashRedis();
  if (!r) return false;
  const key = getRedisKey("track", sid);
  try {
    const cur = await getTrackRecordWithRetry(sid, 2, 100);
    if (!cur) {
      console.error(
        "[fax-track] updateTrackRecord: no row for key",
        key,
        "(expected existing row at ronfax:track:{cs_*}; Stripe webhook should save first)",
      );
      return false;
    }
    const next: FaxTrackRecord = {
      ...cur,
      ...patch,
      stripeSessionId: sid,
      updatedAt: Date.now(),
    };
    await r.set(key, JSON.stringify(next), { ex: TRACK_RECORD_TTL_SEC });
    return true;
  } catch (e) {
    console.error("[fax-track] updateTrackRecord", e, { key });
    return false;
  }
}

/**
 * After we receive an outbound fax id, Sinch/Phaxio webhooks resolve `ronfax:track:{sessionId}` via this index.
 * Value stored: Stripe Checkout session id (`cs_*`).
 */
export async function linkPhaxioFaxToTrackToken(
  faxId: string | number,
  checkoutSessionId: string,
): Promise<boolean> {
  const r = getUpstashRedis();
  const keyId = String(faxId).trim();
  const sid = String(checkoutSessionId).trim();
  if (!r || !keyId || !isCheckoutSessionId(sid)) return false;
  try {
    await r.set(getRedisKey("trackOutboundFax", keyId), sid, {
      ex: TRACK_RECORD_TTL_SEC,
    });
    return true;
  } catch (e) {
    console.error("[fax-track] linkPhaxioFaxToTrackToken", e);
    return false;
  }
}

/**
 * Resolve Stripe Checkout session id from outbound `faxId`.
 * Reads `ronfax:track:outbound-fax:{faxId}` first, then legacy `ronfax:fax-outbound-to-track:{faxId}`
 * (pre-refactor) when the value is a 64-char hex token — follows that to `ronfax:track:{hex}` JSON
 * and returns embedded `stripeSessionId`.
 */
export async function getTrackTokenForPhaxioFax(
  faxId: string | number,
): Promise<string | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const keyId = String(faxId).trim();
  if (!keyId) return null;
  try {
    const primary = await r.get<string>(
      getRedisKey("trackOutboundFax", keyId),
    );
    if (
      typeof primary === "string" &&
      primary.trim().startsWith("cs_") &&
      primary.trim().length > 0
    ) {
      return primary.trim();
    }

    const legacyLinkKey = `ronfax:fax-outbound-to-track:${keyId}`;
    const legacy = await r.get<string>(legacyLinkKey);
    if (typeof legacy !== "string" || !legacy.trim()) return null;
    const v = legacy.trim();
    if (v.startsWith("cs_")) return v;
    if (/^[0-9a-f]{64}$/i.test(v)) {
      const rowRaw = await r.get<string>(getRedisKey("track", v));
      if (!rowRaw || typeof rowRaw !== "string") return null;
      try {
        const row = JSON.parse(rowRaw) as FaxTrackRecord;
        const sid = row.stripeSessionId;
        if (typeof sid === "string" && sid.startsWith("cs_")) return sid.trim();
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Delay before optional read-after-`SET` diagnostic (avoids immediate GET race). */
const TRACK_SET_READBACK_DELAY_MS = 500;

/**
 * Non-throwing diagnostic: after a successful `SET`, wait 500ms,
 * then `GET` the same `ronfax:track:{cs_*}` key. Logs URL tail for env drift; empty GET does **not**
 * abort the fax pipeline (SET already succeeded without throwing).
 */
export async function logTrackSetReadbackDiagnostic(
  checkoutSessionId: string,
  context: string,
): Promise<void> {
  const sid = String(checkoutSessionId).trim();
  if (!isCheckoutSessionId(sid)) return;
  const r = getUpstashRedis();
  if (!r) return;
  const key = getRedisKey("track", sid);
  const effectiveRestUrlTail = getUpstashRestUrlTailForDiagnostics();
  const rawUpstash = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashEnvUrlTail5 =
    rawUpstash && rawUpstash.length > 5 ? rawUpstash.slice(-5) : null;

  await new Promise((res) => setTimeout(res, TRACK_SET_READBACK_DELAY_MS));

  try {
    const raw = await r.get<string>(key);
    const ok = typeof raw === "string" && raw.trim().length > 0;
    if (ok) {
      console.log("[RonFax] redis_track_readback_ok", {
        context,
        trackKey: key,
        effectiveRestUrlTail,
        upstashEnvUrlTail5,
      });
      return;
    }
    console.warn("[RonFax] redis_track_readback_empty_nonfatal", {
      context,
      trackKey: key,
      effectiveRestUrlTail,
      upstashEnvUrlTail5,
      hint: "SET did not throw; continuing fax. Possible replication lag or read-after-write delay.",
    });
  } catch (e) {
    console.warn("[RonFax] redis_track_readback_get_error_nonfatal", {
      context,
      trackKey: key,
      effectiveRestUrlTail,
      upstashEnvUrlTail5,
      e,
    });
  }
}

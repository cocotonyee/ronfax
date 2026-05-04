import { randomBytes } from "crypto";
import {
  getRedisKey,
  TRACK_RECORD_TTL_SEC,
} from "@/lib/redis-keys";
import { getUpstashRedis } from "@/lib/upstash-redis";

/** Opaque track token from {@link generateTrackToken} — 32 bytes as hex. */
export const TRACK_TOKEN_HEX_LENGTH = 64;

/** True if `id` is a full 64-char lowercase hex string (our track token), not a truncated log prefix. */
export function isLikelyOpaqueTrackToken(id: string): boolean {
  const t = id.trim().toLowerCase();
  if (t.length !== TRACK_TOKEN_HEX_LENGTH) return false;
  return /^[0-9a-f]+$/.test(t);
}

/** Redis key `fax:{stripeSessionId}` — single source of truth for the snapshot prefix. */
export function faxSessionRedisKey(stripeSessionId: string): string {
  return getRedisKey("faxSession", stripeSessionId);
}

export type FaxSessionSnapshotData =
  | { faxId: string | number; deliveryStatus: "sent" }
  | { deliveryStatus: "failure"; error?: string };

export async function getFaxSessionSnapshot(
  stripeSessionId: string,
): Promise<FaxSessionSnapshotData | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  try {
    const raw = await r.get<string>(faxSessionRedisKey(stripeSessionId));
    if (!raw || typeof raw !== "string") return null;
    return JSON.parse(raw) as FaxSessionSnapshotData;
  } catch {
    return null;
  }
}
/** Outbound Phaxio fax id → opaque track token (for send callbacks). */
const SET_OPTS = { ex: TRACK_RECORD_TTL_SEC } as const;

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
  /** `ronfax:session-to-track:{cs_*}` is set for this row */
  linked?: boolean;
  /** Denormalized for Redis viewers; status API also derives progress from delivery + Sinch state */
  progressPercent?: number;
  /** Public Vercel Blob URL for the uploaded outbound PDF — cleared after terminal delivery + cleanup */
  pdfUrl?: string | null;
  updatedAt: number;
};

export function generateTrackToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Redis key for the track JSON document: `ronfax:track:{trackToken}`.
 * Resolve `trackToken` from Stripe session id via {@link getTrackTokenForStripeSession}.
 */
export function trackRecordRedisKey(trackToken: string): string {
  return getRedisKey("track", trackToken);
}

/** Redis key: `ronfax:session-to-track:{stripeSessionId}` → opaque track token. */
export function sessionToTrackRedisKey(stripeSessionId: string): string {
  return getRedisKey("sessionToTrack", stripeSessionId);
}

export async function saveTrackRecord(
  token: string,
  rec: FaxTrackRecord,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return false;
  const key = getRedisKey("track", token);
  try {
    await r.set(key, JSON.stringify(rec), SET_OPTS);
    const verify = await getTrackRecord(token);
    if (!verify) {
      console.error(
        "[fax-track] saveTrackRecord: read-after-write miss",
        key,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("[fax-track] saveTrackRecord", e, { key });
    return false;
  }
}

export async function getTrackRecord(
  token: string,
): Promise<FaxTrackRecord | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const raw = await r.get<string>(getRedisKey("track", token));
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as FaxTrackRecord;
  } catch {
    return null;
  }
}

async function getTrackRecordWithRetry(
  token: string,
  attempts: number,
  pauseMs: number,
): Promise<FaxTrackRecord | null> {
  for (let i = 0; i < attempts; i++) {
    const cur = await getTrackRecord(token);
    if (cur) return cur;
    if (i < attempts - 1) {
      await new Promise((res) => setTimeout(res, pauseMs));
    }
  }
  return null;
}

/**
 * GET → JSON.parse → merge patch → SET with refreshed TTL (same pattern everywhere).
 * Short retry helps occasional read-after-write lag on REST Redis.
 */
export async function updateTrackRecord(
  token: string,
  patch: Partial<FaxTrackRecord>,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return false;
  const key = getRedisKey("track", token);
  try {
    const cur = await getTrackRecordWithRetry(token, 2, 100);
    if (!cur) {
      console.error(
        "[fax-track] updateTrackRecord: no row for key",
        key,
        "(tokenLength=",
        token.length,
        "expected",
        TRACK_TOKEN_HEX_LENGTH,
        "for opaque token; status URLs should use /status/cs_… not a truncated hex id)",
      );
      return false;
    }
    const next: FaxTrackRecord = {
      ...cur,
      ...patch,
      updatedAt: Date.now(),
    };
    await r.set(key, JSON.stringify(next), SET_OPTS);
    return true;
  } catch (e) {
    console.error("[fax-track] updateTrackRecord", e, { key });
    return false;
  }
}

/** Maps Stripe Checkout session id → opaque track token (for /status/[session_id]). */
export async function linkStripeSessionToTrackToken(
  stripeSessionId: string,
  trackToken: string,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return false;
  try {
    await r.set(
      getRedisKey("sessionToTrack", stripeSessionId),
      trackToken,
      SET_OPTS,
    );
    return true;
  } catch (e) {
    console.error("[fax-track] linkStripeSessionToTrackToken", e);
    return false;
  }
}

export async function getTrackTokenForStripeSession(
  stripeSessionId: string,
): Promise<string | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const t = await r.get<string>(
    getRedisKey("sessionToTrack", stripeSessionId),
  );
  return typeof t === "string" && t.length > 0 ? t : null;
}

/** Call after we receive a Phaxio outbound fax id so send webhooks can resolve the track row. */
export async function linkPhaxioFaxToTrackToken(
  faxId: string | number,
  trackToken: string,
): Promise<boolean> {
  const r = getUpstashRedis();
  const keyId = String(faxId).trim();
  if (!r || !keyId) return false;
  try {
    await r.set(
      getRedisKey("faxOutbound", keyId),
      trackToken,
      SET_OPTS,
    );
    return true;
  } catch (e) {
    console.error("[fax-track] linkPhaxioFaxToTrackToken", e);
    return false;
  }
}

export async function getTrackTokenForPhaxioFax(
  faxId: string | number,
): Promise<string | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const keyId = String(faxId).trim();
  if (!keyId) return null;
  try {
    const t = await r.get<string>(getRedisKey("faxOutbound", keyId));
    return typeof t === "string" && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

/** Writes `fax:{stripeSessionId}` — await so webhook blocks until Redis ACKs. */
export async function setFaxSessionSnapshot(
  stripeSessionId: string,
  data: FaxSessionSnapshotData,
): Promise<void> {
  const r = getUpstashRedis();
  if (!r) {
    console.error(
      "[fax-track] setFaxSessionSnapshot skipped: Redis not configured (UPSTASH_REDIS_REST_* or KV_REST_*)",
    );
    return;
  }
  const key = faxSessionRedisKey(stripeSessionId);
  try {
    await r.set(key, JSON.stringify(data), SET_OPTS);
  } catch (e) {
    console.error("[fax-track] setFaxSessionSnapshot", e);
  }
}

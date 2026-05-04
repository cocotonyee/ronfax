import { randomBytes } from "crypto";
import { getUpstashRedis } from "@/lib/upstash-redis";

const PREFIX = "ronfax:track:";
const SESSION_TO_TRACK = "ronfax:session-to-track:";
/** Stripe Checkout session id → quick fax snapshot (`faxId`, `deliveryStatus`). Same key webhook writes and status API can read. */
const FAX_SESSION_SNAPSHOT = "fax:";

/** Redis key `fax:{stripeSessionId}` — single source of truth for the snapshot prefix. */
export function faxSessionRedisKey(stripeSessionId: string): string {
  return `${FAX_SESSION_SNAPSHOT}${stripeSessionId}`;
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
const FAX_OUTBOUND_TO_TRACK = "ronfax:fax-outbound-to-track:";
const TTL_SEC = 60 * 60 * 24; // 24 hours

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
  updatedAt: number;
};

export function generateTrackToken(): string {
  return randomBytes(32).toString("hex");
}

export async function saveTrackRecord(
  token: string,
  rec: FaxTrackRecord,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return false;
  try {
    await r.set(`${PREFIX}${token}`, JSON.stringify(rec), { ex: TTL_SEC });
    return true;
  } catch (e) {
    console.error("[fax-track] saveTrackRecord", e);
    return false;
  }
}

export async function getTrackRecord(
  token: string,
): Promise<FaxTrackRecord | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const raw = await r.get<string>(`${PREFIX}${token}`);
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as FaxTrackRecord;
  } catch {
    return null;
  }
}

export async function updateTrackRecord(
  token: string,
  patch: Partial<FaxTrackRecord>,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return false;
  try {
    const cur = await getTrackRecord(token);
    if (!cur) {
      console.error("[fax-track] updateTrackRecord: no row for token", token.slice(0, 8));
      return false;
    }
    const next: FaxTrackRecord = {
      ...cur,
      ...patch,
      updatedAt: Date.now(),
    };
    await r.set(`${PREFIX}${token}`, JSON.stringify(next), { ex: TTL_SEC });
    return true;
  } catch (e) {
    console.error("[fax-track] updateTrackRecord", e);
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
    await r.set(`${SESSION_TO_TRACK}${stripeSessionId}`, trackToken, {
      ex: TTL_SEC,
    });
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
  const t = await r.get<string>(`${SESSION_TO_TRACK}${stripeSessionId}`);
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
    await r.set(`${FAX_OUTBOUND_TO_TRACK}${keyId}`, trackToken, {
      ex: TTL_SEC,
    });
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
    const t = await r.get<string>(`${FAX_OUTBOUND_TO_TRACK}${keyId}`);
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
    await r.set(key, JSON.stringify(data), {
      ex: TTL_SEC,
    });
  } catch (e) {
    console.error("[fax-track] setFaxSessionSnapshot", e);
  }
}

import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";

const PREFIX = "ronfax:track:";
const SESSION_TO_TRACK = "ronfax:session-to-track:";
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
  faxId: number | null;
  /** processing | submitted | success | failure */
  deliveryStatus: string;
  phaxioLastStatus?: string;
  errorMessage?: string;
  updatedAt: number;
};

let client: Redis | null | undefined;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (client === undefined) {
    client = new Redis({ url, token });
  }
  return client;
}

export function generateTrackToken(): string {
  return randomBytes(32).toString("hex");
}

export async function saveTrackRecord(
  token: string,
  rec: FaxTrackRecord,
): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  await r.set(`${PREFIX}${token}`, JSON.stringify(rec), { ex: TTL_SEC });
  return true;
}

export async function getTrackRecord(
  token: string,
): Promise<FaxTrackRecord | null> {
  const r = getRedis();
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
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const cur = await getTrackRecord(token);
  if (!cur) return;
  const next: FaxTrackRecord = {
    ...cur,
    ...patch,
    updatedAt: Date.now(),
  };
  await r.set(`${PREFIX}${token}`, JSON.stringify(next), { ex: TTL_SEC });
}

/** Maps Stripe Checkout session id → opaque track token (for /status/[session_id]). */
export async function linkStripeSessionToTrackToken(
  stripeSessionId: string,
  trackToken: string,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(`${SESSION_TO_TRACK}${stripeSessionId}`, trackToken, {
    ex: TTL_SEC,
  });
}

export async function getTrackTokenForStripeSession(
  stripeSessionId: string,
): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const t = await r.get<string>(`${SESSION_TO_TRACK}${stripeSessionId}`);
  return typeof t === "string" && t.length > 0 ? t : null;
}

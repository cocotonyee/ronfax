import { randomBytes } from "crypto";
import { getUpstashRedis } from "@/lib/upstash-redis";
import {
  shortRefFromStripeSession,
  type RefMappingValue,
} from "@/lib/ref-code";

const REF_PREFIX = "ronfax:ref:";
const REPLY_PREFIX = "ronfax:reply:";
const RECV_DEDUPE_PREFIX = "ronfax:phaxio-in:";
/** Keep ref→sender mapping long enough for reply cycles */
const REF_TTL_SEC = 60 * 60 * 24 * 365;
const REPLY_TTL_SEC = 60 * 60 * 24 * 90;
const DEDUPE_TTL_SEC = 60 * 60 * 24 * 14;

export const REPLY_UNLOCK_CENTS = 99;

export type InboundReplyRecord = {
  downloadToken: string;
  refCode: string;
  phaxioFaxId: string | number;
  blobPathname: string;
  /** Original outbound sender */
  notifyEmail: string;
  matchedVia: "metadata" | "pdf_text";
  createdAt: number;
  paid: boolean;
};

/** Allocate a unique RF-XXXX and store mapping (NX). */
export async function allocateRefCode(
  data: RefMappingValue,
): Promise<string | null> {
  const r = getUpstashRedis();
  if (!r) return null;

  for (let salt = 0; salt < 48; salt++) {
    const ref = shortRefFromStripeSession(data.stripeSessionId, salt);
    const key = `${REF_PREFIX}${ref}`;
    const ok = await r.set(key, JSON.stringify(data), {
      nx: true,
      ex: REF_TTL_SEC,
    });
    if (ok) return ref;
  }

  const n = randomBytes(2).readUInt16BE(0) % 10000;
  const fallback = `RF-${n.toString().padStart(4, "0")}`;
  const key = `${REF_PREFIX}${fallback}`;
  const ok = await r.set(key, JSON.stringify(data), { nx: true, ex: REF_TTL_SEC });
  return ok ? fallback : null;
}

export async function getRefMapping(
  refCode: string,
): Promise<RefMappingValue | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const raw = await r.get<string>(`${REF_PREFIX}${refCode}`);
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as RefMappingValue;
  } catch {
    return null;
  }
}

export function generateDownloadToken(): string {
  return randomBytes(32).toString("hex");
}

export async function saveInboundReply(
  rec: InboundReplyRecord,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return false;
  await r.set(`${REPLY_PREFIX}${rec.downloadToken}`, JSON.stringify(rec), {
    ex: REPLY_TTL_SEC,
  });
  return true;
}

export async function getInboundReply(
  downloadToken: string,
): Promise<InboundReplyRecord | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const raw = await r.get<string>(`${REPLY_PREFIX}${downloadToken}`);
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as InboundReplyRecord;
  } catch {
    return null;
  }
}

export async function markReplyPaid(downloadToken: string): Promise<void> {
  const r = getUpstashRedis();
  if (!r) return;
  const cur = await getInboundReply(downloadToken);
  if (!cur) return;
  const next: InboundReplyRecord = { ...cur, paid: true };
  await r.set(`${REPLY_PREFIX}${downloadToken}`, JSON.stringify(next), {
    ex: REPLY_TTL_SEC,
  });
}

/** Avoid duplicate processing when Phaxio retries receive callbacks. */
export async function claimInboundFaxCallback(
  phaxioFaxId: string | number,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return true;
  const result = await r.set(
    `${RECV_DEDUPE_PREFIX}${String(phaxioFaxId)}`,
    "1",
    {
      nx: true,
      ex: DEDUPE_TTL_SEC,
    },
  );
  return result !== null;
}

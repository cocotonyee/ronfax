import { createHash } from "crypto";

/** Visible on sent fax header and in received replies, e.g. RF-1288 */
export const REF_CODE_REGEX = /RF-\d{4}/gi;

export type RefMappingValue = {
  stripeSessionId: string;
  contactEmail: string;
  contactName?: string;
  faxTo: string;
  createdAt: number;
};

/** Derive a deterministic 4-digit-style ref; use {@link allocateRefCode} for globally unique mapping. */
export function shortRefFromStripeSession(sessionId: string, salt = 0): string {
  const h = createHash("sha256")
    .update(`ronfax:ref:${sessionId}:${salt}`)
    .digest();
  const n = h.readUInt32BE(0) % 10000;
  return `RF-${n.toString().padStart(4, "0")}`;
}

export function extractRefCodes(text: string): string[] {
  const found = text.match(REF_CODE_REGEX) ?? [];
  const upper = found.map((s) => s.toUpperCase());
  return [...new Set(upper)];
}

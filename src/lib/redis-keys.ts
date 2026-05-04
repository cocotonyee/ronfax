/**
 * RonFax Upstash key shapes and track-row TTL.
 *
 * **Fax track (read/write via `src/lib/fax-track.ts` only):**
 * - Document: `getRedisKey("track", cs_*)` → `ronfax:track:{cs_*}` — Stripe webhook save/update, status API read, blob cleanup.
 * - Outbound index: `getRedisKey("trackOutboundFax", faxId)` → `ronfax:track:outbound-fax:{faxId}` — value is the same `cs_*` (Sinch callbacks resolve session).
 *
 * **Other keys** (same Redis client, different prefixes): `src/lib/redis.ts` (webhook idempotency, email dedupe), `checkout-meta-stash.ts` (`ronfax:cs-meta:*`), `reply-store.ts`, etc.
 */

/** 24 hours — every SET that stores `FaxTrackRecord` or related indices. */
export const TRACK_RECORD_TTL_SEC = 60 * 60 * 24; // 86400

export type RonfaxRedisKeyKind = "track" | "trackOutboundFax";

/**
 * Build the canonical Redis key for a given id segment (trimmed, never empty).
 */
export function getRedisKey(kind: RonfaxRedisKeyKind, id: string): string {
  const clean = String(id).trim();
  if (!clean) {
    throw new Error("[getRedisKey] id must be non-empty");
  }
  switch (kind) {
    case "track":
      return `ronfax:track:${clean}`;
    case "trackOutboundFax":
      return `ronfax:track:outbound-fax:${clean}`;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Single source of truth for RonFax Upstash key shapes and track-row TTL.
 * All `ronfax:track:*` reads/writes must go through {@link getRedisKey}("track", …).
 */

/** Minimum 24 hours — applied to every SET that stores `FaxTrackRecord` or related indices. */
export const TRACK_RECORD_TTL_SEC = 60 * 60 * 24; // 86400

export type RonfaxRedisKeyKind =
  | "track"
  | "sessionToTrack"
  | "faxOutbound"
  | "faxSession";

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
    case "sessionToTrack":
      return `ronfax:session-to-track:${clean}`;
    case "faxOutbound":
      return `ronfax:fax-outbound-to-track:${clean}`;
    case "faxSession":
      return `fax:${clean}`;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

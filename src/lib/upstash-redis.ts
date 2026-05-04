import { Redis } from "@upstash/redis";

let cached: Redis | null | undefined;
let loggedRestEndpoint = false;

function restUrl(): string | undefined {
  return (
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim()
  );
}

function restToken(): string | undefined {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim()
  );
}

/** True when env provides REST URL + token (Upstash or Vercel KV-compatible names). */
export function isUpstashRedisConfigured(): boolean {
  return Boolean(restUrl() && restToken());
}

/**
 * Last 5 characters of the **effective** REST URL string (`UPSTASH_REDIS_REST_URL` or
 * `KV_REST_API_URL`, whichever `restUrl()` picks) — compare across workers/logs for env drift.
 */
export function getUpstashRestUrlTailForDiagnostics(): string | null {
  const u = restUrl();
  if (!u) return null;
  const s = u.trim();
  if (s.length === 0) return null;
  if (s.length <= 5) return "*****";
  return s.slice(-5);
}

/**
 * Shared singleton — fax-track, Stripe idempotency, reply-store, etc.
 * Returns null only when URL/token missing (never silently skip writes without checking callers).
 */
export function getUpstashRedis(): Redis | null {
  const url = restUrl();
  const token = restToken();
  if (!url || !token) return null;
  if (cached === undefined) {
    cached = new Redis({ url, token });
    if (!loggedRestEndpoint) {
      loggedRestEndpoint = true;
      try {
        const host = new URL(url).host;
        console.log(
          "[RonFax] Upstash Redis REST:",
          host,
          "(set UPSTASH_REDIS_REST_URL or KV_REST_API_URL to match your Upstash database)",
        );
      } catch {
        console.warn("[RonFax] Upstash REST URL parse failed — check UPSTASH_REDIS_REST_URL");
      }
    }
  }
  return cached;
}

import { Redis } from "@upstash/redis";

let cached: Redis | null | undefined;

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
 * Shared singleton — fax-track, Stripe idempotency, reply-store, etc.
 * Returns null only when URL/token missing (never silently skip writes without checking callers).
 */
export function getUpstashRedis(): Redis | null {
  const url = restUrl();
  const token = restToken();
  if (!url || !token) return null;
  if (cached === undefined) {
    cached = new Redis({ url, token });
  }
  return cached;
}

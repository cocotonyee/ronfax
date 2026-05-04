/**
 * Stripe idempotency + email dedupe keys — uses the same {@link getUpstashRedis} client as
 * `src/lib/fax-track.ts` (env: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or KV_* aliases).
 */
import { getUpstashRedis } from "@/lib/upstash-redis";

const EVENT_PREFIX = "ronfax:stripe:event:";
const FAX_STATUS_MANUAL_RL_PREFIX = "ronfax:fax-status:manual:";

/**
 * Manual refresh on `/api/fax-status/[id]?manual=1` — at most once per 10s per session id.
 * @returns true if the request may proceed, false if rate limited
 */
export async function tryConsumeFaxStatusManualRefresh(
  checkoutSessionId: string,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return true;
  const key = `${FAX_STATUS_MANUAL_RL_PREFIX}${checkoutSessionId}`;
  const acquired = await r.set(key, "1", { nx: true, ex: 10 });
  return acquired !== null;
}

/** Returns true if this worker should process the event (first claim). Duplicates return false. */
export async function claimStripeWebhookEvent(
  stripeEventId: string,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) {
    console.warn(
      "[RonFax] Redis env missing (UPSTASH_REDIS_REST_* or KV_REST_*) — webhook idempotency disabled",
    );
    return true;
  }

  const result = await r.set(`${EVENT_PREFIX}${stripeEventId}`, "1", {
    nx: true,
    ex: 60 * 60 * 24 * 14,
  });
  return result !== null;
}

/** Call when processing fails so Stripe retries can claim again. */
export async function releaseStripeWebhookEvent(
  stripeEventId: string,
): Promise<void> {
  const r = getUpstashRedis();
  if (!r) return;
  await r.del(`${EVENT_PREFIX}${stripeEventId}`);
}

const NOTIFY_TASK_STARTED = "ronfax:notify:task_started:";
const NOTIFY_TERMINAL = "ronfax:notify:terminal:";

/** One email per checkout session — payment confirmed / fax task queued. */
export async function claimTaskStartedEmail(
  stripeCheckoutSessionId: string,
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return true;
  const result = await r.set(
    `${NOTIFY_TASK_STARTED}${stripeCheckoutSessionId}`,
    "1",
    { nx: true, ex: 60 * 60 * 24 * 30 },
  );
  return result !== null;
}

/** Terminal Sinch delivery outcome — success or failure email once per session. */
export async function claimTerminalDeliveryEmail(
  stripeCheckoutSessionId: string,
  kind: "delivered" | "failed",
): Promise<boolean> {
  const r = getUpstashRedis();
  if (!r) return true;
  const result = await r.set(
    `${NOTIFY_TERMINAL}${kind}:${stripeCheckoutSessionId}`,
    "1",
    { nx: true, ex: 60 * 60 * 24 * 30 },
  );
  return result !== null;
}

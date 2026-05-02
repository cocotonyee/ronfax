import { Redis } from "@upstash/redis";

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

const EVENT_PREFIX = "ronfax:stripe:event:";

/** Returns true if this worker should process the event (first claim). Duplicates return false. */
export async function claimStripeWebhookEvent(
  stripeEventId: string,
): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    console.warn(
      "[RonFax] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing — webhook idempotency disabled",
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
  const r = getRedis();
  if (!r) return;
  await r.del(`${EVENT_PREFIX}${stripeEventId}`);
}

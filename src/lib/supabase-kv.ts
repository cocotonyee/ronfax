/**
 * Small key-value tables in Supabase (replaces former `src/lib/redis.ts` helpers).
 */
import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * @returns true = 本 worker 应处理；false = 同一 event 已处理过；null = 存储异常，应让 Stripe 重试 (5xx)。
 */
export async function claimStripeWebhookEvent(
  stripeEventId: string,
): Promise<boolean | null> {
  const sup = getSupabaseAdmin();
  if (!sup) {
    console.warn(
      "[RonFax] Supabase not configured — cannot claim Stripe webhook idempotency",
    );
    return null;
  }
  const { error } = await sup.from("stripe_webhook_events").insert({
    stripe_event_id: stripeEventId,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[RonFax] claimStripeWebhookEvent insert error", error);
  return null;
}

export async function releaseStripeWebhookEvent(
  stripeEventId: string,
): Promise<void> {
  const sup = getSupabaseAdmin();
  if (!sup) return;
  await sup
    .from("stripe_webhook_events")
    .delete()
    .eq("stripe_event_id", stripeEventId);
}

/** @returns true if this send may proceed (first claim). */
export async function claimTaskStartedEmail(
  stripeCheckoutSessionId: string,
): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return true;
  const { error } = await sup.from("fax_notify_dedup").insert({
    stripe_session_id: stripeCheckoutSessionId,
    notify_kind: "task_started",
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[RonFax] claimTaskStartedEmail", error);
  return false;
}

export async function claimTerminalDeliveryEmail(
  stripeCheckoutSessionId: string,
  kind: "delivered" | "failed",
): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return true;
  const { error } = await sup.from("fax_notify_dedup").insert({
    stripe_session_id: stripeCheckoutSessionId,
    notify_kind: `terminal_${kind}`,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[RonFax] claimTerminalDeliveryEmail", error);
  return false;
}

/**
 * 同一 Stripe Checkout session 只应触发一次 Sinch 发送（多 endpoint / 不同 event id 时互斥）。
 * @returns true = 获得发送权；false = 已有其它 worker；null = DB 错误，应 500 并重试。
 */
export async function claimCheckoutFaxDispatch(
  stripeSessionId: string,
): Promise<boolean | null> {
  const sup = getSupabaseAdmin();
  if (!sup) return null;
  const { error } = await sup.from("checkout_fax_dispatch_claim").insert({
    stripe_session_id: stripeSessionId,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[RonFax] claimCheckoutFaxDispatch", error);
  return null;
}

export async function releaseCheckoutFaxDispatch(
  stripeSessionId: string,
): Promise<void> {
  const sup = getSupabaseAdmin();
  if (!sup) return;
  await sup
    .from("checkout_fax_dispatch_claim")
    .delete()
    .eq("stripe_session_id", stripeSessionId);
}

const MANUAL_REFRESH_COOLDOWN_MS = 10_000;

/** @returns true if caller may refresh (not rate limited). */
export async function tryConsumeFaxStatusManualRefresh(
  checkoutSessionId: string,
): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return true;
  const { data: row } = await sup
    .from("fax_status_manual_refresh")
    .select("last_refresh_at")
    .eq("stripe_session_id", checkoutSessionId)
    .maybeSingle();
  const now = Date.now();
  if (row?.last_refresh_at) {
    const t = new Date(row.last_refresh_at as string).getTime();
    if (now - t < MANUAL_REFRESH_COOLDOWN_MS) return false;
  }
  const { error } = await sup.from("fax_status_manual_refresh").upsert(
    {
      stripe_session_id: checkoutSessionId,
      last_refresh_at: new Date().toISOString(),
    },
    { onConflict: "stripe_session_id" },
  );
  if (error) {
    console.error("[RonFax] tryConsumeFaxStatusManualRefresh", error);
    return true;
  }
  return true;
}

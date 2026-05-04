/**
 * Small key-value tables in Supabase (replaces former `src/lib/redis.ts` helpers).
 */
import { getSupabaseAdmin } from "@/lib/supabase-server";

/** @returns true if this worker should process the event (first insert). */
export async function claimStripeWebhookEvent(
  stripeEventId: string,
): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) {
    console.warn(
      "[RonFax] Supabase not configured — Stripe webhook idempotency disabled",
    );
    return true;
  }
  const { error } = await sup.from("stripe_webhook_events").insert({
    stripe_event_id: stripeEventId,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[RonFax] claimStripeWebhookEvent insert error", error);
  return true;
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
  return true;
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
  return true;
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

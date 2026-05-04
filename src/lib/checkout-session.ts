/** Stripe Checkout session id from success URL (`cs_test_*` / `cs_live_*` / `cs_dev_*`). */

export function isCheckoutSessionId(id: string): boolean {
  return String(id).trim().startsWith("cs_");
}

export function parseCheckoutSessionId(
  raw: string | undefined | null,
): string | null {
  const sid = String(raw ?? "").trim();
  return isCheckoutSessionId(sid) ? sid : null;
}

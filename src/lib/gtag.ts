"use client";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type GtagParams = Record<string, unknown>;

export function trackEvent(name: string, params?: GtagParams) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, params ?? {});
}

/** Google Ads conversion (separate from GA4 `purchase`). */
export function trackGoogleAdsPurchaseConversion(params: {
  sendTo: string;
  transactionId: string;
  value?: number;
  currency: string;
  sha256Email?: string;
}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  if (!params.sendTo.trim()) return;

  window.gtag("event", "conversion", {
    send_to: params.sendTo,
    transaction_id: params.transactionId,
    ...(params.value != null && Number.isFinite(params.value)
      ? { value: params.value, currency: params.currency }
      : {}),
    ...(params.sha256Email
      ? { user_data: { sha256_email_address: params.sha256Email } }
      : {}),
  });
}

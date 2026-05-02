"use client";

import { useEffect } from "react";

/** Canonical key requested for SmartAssistant “last fax” hint. */
export const LAST_FAX_ID_STORAGE_KEY = "lastFaxId";

/** Persists Stripe Checkout session id after payment redirect for assistant status checks. */
export function PersistLastFaxId({
  checkoutSessionId,
}: {
  checkoutSessionId: string;
}) {
  useEffect(() => {
    if (!checkoutSessionId.startsWith("cs_")) return;
    try {
      localStorage.setItem(LAST_FAX_ID_STORAGE_KEY, checkoutSessionId);
      window.dispatchEvent(new CustomEvent("rf-last-fax-updated"));
    } catch {
      /* private mode / quota */
    }
  }, [checkoutSessionId]);

  return null;
}

export function readLastFaxIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LAST_FAX_ID_STORAGE_KEY);
    return v?.startsWith("cs_") ? v : null;
  } catch {
    return null;
  }
}

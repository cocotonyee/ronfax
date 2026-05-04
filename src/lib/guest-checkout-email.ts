import { randomUUID } from "crypto";
import { GUEST_CHECKOUT_EMAIL_DOMAIN } from "@/lib/constants";

/** Dev-only / non-Stripe paths (e.g. `/api/dev/skip-checkout`). Live Checkout uses `customer_details.email` from Stripe instead. */
export function createGuestCheckoutEmail(): string {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  return `guest-${id}@${GUEST_CHECKOUT_EMAIL_DOMAIN}`;
}

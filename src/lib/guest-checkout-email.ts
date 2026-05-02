import { randomUUID } from "crypto";
import { GUEST_CHECKOUT_EMAIL_DOMAIN } from "@/lib/constants";

/** Unique placeholder for Stripe when the user does not enter an email on our form. */
export function createGuestCheckoutEmail(): string {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  return `guest-${id}@${GUEST_CHECKOUT_EMAIL_DOMAIN}`;
}

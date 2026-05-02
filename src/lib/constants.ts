import { formatUsdFromCents } from "@/lib/pricing";
import { BASE_PRICE_CENTS, EXTRA_PAGE_CENTS, INCLUDED_PAGES } from "@/lib/pricing";

export const APP_NAME = "RonFax";

/** Public support inbox (marketing & help). */
export const SUPPORT_EMAIL = "support@ronfax.com";

/** Guest Checkout placeholder — receipt email is not sent to this domain. */
export const GUEST_CHECKOUT_EMAIL_DOMAIN = "noreply.ronfax.com";

/** Marketing line on landing pages (dynamic checkout uses actual page count). */
export const PRICING_SUMMARY = `${formatUsdFromCents(BASE_PRICE_CENTS)} for up to ${INCLUDED_PAGES} pages, then ${formatUsdFromCents(EXTRA_PAGE_CENTS)} per extra page`;

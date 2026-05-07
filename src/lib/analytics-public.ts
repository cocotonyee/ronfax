/** Client-safe analytics IDs (NEXT_PUBLIC_* overrides). */

export const GA4_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "G-8SMSVJW53E";

/** Google Ads conversion ID (AW-*), for gtag `config`. */
export const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "AW-17735961699";

/** Full `send_to` for the primary purchase conversion label. */
export const GOOGLE_ADS_PURCHASE_SEND_TO =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO ??
  "AW-17735961699/eOlWCKuIk6kcEOOYlYlc";

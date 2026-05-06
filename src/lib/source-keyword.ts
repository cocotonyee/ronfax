/** Stripe metadata + DB — keep short, no PII. */
const MAX_LEN = 120;

export function sanitizeSourceKeyword(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  const ascii = s.replace(/[^\w.\-–—\s/+:]/gi, "").replace(/\s+/g, " ");
  const cut = ascii.slice(0, MAX_LEN).trim();
  return cut.length > 0 ? cut : undefined;
}

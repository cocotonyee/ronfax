import { isValidUsPhoneDigits, normalizeUsDigits } from "@/lib/phone";

/** Max length for raw query value (prevents abuse). */
const MAX_RAW = 64;

/**
 * Allowed characters in `fax` URL param: digits and common US formatting only.
 * Rejects anything else (e.g. angle brackets, quotes, letters) to avoid XSS when echoed into UI.
 */
const SAFE_FAX_PARAM = /^[0-9+\-().\s]+$/;

/**
 * Returns exactly 10 US digits when the param is valid, otherwise null.
 */
export function sanitizeFaxFromUrlParam(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().slice(0, MAX_RAW);
  if (trimmed.length === 0) return null;
  if (!SAFE_FAX_PARAM.test(trimmed)) return null;
  const digits = normalizeUsDigits(trimmed);
  return isValidUsPhoneDigits(digits) ? digits : null;
}

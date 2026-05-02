const DIGITS = /\D/g;

/** Keeps only digits, limits US numbers to 10 digits (strips leading 1 if 11). */
export function normalizeUsDigits(input: string): string {
  let d = input.replace(DIGITS, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, 10);
}

/** Formats as (XXX) XXX-XXXX when possible */
export function formatUsPhone(input: string): string {
  const d = normalizeUsDigits(input);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function isValidUsPhoneDigits(digits: string): boolean {
  return digits.length === 10;
}

export function toE164Us(digits10: string): string {
  return `+1${digits10}`;
}

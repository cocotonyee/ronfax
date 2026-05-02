import type { ClinicRecord } from "@/lib/clinic-types";

/** Curated order for the home “directory” grid (pSEO + recognizable brands). */
const GRID_SLUG_PRIORITY = [
  "irs-form-2553-s-corp-election",
  "chase-card-services",
  "united-healthcare-prior-auth",
  "social-security-admin-benefits",
  "equifax-credit-dispute",
  "uscis-immigration-filings",
  "va-healthcare-benefits",
  "cigna-medical-review",
] as const;

/** Up to `max` rows: priority slugs first, then fill from remaining list. */
export function selectPopularGridEntries(
  list: ClinicRecord[],
  max = 8,
): ClinicRecord[] {
  const bySlug = new Map(list.map((r) => [r.slug, r]));
  const out: ClinicRecord[] = [];
  const used = new Set<string>();

  for (const slug of GRID_SLUG_PRIORITY) {
    const row = bySlug.get(slug);
    if (row) {
      out.push(row);
      used.add(row.slug);
    }
    if (out.length >= max) return out;
  }

  for (const row of list) {
    if (used.has(row.slug)) continue;
    out.push(row);
    if (out.length >= max) break;
  }

  return out;
}

/** Stylized initials / acronym for directory cards. */
export function brandInitials(name: string): string {
  const n = name.trim();
  if (/^IRS\b/i.test(n)) return "IRS";
  if (/Chase/i.test(n)) return "Ch";
  if (/United\s*Health/i.test(n)) return "UH";
  if (/Aetna/i.test(n)) return "Ae";
  if (/Cigna/i.test(n)) return "Ci";
  if (/Equifax/i.test(n)) return "Eq";
  if (/Humana/i.test(n)) return "Hu";
  if (/USCIS/i.test(n)) return "US";
  if (/Social Security/i.test(n)) return "SS";
  if (/^VA\b|^VA —/i.test(n)) return "VA";
  if (/180\s*Medical/i.test(n)) return "18";
  if (/Dun\s*&?\s*Bradstreet|D[- ]?U[- ]?N[- ]?S/i.test(n)) return "D&B";
  if (/SEC\b/i.test(n) && /EDGAR|Filings/i.test(n)) return "SEC";
  if (/Better Business|BBB/i.test(n)) return "BBB";
  if (/Passport/i.test(n)) return "PP";
  if (/Sample Regional/i.test(n)) return "RX";

  const parts = n
    .replace(/[—–]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 3);
  }
  return n.slice(0, 2).toUpperCase();
}

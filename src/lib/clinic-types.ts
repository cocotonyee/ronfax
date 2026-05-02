/**
 * One row in `src/data/clinics.json` (or JSON at CLINICS_JSON_URL).
 */
export type ClinicRecord = {
  slug: string;
  name: string;
  city: string;
  state: string;
  /** Badge label, e.g. "Financial services", "Healthcare" */
  category?: string;
  /** US fax number: exactly 10 digits, no punctuation */
  faxDigits: string;
  /** Optional display format, e.g. "(302) 827-0328" */
  faxDisplay?: string;
  description?: string;
  /** Items patients/customers should include in their fax */
  whatToInclude?: string[];
  /** Body text for the “letter template” modal */
  letterTemplate?: string;
};

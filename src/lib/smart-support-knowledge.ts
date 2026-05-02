/**
 * RonFax assistant quick-reply knowledge (aligned with site FAQ; concise for chat).
 */

export type SmartSupportFaqEntry = {
  id: string;
  label: string;
  answer: string;
};

export const SMART_SUPPORT_FAQ: SmartSupportFaqEntry[] = [
  {
    id: "pricing",
    label: "Pricing & hidden fees?",
    answer:
      "$1.99 covers up to 3 pages — every extra page is $0.50. The total appears before Stripe checkout: no subscriptions, no surprise line items.",
  },
  {
    id: "security",
    label: "Is my fax encrypted?",
    answer:
      "Yes. Traffic uses modern TLS (industry-aligned with 256-bit-class suites). Payloads sit encrypted at-rest only while your job completes, then purge under zero-retention — not archived as a vault.",
  },
  {
    id: "hipaa",
    label: "Is RonFax HIPAA-ready?",
    answer:
      "We apply HIPAA-minded controls — encryption and carrier routing built for PHI contexts. Formal BAA and enterprise terms are scoped per covered entity — contact RonFax for review.",
  },
  {
    id: "canada",
    label: "US & Canada numbers?",
    answer:
      "We support sending to US and Canada 10‑digit fax numbers, including standard toll‑free prefixes (800, 888, 877, 866, 855, etc.). Faxing outside North America isn’t enabled yet.",
  },
  {
    id: "file-types",
    label: "What file formats work?",
    answer:
      "Upload PDF or common images (JPEG, PNG); cap 8 MB per file. Microsoft Word (.doc/.docx) must be saved or exported as PDF first — browsers can’t ingest raw Word safely here.",
  },
  {
    id: "transmission-time",
    label: "How fast is delivery?",
    answer:
      "Most jobs clear within seconds to a couple of minutes depending on dial quality and line congestion. Busy signals or voicemail-style destinations can lengthen retries — watch your live RonFax status page for authoritative completion.",
  },
  {
    id: "receipt-status",
    label: "Receipt & fax status?",
    answer:
      "After checkout Stripe routes you to a RonFax status URL bound to your session — it refreshes as the carrier progresses. Stripe also retains your billing receipt separately for accounting.",
  },
  {
    id: "refunds",
    label: "Refunds & disputes?",
    answer:
      "Fees settle at Stripe checkout tied to validated page counts. Transmission issues surfaced on your status timeline may merit support escalation — invoice references help us trace the send quickly.",
  },
  {
    id: "retention",
    label: "Data retention?",
    answer:
      "Zero long-term warehousing: payloads are erased after definitive delivery or definitive failure per our zero-retention posture — comparable to ephemeral fax machine memory, not archival storage.",
  },
  {
    id: "proof",
    label: "Proof it was delivered?",
    answer:
      "Your live status captures carrier disposition (completed, incomplete, fault codes when returned). Screenshots or Stripe session IDs suffice for auditing alongside any PDF receipt you exported.",
  },
];

export const CHECK_STATUS_LABEL = "Check My Status";

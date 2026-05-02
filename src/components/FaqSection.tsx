"use client";

import { AnimatePresence, m } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const items: { q: string; a: string }[] = [
  {
    q: "Is it secure?",
    a: "Encryption: TLS 1.2+ in transit; AES-256 for files at rest while processing. Storage: automatic purge under our zero-retention policy after delivery or final failure (see zero-retention FAQ).",
  },
  {
    q: "How do I know my fax was received?",
    a: "After payment: live status page shows carrier handoff and send outcome (success, partial, or failed) when returned by the carrier. Email: link to the same page. Cost: $1.99 for up to 3 pages; $0.50 per extra page; no subscription.",
  },
  {
    q: "What is your zero-retention policy?",
    a: "No long-term archive. Files are removed from our storage after successful delivery to the recipient fax number or after a definitive failed transmission—not kept as a permanent vault.",
  },
  {
    q: "What file types are supported?",
    a: "Formats: PDF, JPG, PNG (max 8 MB). Word: save/export as PDF first. Device: browser only—no physical fax machine required.",
  },
  {
    q: "Can I send faxes internationally?",
    a: "Coverage: US and Canada 10-digit fax numbers, including common toll-free prefixes (800, 888, 877, 866, 855, etc.). Outside US/CA: not supported yet.",
  },
  {
    q: "Is this HIPAA compliant?",
    a: "Technical controls: encryption in transit and at rest; HIPAA-aware fax routing. BAA: covered entities should contact us for enterprise/BAA terms—evaluated per use case.",
  },
  {
    q: "How do I get a confirmation?",
    a: "Receipt: downloadable PDF after checkout. Transmission: status page (and email link) with carrier references when available. Billing: keep your Stripe receipt or session reference for support.",
  },
  {
    q: "Are there any hidden fees?",
    a: "Cost: $1.99 for up to 3 pages; $0.50 per additional page. No monthly fee, no subscription; the total is computed from page count before payment.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
        Frequently asked questions
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-relaxed text-zinc-600">
        Straight answers about security, files, pricing, and delivery.
      </p>
      <div className="mt-8 space-y-2">
        {items.map(({ q, a }, i) => {
          const isOpen = open === i;
          return (
            <div
              key={q}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                isOpen
                  ? "border-primary/30 ring-1 ring-primary/10"
                  : "border-zinc-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-zinc-900"
                aria-expanded={isOpen}
              >
                <span className="pr-2">{q}</span>
                <m.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" as const }}
                  className="shrink-0 text-zinc-400"
                >
                  <ChevronDown className="h-5 w-5" aria-hidden />
                </m.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                      height: "auto",
                      opacity: 1,
                      transition: {
                        height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.2, delay: 0.05 },
                      },
                    }}
                    exit={{
                      height: 0,
                      opacity: 0,
                      transition: {
                        height: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.15 },
                      },
                    }}
                    className="overflow-hidden border-t border-zinc-100"
                  >
                    <p className="px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-600">
                      {a}
                    </p>
                  </m.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

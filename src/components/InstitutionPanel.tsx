"use client";

import Link from "next/link";
import { useState } from "react";
import { LetterTemplateModal } from "@/components/LetterTemplateModal";
import { formatUsPhone } from "@/lib/phone";
import type { ClinicRecord } from "@/lib/clinic-types";
import { VERIFIED_STAMP } from "@/lib/ui-tokens";

export function InstitutionPanel({ entry }: { entry: ClinicRecord }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const display =
    entry.faxDisplay ?? formatUsPhone(entry.faxDigits);

  const copyFax = async () => {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const templateBody =
    entry.letterTemplate ??
    `Dear ${entry.name},\n\nPlease find attached documentation.\n\nSincerely,\n[Your name]`;

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10">
        <div className="border-b border-zinc-100 bg-gradient-to-br from-primary/5 to-white px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {entry.category ?? "Verified recipient"}
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                {entry.name}
              </h1>
              <p className="mt-1 text-zinc-600">
                {entry.city}, {entry.state}
              </p>
            </div>
            <p className="text-xs font-medium text-zinc-400">
              Verified {VERIFIED_STAMP}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Fax number
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold tabular-nums text-zinc-900">
                  {display}
                </span>
                <button
                  type="button"
                  onClick={() => void copyFax()}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  aria-label="Copy fax number"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href="#send"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
              >
                Send fax to {entry.name} →
              </Link>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                Get letter template
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">
            What to include
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {(entry.whatToInclude?.length
              ? entry.whatToInclude
              : ["Clear identification", "Reference numbers if applicable"]
            ).map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LetterTemplateModal
        open={modalOpen}
        title={`Letter template · ${entry.name}`}
        body={templateBody}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

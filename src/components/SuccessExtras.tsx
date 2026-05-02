"use client";

import { useState } from "react";

type Props = {
  sessionId: string | null;
};

export function SuccessExtras({ sessionId }: Props) {
  const [leadEmail, setLeadEmail] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "sending" | "sent" | "err">(
    "idle",
  );

  const receiptHref =
    sessionId != null && sessionId.length > 0
      ? `/api/receipt?session_id=${encodeURIComponent(sessionId)}`
      : null;

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadStatus("sending");
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: leadEmail.trim(),
          message: leadNote.trim(),
          source: "inbound_fax_marketing",
        }),
      });
      if (!r.ok) throw new Error("bad");
      setLeadStatus("sent");
      setLeadNote("");
    } catch {
      setLeadStatus("err");
    }
  };

  return (
    <div className="mx-auto mt-10 w-full max-w-lg space-y-10 text-left">
      {receiptHref ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Receipt</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Download a PDF receipt for your records.
          </p>
          <a
            href={receiptHref}
            className="mt-4 inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:border-primary/30"
          >
            Download receipt (PDF)
          </a>
        </div>
      ) : null}

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Need a reply? Get a dedicated RonFax number to receive documents online.
        </h2>
        <p className="mt-2 text-sm text-zinc-700">
          Tell us how we can reach you and what you need—we&apos;ll follow up
          about inbound fax / dedicated numbers.
        </p>
        {leadStatus === "sent" ? (
          <p className="mt-4 text-sm font-medium text-primary">
            Thanks — we received your note.
          </p>
        ) : (
          <form onSubmit={submitLead} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="lead-email"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                Email
              </label>
              <input
                id="lead-email"
                type="email"
                required
                autoComplete="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="lead-note"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                What are you looking for? (optional)
              </label>
              <textarea
                id="lead-note"
                rows={3}
                value={leadNote}
                onChange={(e) => setLeadNote(e.target.value)}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900 outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={leadStatus === "sending"}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {leadStatus === "sending" ? "Sending…" : "Request info"}
            </button>
            {leadStatus === "err" ? (
              <p className="text-sm text-red-600">Could not send. Try again.</p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}

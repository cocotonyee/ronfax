"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import type { FaxStatusPayload } from "@/lib/fax-status-payload";

type Props = {
  sessionId: string | null;
};

const statusFetcher = async (url: string): Promise<FaxStatusPayload> => {
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json()) as FaxStatusPayload & { error?: string };
  if (!r.ok) throw new Error(j.error ?? "Could not load status");
  return j as FaxStatusPayload;
};

export function SuccessExtras({ sessionId }: Props) {
  const [leadEmail, setLeadEmail] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "sending" | "sent" | "err">(
    "idle",
  );

  const statusPath =
    sessionId != null && sessionId.length > 0
      ? `/api/fax-status/${encodeURIComponent(sessionId)}`
      : null;
  const { data: statusData } = useSWR<FaxStatusPayload>(statusPath, statusFetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  /** All progress steps complete with successful delivery — highlights receipt + full-opacity lead. */
  const faxDelivered = statusData?.uiState === "success";
  /** Dim marketing block while transmission is still in progress (not terminal yet). */
  const dimLeadSection =
    statusData == null || statusData.uiState === "pending";

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
        <div
          className={`rounded-2xl border border-blue-100 bg-blue-50/90 p-6 shadow-md transition-all duration-300 ${
            faxDelivered
              ? "ring-2 ring-green-500/35 shadow-lg ring-offset-2 ring-offset-blue-50/90"
              : ""
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Receipt</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Download a PDF receipt for your records.
              </p>
            </div>
            {faxDelivered ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                <span aria-hidden>✓</span> Transmission complete
              </span>
            ) : null}
          </div>
          <a
            href={receiptHref}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-colors duration-200 hover:bg-blue-700"
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            Download Transmission Receipt (PDF)
          </a>
          {faxDelivered ? (
            <p className="mt-3 text-sm font-medium text-green-800">
              Your receipt is ready — keep this PDF for your records.
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={`rounded-2xl border border-primary/20 bg-primary/5 p-6 transition-opacity duration-300 ${
          dimLeadSection ? "opacity-45" : "opacity-100"
        }`}
      >
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

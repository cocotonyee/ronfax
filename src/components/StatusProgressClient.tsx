"use client";

import { useState } from "react";
import { m } from "framer-motion";
import useSWR from "swr";
import type { FaxStatusPayload } from "@/lib/fax-status-payload";

type Props = {
  sessionId: string;
};

const fetcher = async (url: string): Promise<FaxStatusPayload> => {
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json()) as FaxStatusPayload & { error?: string };
  if (!r.ok) throw new Error(j.error ?? "Could not load status");
  return j as FaxStatusPayload;
};

export function StatusProgressClient({ sessionId }: Props) {
  const basePath = `/api/fax-status/${encodeURIComponent(sessionId)}`;
  const { data, error, isLoading, mutate } = useSWR<FaxStatusPayload>(
    basePath,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const [manualRefreshError, setManualRefreshError] = useState<string | null>(
    null,
  );

  const refreshStatus = async () => {
    setManualRefreshError(null);
    try {
      await mutate(
        async () => {
          const r = await fetch(`${basePath}?manual=1`, {
            cache: "no-store",
          });
          const j = (await r.json()) as FaxStatusPayload & { error?: string };
          if (r.status === 429) {
            throw new Error(
              j.error ??
                "Please wait at least 10 seconds before refreshing again.",
            );
          }
          if (!r.ok) throw new Error(j.error ?? "Could not load status");
          return j as FaxStatusPayload;
        },
        { revalidate: false },
      );
    } catch (e) {
      setManualRefreshError(
        e instanceof Error ? e.message : "Could not refresh status",
      );
    }
  };

  if (error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error instanceof Error ? error.message : "Could not load status"}
      </p>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-2 w-full animate-pulse rounded-full bg-zinc-200" />
        <p className="text-center text-sm text-zinc-500">Loading status…</p>
      </div>
    );
  }

  const uploadDone = data.stepUploadToPhaxio;
  const txTerminal = data.stepTransmission;
  /* Until upload reaches Phaxio, step 2 is the active phase (incl. pre-link). */
  const uploadActive = !uploadDone;
  const transmitActive =
    uploadDone && !txTerminal && data.uiState === "pending";

  const pct = data.progressPercent;

  const transmitLabel =
    data.pageCount != null
      ? `Dialing & transmitting · ${data.pageCount} page${data.pageCount === 1 ? "" : "s"}`
      : "Dialing & transmitting";

  const row = (
    emoji: string,
    done: boolean,
    active: boolean,
    label: string,
  ) => (
    <div className="flex items-center gap-3">
      <span className="text-lg leading-none" aria-hidden>
        {emoji}
      </span>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done
            ? "bg-primary text-white"
            : active
              ? "bg-primary/15 text-primary ring-2 ring-primary/40"
              : "bg-zinc-200 text-zinc-500"
        }`}
      >
        {done ? "✓" : active ? "…" : ""}
      </span>
      <span
        className={`text-sm font-medium ${
          done || active ? "text-zinc-900" : "text-zinc-500"
        }`}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <m.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 26 }}
          />
        </div>
        <p className="text-center text-xs text-zinc-500">
          {data?.uiState === "success" || data?.uiState === "failure"
            ? "Final status received"
            : "Load once when you open this page — use Refresh for latest"}
        </p>
      </div>

      <div className="space-y-3 border-l-2 border-primary/25 pl-4">
        {row("🟢", true, false, "Payment verified")}
        {row("🟡", uploadDone, uploadActive, "Uploading to fax network")}
        {row("🔵", txTerminal, transmitActive, transmitLabel)}
      </div>

      {data.faxTo ? (
        <dl className="space-y-1 text-sm text-zinc-700">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">To</dt>
            <dd className="text-right font-medium text-zinc-900">{data.faxTo}</dd>
          </div>
          {data.pageCount != null ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Pages</dt>
              <dd className="text-right">{data.pageCount}</dd>
            </div>
          ) : null}
          {data.amountLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Paid</dt>
              <dd className="text-right">{data.amountLabel}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {data.detail ? (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            data.uiState === "failure"
              ? "bg-red-50 text-red-900"
              : data.uiState === "success"
                ? "bg-primary/10 text-primary"
                : "bg-zinc-50 text-zinc-600"
          }`}
        >
          {data.uiState === "failure" ? "❌ " : null}
          {data.uiState === "success" ? "✅ " : null}
          {data.detail}
        </p>
      ) : null}

      {data.uiState === "success" ? (
        <p className="text-center text-sm font-semibold text-primary">
          Fax delivered successfully.
        </p>
      ) : null}
      {data.uiState === "failure" ? (
        <p className="text-center text-sm font-semibold text-red-700">
          Sending failed — see reason above if provided.
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => void refreshStatus()}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          Refresh Status
        </button>
        {manualRefreshError ? (
          <p className="text-center text-xs text-amber-800">{manualRefreshError}</p>
        ) : null}
      </div>
    </div>
  );
}

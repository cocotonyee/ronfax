import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { getTrackRecord } from "@/lib/fax-track";
import { getPhaxioFax, mapPhaxioToUi } from "@/lib/phaxio-status";
import { formatUsdFromCents } from "@/lib/pricing";
import { PersistLastFaxId } from "@/components/PersistLastFaxId";
import { StatusProgressClient } from "@/components/StatusProgressClient";
import { SuccessExtras } from "@/components/SuccessExtras";

type Props = { params: Promise<{ id: string }> };

export function generateMetadata(): Metadata {
  return {
    title: "Transmission status",
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  };
}

function StatusBadge({ state }: { state: "pending" | "success" | "failure" }) {
  if (state === "success") {
    return (
      <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
        Success
      </span>
    );
  }
  if (state === "failure") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-900">
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
      Pending
    </span>
  );
}

export default async function UnifiedStatusPage({ params }: Props) {
  const { id } = await params;

  if (id.startsWith("cs_")) {
    return (
      <div className="flex flex-1 flex-col items-center bg-surface px-4 py-12">
        <PersistLastFaxId checkoutSessionId={id} />
        <div className="w-full max-w-lg space-y-6 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Fax status
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {APP_NAME}
            </h1>
          </div>
          <StatusProgressClient sessionId={id} />
          <p className="text-xs text-zinc-500">
            Status updates when you open this page or tap Refresh · Valid 24 hours · No login
          </p>
          <Link
            href="/"
            className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Send another fax
          </Link>
        </div>
        <SuccessExtras sessionId={id} />
      </div>
    );
  }

  const rec = await getTrackRecord(id);
  if (!rec) notFound();

  let uiState: "pending" | "success" | "failure" = "pending";
  let detail = "";

  if (rec.deliveryStatus === "failure" || rec.errorMessage) {
    uiState = "failure";
    detail = rec.errorMessage ?? "Transmission failed.";
  } else if (rec.faxId != null) {
    const live = await getPhaxioFax(rec.faxId);
    const st = live?.status ?? rec.phaxioLastStatus;
    uiState = mapPhaxioToUi(st);
    if (live?.error_message) detail = live.error_message;
  } else if (rec.deliveryStatus === "processing") {
    uiState = "pending";
    detail = "Queued for sending…";
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-surface px-4 py-16">
      <div className="w-full max-w-lg space-y-6 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Fax status
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">{APP_NAME}</h1>
          <StatusBadge state={uiState} />
        </div>
        <dl className="space-y-2 text-sm text-zinc-700">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">To</dt>
            <dd className="text-right font-medium text-zinc-900">{rec.faxTo}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Pages</dt>
            <dd className="text-right">{rec.pageCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Paid</dt>
            <dd className="text-right">{formatUsdFromCents(rec.amountCents)}</dd>
          </div>
        </dl>
        {detail ? (
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            {detail}
          </p>
        ) : null}
        <p className="text-xs text-zinc-500">
          This link expires 24 hours after payment. It does not require a login.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Send another fax
        </Link>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { getFaxTrackBySessionId } from "@/lib/fax-tracks-db";
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

export default async function UnifiedStatusPage({ params }: Props) {
  const { id } = await params;

  /** Status reads `fax_tracks` in Supabase by Stripe Checkout session id (`cs_*`). */
  if (!id.startsWith("cs_")) {
    notFound();
  }

  const faxRow = await getFaxTrackBySessionId(id);

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
        {faxRow ? (
          <p className="text-center text-xs text-zinc-500">
            Last known: {faxRow.deliveryStatus}
            {faxRow.faxId != null ? ` · Fax id ${String(faxRow.faxId).slice(0, 12)}…` : ""}
          </p>
        ) : null}
        <p className="text-xs text-zinc-500">
          Status updates when you open this page or tap Refresh · No login
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

export const dynamic = "force-dynamic";

"use client";

import Link from "next/link";
import type { ClinicRecord } from "@/lib/clinic-types";
import { brandInitials } from "@/lib/popular-destinations";

type Props = {
  entries: ClinicRecord[];
};

/** Duplicate for seamless horizontal marquee loop */
export function PopularDestinationsGrid({ entries }: Props) {
  if (entries.length === 0) return null;

  const loop = [...entries, ...entries];

  function DestinationCard({ e }: { e: ClinicRecord }) {
    const label = brandInitials(e.name);
    return (
      <Link
        href={`/?fax=${encodeURIComponent(e.faxDigits)}`}
        scroll={false}
        className="group flex w-[148px] shrink-0 flex-col items-center rounded-2xl border border-zinc-200/90 bg-white px-3 py-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg sm:w-[160px]"
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/12 to-primary/5 text-lg font-bold tracking-tight text-primary shadow-inner ring-1 ring-primary/10"
          aria-hidden
        >
          {label}
        </span>
        <span className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-snug text-zinc-900 group-hover:text-primary">
          {e.name}
        </span>
        {e.category ? (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {e.category}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <div className="relative mt-8 overflow-hidden py-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-surface to-transparent" />
      <div className="flex w-max gap-3 rf-marquee hover:[animation-play-state:paused]">
        {loop.map((e, i) => (
          <DestinationCard key={`${e.slug}-${i}`} e={e} />
        ))}
      </div>
    </div>
  );
}

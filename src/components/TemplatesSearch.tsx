"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClinicRecord } from "@/lib/clinic-types";

export function TemplatesSearch({ clinics }: { clinics: ClinicRecord[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return clinics;
    const s = q.toLowerCase();
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.city.toLowerCase().includes(s) ||
        c.state.toLowerCase().includes(s) ||
        c.slug.includes(s) ||
        (c.category ?? "").toLowerCase().includes(s),
    );
  }, [clinics, q]);

  return (
    <div className="w-full">
      <label className="sr-only" htmlFor="inst-search">
        Search institutions
      </label>
      <input
        id="inst-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, city, state, or category…"
        className="mx-auto block w-full max-w-3xl rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-zinc-900 shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 lg:max-w-xl"
      />
      <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <li className="col-span-full rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-600">
            No matches. Try another search.
          </li>
        ) : (
          filtered.map((c) => (
            <li key={c.slug} className="min-w-0">
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
                <Link
                  href={`/templates/${c.slug}`}
                  className="min-w-0 group flex-1"
                >
                  <p className="font-semibold leading-snug text-zinc-900 group-hover:text-primary">
                    {c.name}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                    {c.city}, {c.state}
                    {c.category ? ` · ${c.category}` : ""}
                  </p>
                </Link>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link
                    href={`/?fax=${encodeURIComponent(c.faxDigits)}`}
                    scroll={false}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-semibold leading-tight text-white shadow-sm transition hover:bg-primary/90 sm:flex-none"
                  >
                    Send fax to this clinic
                  </Link>
                  <Link
                    href={`/fax-to/${c.slug}`}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-primary/40 hover:bg-primary/5 sm:flex-none"
                  >
                    Profile
                  </Link>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

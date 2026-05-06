import Link from "next/link";

/**
 * Tracks blog → checkout attribution via `kw=blog:{slug}` → `fax_tracks.source_keyword`.
 */
export function BlogCta({ blogSlug }: { blogSlug: string }) {
  const kw = encodeURIComponent(`blog:${blogSlug}`);
  return (
    <div className="mt-14 rounded-3xl border-2 border-primary/25 bg-gradient-to-br from-primary/10 via-white to-primary/[0.07] px-6 py-10 text-center shadow-lg shadow-primary/5 sm:px-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Send from anywhere in the US
      </p>
      <p className="mx-auto mt-3 max-w-xl text-lg font-semibold leading-snug text-zinc-900 sm:text-xl">
        Ready to skip the store line? Fax your PDF in minutes—no hardware subscription.
      </p>
      <Link
        href={`/?kw=${kw}#send`}
        className="mt-8 inline-flex w-full max-w-lg items-center justify-center rounded-2xl bg-primary px-8 py-5 text-base font-bold text-white shadow-lg shadow-primary/25 transition hover:opacity-95 sm:text-lg"
      >
        Start Faxing Now - No Account Required
      </Link>
    </div>
  );
}

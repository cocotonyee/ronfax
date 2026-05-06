/**
 * Geo + intent SEO block (homepage). Copy references Google Trends rising themes
 * (US 2026-04-29 — 2026-05-06) — see docs in `src/lib/seo-trends-note.ts`.
 */
export function LocalSEOSection() {
  return (
    <section
      className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-8"
      aria-labelledby="local-seo-heading"
    >
      <div className="rounded-3xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/80 px-6 py-10 shadow-sm sm:px-10">
        <h2
          id="local-seo-heading"
          className="text-center text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl"
        >
          Online fax service — send fax from computer, no store visit
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed text-zinc-700">
          Stop searching for &apos;fax documents near me&apos; at Staples or FedEx.
          RonFax lets you send faxes instantly from any location in the US without
          leaving your home.
        </p>
        <p className="mx-auto mt-5 max-w-3xl text-center text-sm font-medium leading-relaxed text-zinc-800">
          Send faxes via email — just attach your file and we handle the rest. Use
          your secure checkout link after we receive your message (see{" "}
          <a href="/blog/email-to-fax-gmail-outlook-pay-later" className="text-primary underline">
            email-to-fax
          </a>
          ).
        </p>

        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
          <li className="rounded-2xl border border-zinc-100 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Location alternative · Breakout trend
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              No need to find &quot;fax services near me&quot; at UPS or local libraries.
              Use RonFax when you need{" "}
              <strong>where to fax documents near me</strong> solved online — same
              day, no driving.
            </p>
          </li>
          <li className="rounded-2xl border border-zinc-100 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Device · +100% interest
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              <strong>How to send a fax from printer</strong> without a dedicated
              machine? Skip hardware and phone lines — upload a PDF, dial the fax
              number, and pay per send. Works as a <strong>fax app for iPhone</strong>{" "}
              and any browser.
            </p>
          </li>
          <li className="rounded-2xl border border-zinc-100 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Brand comparison · Rising searches
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              Looking for <strong>Cocofax</strong> or <strong>FaxZero</strong>? Try
              RonFax for a simpler, faster experience — transparent pay-as-you-go
              pricing for <strong>fax documents near me</strong> without waiting in
              line.
            </p>
          </li>
          <li className="rounded-2xl border border-zinc-100 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Speed · +100% interest
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              Instant document faxing — skip the line at FedEx Office.{" "}
              <strong>Send fax from computer</strong> in minutes; track delivery on
              your status page after checkout.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}

/** FAQ block for /status — targets long-tail printer / near-me intent (visible HTML for UX). */
export function StatusPageFaq() {
  return (
    <section
      className="mx-auto mt-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-zinc-50/80 px-5 py-6 text-left"
      aria-labelledby="status-faq-heading"
    >
      <h2
        id="status-faq-heading"
        className="text-sm font-semibold tracking-tight text-zinc-900"
      >
        Common questions
      </h2>
      <dl className="mt-4 space-y-5">
        <div>
          <dt className="text-sm font-medium text-zinc-800">
            Can I fax without a printer?
          </dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-zinc-600">
            Yes. RonFax is built for people searching &quot;how to send a fax from
            printer&quot; without extra hardware — upload your PDF online, enter the
            destination fax number, and we transmit over the phone network for you. No
            printer or fax machine required.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-800">
            Is there a free fax service near me?
          </dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-zinc-600">
            Physical stores may advertise promotions, but outbound fax almost always
            has a per-page fee. RonFax offers simple pay-as-you-go sending from anywhere
            in the US — no subscription — so you can skip driving to a store for{' '}
            <span className="whitespace-nowrap">&quot;fax documents near me&quot;</span>
            .
          </dd>
        </div>
      </dl>
    </section>
  );
}

const items = [
  "Secure Stripe payments",
  "Files auto-deleted after send",
  "TLS encryption in transit",
];

export function LandingTrustBar() {
  return (
    <div className="w-full border-y border-zinc-200 bg-white py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-sm font-medium text-zinc-800">
        {items.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="text-primary" aria-hidden>
              ✔
            </span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

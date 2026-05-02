/** Minimal grayscale marks — decorative trust cues only (not official certifications). */

export function StripeWordMark({ className }: { className?: string }) {
  return (
    <span
      className={`font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 ${className ?? ""}`}
      title="Payments processed with Stripe"
    >
      Stripe
    </span>
  );
}

export function HipaaBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ${className ?? ""}`}
      title="Designed for HIPAA-aligned handling of PHI in transmission"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 opacity-55 grayscale"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v7.8z"
        />
      </svg>
      HIPAA-ready
    </span>
  );
}

export function SslBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ${className ?? ""}`}
      title="Encrypted in transit (TLS)"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 opacity-55 grayscale"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
        />
      </svg>
      SSL Secure
    </span>
  );
}

export function TrustBadgeRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-y border-zinc-100 py-4">
      <StripeWordMark />
      <HipaaBadge />
      <SslBadge />
    </div>
  );
}

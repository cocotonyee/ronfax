import { Check } from "lucide-react";

const bullets = [
  "No account required",
  "Pay per use, no subscription",
  "HIPAA-compliant security",
] as const;

export function HeroSimplePricing() {
  return (
    <div id="pricing" className="scroll-mt-28 pt-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-600">
        Simple pricing
      </h2>
      <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
        <span className="text-5xl font-extrabold tracking-tight text-primary tabular-nums drop-shadow-[0_1px_24px_rgba(0,156,255,0.28)] sm:text-6xl">
          $1.99
        </span>
        <span className="text-lg font-medium leading-snug text-zinc-700 sm:text-xl">
          per fax (up to 3 pages)
        </span>
      </div>
      <ul className="mt-10 space-y-3.5">
        {bullets.map((text) => (
          <li
            key={text}
            className="flex items-start gap-3 text-[15px] font-semibold leading-snug text-zinc-900"
          >
            <Check
              className="mt-0.5 h-5 w-5 shrink-0 text-[#009cff]"
              strokeWidth={2.5}
              aria-hidden
            />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

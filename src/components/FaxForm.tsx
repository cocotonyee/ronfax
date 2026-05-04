"use client";

import { AnimatePresence, m } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sanitizeFaxFromUrlParam } from "@/lib/fax-url";
import {
  formatUsPhone,
  normalizeUsDigits,
  isValidUsPhoneDigits,
} from "@/lib/phone";
import { useFilePreview } from "@/hooks/use-file-preview";
import {
  formatUsdFromCents,
  getPriceBreakdown,
  priceCentsForPages,
} from "@/lib/pricing";
import { DEV_PHAXIO_TEST_DIGITS } from "@/lib/dev-fax-constants";

/** Inlined by Next.js; dev-only UX must not ship to production bundles as active paths */
const IS_NEXT_DEV = process.env.NODE_ENV === "development";

const SESSION_DEV_SKIP_KEY = "rf_dev_skip_checkout";

const ACCEPT =
  "application/pdf,image/jpeg,image/png,image/jpg,.pdf,.jpg,.jpeg,.png";

function isDocFile(f: File) {
  return /\.(doc|docx)$/i.test(f.name);
}

export type FaxFormProps = {
  /** 10-digit US fax number to pre-fill */
  initialPhoneDigits?: string;
};

function initialPhoneState(d?: string) {
  if (d && isValidUsPhoneDigits(d)) return formatUsPhone(d);
  return "";
}

function StepShell({
  n,
  showConnector,
  highlight,
  children,
}: {
  n: 1 | 2;
  showConnector: boolean;
  /** Guides the eye to the next step (#009cff glow) */
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex w-9 flex-col items-center">
        <m.span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm ${
            highlight ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-white" : ""
          }`}
          animate={
            highlight
              ? {
                  scale: [1, 1.07, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(0,156,255,0.45)",
                    "0 0 0 10px rgba(0,156,255,0)",
                    "0 0 0 0 rgba(0,156,255,0.45)",
                  ],
                }
              : { scale: 1 }
          }
          transition={{
            duration: 2.2,
            repeat: highlight ? Infinity : 0,
            ease: "easeInOut" as const,
          }}
        >
          {n}
        </m.span>
        {showConnector ? (
          <div
            className={`mt-1 w-0.5 flex-1 min-h-[1.25rem] ${
              highlight ? "bg-primary/35" : "bg-primary/20"
            }`}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-2 pb-0.5">{children}</div>
    </div>
  );
}

export function FaxForm({ initialPhoneDigits }: FaxFormProps) {
  const searchParams = useSearchParams();
  const faxFromQuery = useMemo(
    () => sanitizeFaxFromUrlParam(searchParams.get("fax")),
    [searchParams],
  );
  const effectiveUrlDigits = faxFromQuery ?? initialPhoneDigits ?? null;

  const lastAppliedUrlDigits = useRef<string | null>(null);
  const [faxUrlGlow, setFaxUrlGlow] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [phone, setPhone] = useState(() => initialPhoneState(initialPhoneDigits));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<{
    pageCount: number;
    priceLabel: string;
  } | null>(null);
  const [devSkipStripe, setDevSkipStripe] = useState(false);

  const { thumbnail, localPageCount, previewError, rendering } =
    useFilePreview(file);

  useEffect(() => {
    if (!IS_NEXT_DEV) return;
    try {
      const on = sessionStorage.getItem(SESSION_DEV_SKIP_KEY) === "1";
      startTransition(() => setDevSkipStripe(on));
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (!effectiveUrlDigits || !isValidUsPhoneDigits(effectiveUrlDigits)) {
      return;
    }
    if (lastAppliedUrlDigits.current === effectiveUrlDigits) {
      return;
    }
    lastAppliedUrlDigits.current = effectiveUrlDigits;
    setPhone(formatUsPhone(effectiveUrlDigits));
    setFaxUrlGlow(true);
    requestAnimationFrame(() => {
      document.getElementById("fax-num")?.focus();
    });
    const t = window.setTimeout(() => setFaxUrlGlow(false), 2200);
    return () => window.clearTimeout(t);
  }, [effectiveUrlDigits]);

  const estimated = useMemo(() => {
    if (localPageCount == null || localPageCount < 1) return null;
    const cents = priceCentsForPages(localPageCount);
    return formatUsdFromCents(cents);
  }, [localPageCount]);

  const breakdown = useMemo(() => {
    if (localPageCount == null || localPageCount < 1) return null;
    try {
      return getPriceBreakdown(localPageCount);
    } catch {
      return null;
    }
  }, [localPageCount]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const pickFile = useCallback((f: File | undefined) => {
    if (!f) return;
    if (isDocFile(f)) {
      setError("Save Word documents as PDF, then upload.");
      return;
    }
    const lower = f.name.toLowerCase();
    const okType =
      f.type === "application/pdf" ||
      f.type.startsWith("image/") ||
      /\.(pdf|jpe?g|png)$/i.test(lower);
    if (okType) {
      setFile(f);
      setQuote(null);
      setError(null);
    } else {
      setError("PDF, JPG, or PNG · max 8 MB.");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      pickFile(e.dataTransfer.files[0]);
    },
    [pickFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      pickFile(e.target.files?.[0]);
    },
    [pickFile],
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setQuote(null);
  }, []);

  const launch = async () => {
    setError(null);
    const digits = normalizeUsDigits(phone);
    if (!isValidUsPhoneDigits(digits)) {
      setError("Enter a valid 10-digit US or Canada fax number.");
      return;
    }
    if (!file) {
      setError("Upload your PDF.");
      return;
    }

    setLoading(true);
    setQuote(null);
    try {
      const up = new FormData();
      up.append("file", file);
      const r1 = await fetch("/api/upload", { method: "POST", body: up });
      const j1 = (await r1.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!r1.ok) {
        const fromApi =
          typeof j1.error === "string" && j1.error.length > 0
            ? j1.error
            : typeof j1.detail === "string" && j1.detail.length > 0
              ? j1.detail
              : null;
        throw new Error(
          fromApi ?? `Upload failed (HTTP ${r1.status} ${r1.statusText || ""})`,
        );
      }

      const blobPathname = (j1 as { blobPathname?: string }).blobPathname;
      const blobUrl =
        typeof (j1 as { blobUrl?: string }).blobUrl === "string"
          ? (j1 as { blobUrl: string }).blobUrl
          : undefined;
      const originalFilename = (j1 as { originalFilename?: string })
        .originalFilename;
      const pageCount = (j1 as { pageCount?: number }).pageCount;
      const priceLabel = (j1 as { priceLabel?: string }).priceLabel;

      if (!blobPathname) {
        throw new Error(
          "Upload response was incomplete (missing blob path). Check server logs.",
        );
      }

      if (typeof pageCount === "number" && typeof priceLabel === "string") {
        setQuote({ pageCount, priceLabel });
      }

      const payloadCheckout = {
        blobPathname,
        ...(blobUrl ? { blobUrl } : {}),
        faxNumber: phone,
        originalFilename:
          typeof originalFilename === "string" ? originalFilename : file.name,
      };

      /** Production builds never take this branch — payment is always via Stripe Checkout */
      if (IS_NEXT_DEV && devSkipStripe) {
        const rSkip = await fetch("/api/dev/skip-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadCheckout),
        });
        const rawSkip = await rSkip.text();
        let jSkip: {
          error?: string;
          hint?: string;
          redirectUrl?: string;
          phaxioError?: string;
        } = {};
        try {
          jSkip = JSON.parse(rawSkip) as typeof jSkip;
        } catch {
          jSkip = { error: rawSkip.slice(0, 300) || `HTTP ${rSkip.status}` };
        }
        if (!rSkip.ok) {
          const parts = [
            typeof jSkip.error === "string" ? jSkip.error : null,
            typeof jSkip.hint === "string" ? jSkip.hint : null,
          ].filter(Boolean);
          throw new Error(
            parts.length > 0
              ? parts.join(" — ")
              : `Dev bypass failed (HTTP ${rSkip.status})`,
          );
        }
        const redirectUrl =
          typeof jSkip.redirectUrl === "string" ? jSkip.redirectUrl : "";
        if (!redirectUrl) throw new Error("Dev bypass missing redirect URL");
        if (typeof jSkip.phaxioError === "string") {
          console.warn("[RonFax dev] Phaxio reported:", jSkip.phaxioError);
        }
        window.location.href = redirectUrl;
        return;
      }

      const r2 = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadCheckout),
      });
      const j2 = await r2.json().catch(() => ({}));
      if (!r2.ok) {
        throw new Error(
          typeof j2.error === "string" ? j2.error : "Checkout failed",
        );
      }
      const url = (j2 as { url?: string }).url;
      if (!url) throw new Error("Checkout failed");

      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  const overlayMessage =
    loading && quote && !(IS_NEXT_DEV && devSkipStripe)
      ? "Preparing your secure checkout…"
      : loading && quote && IS_NEXT_DEV && devSkipStripe
        ? "Sending your fax…"
        : loading
          ? "Uploading your document…"
          : "";

  const ctaLabel =
    loading
      ? IS_NEXT_DEV && devSkipStripe
        ? quote
          ? `Sending (dev bypass) · ${quote.priceLabel}`
          : "Sending fax (dev bypass)…"
        : quote
          ? `Continue to pay ${quote.priceLabel}`
          : "Securing…"
      : IS_NEXT_DEV && devSkipStripe
        ? "Send fax (skip Stripe)"
        : "Send Fax Securely";

  const fillDevTestPayload = async () => {
    if (!IS_NEXT_DEV) return;
    setError(null);
    setPhone(formatUsPhone(DEV_PHAXIO_TEST_DIGITS));
    try {
      const r = await fetch("/dev-dummy.pdf", { cache: "no-store" });
      if (!r.ok)
        throw new Error("Dummy PDF missing — ensure public/dev-dummy.pdf exists");
      const blob = await r.blob();
      pickFile(new File([blob], "ronfax-dev-dummy.pdf", { type: "application/pdf" }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load dev dummy PDF",
      );
    }
  };

  const digits = normalizeUsDigits(phone);
  const step1Done = isValidUsPhoneDigits(digits);
  const step2Guide = step1Done && !file;

  return (
    <div className="relative w-full">
      <AnimatePresence>
        {loading ? (
          <m.div
            key="checkout-overlay"
            role="status"
            aria-live="polite"
            aria-busy="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-white/65 px-4 backdrop-blur-[3px]"
          >
            <m.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: 0.05 }}
              className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white/95 px-8 py-7 text-center shadow-xl"
            >
              <svg
                className="h-9 w-9 animate-spin text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm font-medium text-zinc-800">{overlayMessage}</p>
              <p className="text-xs leading-relaxed text-zinc-500">
                Secure payment · Encrypted connection
              </p>
            </m.div>
          </m.div>
        ) : null}
      </AnimatePresence>
      <m.div
        id="send"
        className="relative rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-2xl sm:p-6"
        whileHover={{
          y: -5,
          transition: { duration: 0.2, ease: "easeOut" as const },
        }}
      >
        {IS_NEXT_DEV ? (
          <span
            className="pointer-events-none absolute right-4 top-3 z-[2] rounded-md bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-amber-950 shadow-sm ring-1 ring-amber-700/35"
            title="NEXT_PUBLIC_* still uses dev server; Stripe only skipped when checkbox is enabled"
          >
            Test Mode Active
          </span>
        ) : null}
        <div className={`space-y-4 ${IS_NEXT_DEV ? "pt-6 sm:pt-7" : ""}`}>
          {IS_NEXT_DEV ? (
            <div className="relative rounded-xl border border-dashed border-amber-400/70 bg-gradient-to-br from-amber-50 to-amber-100/70 p-3 pb-10 text-[13px] text-amber-950 shadow-inner">
              <label className="flex cursor-pointer select-none flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-amber-500 text-primary focus:ring-primary"
                  checked={devSkipStripe}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDevSkipStripe(on);
                    try {
                      sessionStorage.setItem(
                        SESSION_DEV_SKIP_KEY,
                        on ? "1" : "0",
                      );
                    } catch {
                      /* noop */
                    }
                  }}
                />
                <span className="font-semibold leading-snug">
                  Skip Stripe checkout — POST to{" "}
                  <code className="rounded bg-amber-900/15 px-1 py-px text-[11px]">
                    /api/dev/skip-checkout
                  </code>{" "}
                  (Phaxio + Supabase tracking only).
                </span>
              </label>
              <p className="mt-2 max-w-[90%] text-[11px] leading-relaxed opacity-95">
                Dev-only endpoint; 404 in production builds. Requires working
                Phaxio + Supabase.
              </p>
              <button
                type="button"
                title="Dev: Fill (208) 867-5309 + upload dummy PDF"
                aria-label="Development only: auto-fill Phaxio test fax and upload dummy PDF"
                onClick={() => void fillDevTestPayload()}
                className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-amber-800/25 bg-white/65 text-[11px] font-bold text-amber-900/65 opacity-[0.16] hover:opacity-100 focus-visible:z-40 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                ⚡
              </button>
            </div>
          ) : null}
          <StepShell n={1} showConnector={true} highlight={false}>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Recipient fax number
              </h3>
              <div className="mt-3 flex gap-3">
                <m.div
                  className="min-w-0 flex-1"
                  animate={
                    faxUrlGlow
                      ? {
                          boxShadow: [
                            "0 0 0 0 rgba(0,156,255,0)",
                            "0 0 0 3px rgba(0,156,255,0.45)",
                            "0 0 0 2px rgba(0,156,255,0.2)",
                            "0 0 0 0 rgba(0,156,255,0)",
                          ],
                        }
                      : { boxShadow: "0 0 0 0 rgba(0,156,255,0)" }
                  }
                  transition={{ duration: 1.35, ease: "easeOut" as const }}
                >
                  <div className="flex h-14 overflow-hidden rounded-xl border-2 border-zinc-200 bg-white transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                    <span
                      className="flex shrink-0 items-center border-r border-zinc-200 bg-zinc-100 px-3 text-sm font-semibold tabular-nums text-zinc-400 select-none"
                      aria-hidden
                    >
                      +1
                    </span>
                    <input
                      id="fax-num"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(e) => {
                        const d = normalizeUsDigits(e.target.value);
                        setPhone(
                          d.length > 0 ? formatUsPhone(d) : "",
                        );
                      }}
                      className="min-w-0 flex-1 border-0 bg-transparent px-3 text-lg font-medium text-zinc-900 outline-none"
                      aria-label="10-digit fax number, country code +1"
                      aria-describedby="fax-num-hint"
                    />
                  </div>
                </m.div>
              </div>
              <p
                id="fax-num-hint"
                className="mt-2 text-xs leading-relaxed text-zinc-500"
              >
                Confirm this fax number with your recipient or an official
                source before sending.
              </p>
            </div>
          </StepShell>

          <StepShell n={2} showConnector={false} highlight={step2Guide}>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Upload document
              </h3>
              {!file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      document.getElementById("fax-upload-input")?.click();
                    }
                  }}
                  className="mt-2 flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-surface/80 px-4 py-7 text-center transition hover:border-primary/50 hover:bg-white"
                >
                  <input
                    id="fax-upload-input"
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={onFileChange}
                  />
                  <svg
                    className="mb-3 h-11 w-11 text-zinc-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <label htmlFor="fax-upload-input" className="cursor-pointer">
                    <span className="text-base font-semibold text-zinc-900">
                      Drag & drop your PDF here
                    </span>
                    <span className="mt-1 block text-sm text-zinc-600">
                      or click to browse · max 8 MB
                    </span>
                  </label>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-zinc-200 bg-surface/50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="mx-auto max-h-36 w-full max-w-[160px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnail}
                          alt=""
                          className="max-h-36 w-full object-contain"
                        />
                      ) : rendering ? (
                        <div className="flex h-28 items-center justify-center text-xs text-zinc-500">
                          Loading preview…
                        </div>
                      ) : previewError ? (
                        <div className="flex h-28 items-center justify-center text-xs text-zinc-500">
                          Preview N/A
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-zinc-900">
                        {file.name}
                      </p>
                      {localPageCount != null && estimated ? (
                        <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-zinc-900">
                          Detected {localPageCount}{" "}
                          {localPageCount === 1 ? "page" : "pages"} — Price:{" "}
                          {estimated}
                        </p>
                      ) : localPageCount != null ? (
                        <p className="mt-2 text-sm text-zinc-700">
                          {localPageCount} page
                          {localPageCount === 1 ? "" : "s"}
                        </p>
                      ) : null}
                      <div className="mt-2 flex gap-3">
                        <label
                          htmlFor="fax-upload-replace"
                          className="cursor-pointer text-sm font-semibold text-primary hover:underline"
                        >
                          Replace
                        </label>
                        <input
                          id="fax-upload-replace"
                          type="file"
                          accept={ACCEPT}
                          className="sr-only"
                          onChange={onFileChange}
                        />
                        <button
                          type="button"
                          onClick={clearFile}
                          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </StepShell>
        </div>

        {breakdown ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-surface/80 p-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Price before checkout
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-800">
              {breakdown.lines.map((line, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-4 border-b border-zinc-200/80 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-zinc-600">{line.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-zinc-900">
                    {formatUsdFromCents(line.amountCents)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-4 pt-1 font-semibold text-zinc-900">
                <span>Total due</span>
                <span className="tabular-nums">
                  {formatUsdFromCents(breakdown.totalCents)}
                </span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              First 3 pages:{" "}
              <span className="font-semibold text-primary">$1.99</span> · Each
              extra page: $0.50 · No subscription
            </p>
          </div>
        ) : (
          <p className="mt-3 text-center text-sm text-zinc-800">
            <span className="font-bold text-primary">$1.99</span> for up to 3
            pages · $0.50 per extra page · No subscription
          </p>
        )}

        {error ? (
          <p className="mt-3 text-center text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void launch()}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <svg
              className="h-5 w-5 shrink-0 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle
                className="opacity-30"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          )}
          {ctaLabel}
        </button>
      </m.div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FaxStatusPayload } from "@/lib/fax-status-payload";
import { readLastFaxIdFromStorage } from "@/components/PersistLastFaxId";
import {
  CHECK_STATUS_LABEL,
  type SmartSupportFaqEntry,
  SMART_SUPPORT_FAQ,
} from "@/lib/smart-support-knowledge";

const TYPING_MS = 800;
const FAB_PX = 56;
/** Auto-advance carousel while quick replies visible */
const ROTATE_MS = 5000;
/** After an answer lands, idle this long → reset carousel with a fresher batch */
const IDLE_RESUME_MS = 30_000;
/** Button block – three equal rows avoids layout shifts */
const CHIP_MIN_H =
  "flex min-h-[3.35rem] w-full shrink-0 items-center justify-start text-left py-3 px-3";
/** Total column height ~ three chips + gaps */
const REPLIES_COL_MIN_H = "min-h-[11.95rem]";
const IDLE_SKIP = 3;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rf-support-dot h-1.5 w-1.5 rounded-full bg-zinc-400"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

function isFaxPayload(v: unknown): v is FaxStatusPayload {
  if (!v || typeof v !== "object") return false;
  return (
    "uiState" in v &&
    typeof (v as FaxStatusPayload).uiState === "string" &&
    "linked" in v
  );
}

function assistantStatusLabel(data: FaxStatusPayload): string {
  if (!data.linked) return "being prepared";
  if (data.uiState === "failure") return "failed";
  if (data.uiState === "success") return "complete";
  if (!data.stepUploadToPhaxio) return "uploading";
  return "in progress";
}

/** Stripe Checkout session id from `/status/cs_…` URL */
function checkoutSessionFromPath(pathname: string | null): string | null {
  if (!pathname?.startsWith("/status/cs_")) return null;
  const seg = pathname.slice("/status/".length).split(/[?#/]/)[0];
  return seg?.startsWith("cs_") ? seg : null;
}

/** Consecutive FAQs on a ring starting at tick (length `count`). */
function faqSlotsForTick(
  tick: number,
  count: number,
): SmartSupportFaqEntry[] {
  const n = SMART_SUPPORT_FAQ.length;
  if (n === 0) return [];
  const slots: SmartSupportFaqEntry[] = [];
  for (let i = 0; i < count; i++)
    slots.push(SMART_SUPPORT_FAQ[(tick + i) % n]);
  return slots;
}

const NO_FAX_REPLY =
  "You haven't sent a fax in this session yet. Upload a file to start!";

export function SmartSupport() {
  const pathname = usePathname();
  const dialogId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const replyAbortRef = useRef<AbortController | null>(null);
  const idleResumeRef = useRef<number | null>(null);

  /** Recent fax hint: localStorage cs_* or browsing a status URL */
  const [hasPinnedStatus, setHasPinnedStatus] = useState(false);
  const [open, setOpen] = useState(false);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [botReply, setBotReply] = useState<string | null>(null);
  const [showChips, setShowChips] = useState(true);
  const [statusSessionId, setStatusSessionId] = useState<string | null>(null);
  const [rotationTick, setRotationTick] = useState(0);

  /** True while carousel should tick (paused as soon as a chip fires) */
  const [rotationSuspended, setRotationSuspended] = useState(false);

  const resetThreadCore = useCallback(() => {
    replyAbortRef.current?.abort();
    replyAbortRef.current = null;
    setPickedLabel(null);
    setBotReply(null);
    setIsTyping(false);
    setShowChips(true);
    setStatusSessionId(null);
    setRotationSuspended(false);
  }, []);

  const clearIdleResume = () => {
    if (idleResumeRef.current != null) {
      window.clearTimeout(idleResumeRef.current);
      idleResumeRef.current = null;
    }
  };

  /** Hydrate status chip + subscribe to PersistLastFaxId events */
  useEffect(() => {
    const sync = () => {
      setHasPinnedStatus(
        Boolean(
          readLastFaxIdFromStorage() ??
            checkoutSessionFromPath(pathname ?? null),
        ),
      );
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rf-last-fax-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rf-last-fax-updated", sync);
    };
  }, [pathname]);

  const rotatingCount = hasPinnedStatus ? 2 : 3;
  const visibleSlots = useMemo(
    () => faqSlotsForTick(rotationTick, rotatingCount),
    [rotationTick, rotatingCount],
  );

  const closePanel = useCallback(() => {
    clearIdleResume();
    replyAbortRef.current?.abort();
    replyAbortRef.current = null;
    setOpen(false);
    setIsTyping(false);
    setRotationSuspended(false);
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
    clearIdleResume();
    startTransition(() => {
      queueMicrotask(() => closeBtnRef.current?.focus());
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePanel]);

  useEffect(() => {
    return () => {
      replyAbortRef.current?.abort();
      clearIdleResume();
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, pickedLabel, isTyping, botReply, showChips, visibleSlots]);

  /** Carousel: advance every 5s while quick replies are idle on screen */
  useEffect(() => {
    if (!open || !showChips || rotationSuspended || isTyping) return;

    const id = window.setInterval(() => {
      setRotationTick((t) => t + rotatingCount);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [open, showChips, rotationSuspended, isTyping, rotatingCount]);

  /** After an answered thread sits idle → reset carousel with a farther tick */
  useEffect(() => {
    clearIdleResume();
    if (!open || !pickedLabel || showChips || isTyping || !botReply)
      return;
    idleResumeRef.current = window.setTimeout(() => {
      idleResumeRef.current = null;
      setRotationTick((t) => t + IDLE_SKIP);
      resetThreadCore();
    }, IDLE_RESUME_MS);
    return () => clearIdleResume();
  }, [open, pickedLabel, showChips, isTyping, botReply, resetThreadCore]);

  const abortPreviousReply = () => {
    replyAbortRef.current?.abort();
    const c = new AbortController();
    replyAbortRef.current = c;
    return c;
  };

  const replyWithTyping = async (produceAnswer: () => Promise<string>) => {
    const ac = abortPreviousReply();
    setBotReply(null);
    setShowChips(false);
    setIsTyping(true);
    setRotationSuspended(true);
    clearIdleResume();

    try {
      const [, text] = await Promise.all([
        delay(TYPING_MS),
        produceAnswer(),
      ]);
      if (ac.signal.aborted) return;
      setIsTyping(false);
      setBotReply(text);
    } catch (e) {
      if (ac.signal.aborted || (e instanceof Error && e.name === "AbortError"))
        return;
      setIsTyping(false);
      setBotReply(
        "Something went wrong fetching that reply. Try again or view the FAQ on the homepage.",
      );
    }
  };

  const handleFaqPick = (item: SmartSupportFaqEntry) => {
    if (isTyping) return;
    setStatusSessionId(null);
    setPickedLabel(item.label);
    setRotationSuspended(true);
    clearIdleResume();
    void replyWithTyping(async () => item.answer);
  };

  const handleStatus = () => {
    if (isTyping) return;
    setPickedLabel(CHECK_STATUS_LABEL);
    setRotationSuspended(true);
    clearIdleResume();
    const ac = abortPreviousReply();

    setBotReply(null);
    setShowChips(false);
    setIsTyping(true);

    void (async () => {
      try {
        const [, sessionId] = await Promise.all([
          delay(TYPING_MS),
          Promise.resolve(
            readLastFaxIdFromStorage() ??
              checkoutSessionFromPath(pathname),
          ),
        ]);
        if (ac.signal.aborted) return;

        if (!sessionId || !sessionId.startsWith("cs_")) {
          setIsTyping(false);
          setStatusSessionId(null);
          setBotReply(NO_FAX_REPLY);
          return;
        }

        const r = await fetch(
          `/api/fax-status/${encodeURIComponent(sessionId)}`,
          { cache: "no-store", signal: ac.signal },
        );
        const json: unknown = await r.json();

        if (ac.signal.aborted) return;
        setIsTyping(false);
        setStatusSessionId(sessionId);

        if (!r.ok || !isFaxPayload(json)) {
          setBotReply(
            `Your last fax (ID: ${sessionId}) — we couldn't load the latest status. You can still open your status page.`,
          );
          return;
        }

        const label = assistantStatusLabel(json);
        setBotReply(
          `Your last fax (ID: ${sessionId}) is ${label}. You can also see it on your status page.`,
        );
      } catch (e) {
        if (ac.signal.aborted || (e instanceof Error && e.name === "AbortError"))
          return;
        const sid =
          readLastFaxIdFromStorage() ??
          checkoutSessionFromPath(pathname) ??
          null;
        setIsTyping(false);
        if (sid) setStatusSessionId(sid);
        setBotReply(
          sid != null
            ? `Your last fax (ID: ${sid}) — we couldn't load the latest status. You can still open your status page.`
            : NO_FAX_REPLY,
        );
      }
    })();
  };

  const resetThread = () => {
    clearIdleResume();
    resetThreadCore();
  };

  const chipClass = `${CHIP_MIN_H} rounded-xl bg-[#009cff] text-[13px] font-semibold leading-snug text-white shadow-md transition hover:brightness-105 active:brightness-95 disabled:opacity-50`;

  const anchorClass =
    "pointer-events-none fixed right-4 z-50 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 max-md:bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] bottom-8 md:right-8";

  const cta = (
    <p className="border-t border-white/45 pt-3 text-[13px] leading-relaxed text-zinc-700">
      {pathname === "/" ? (
        <>
          Ready to fax?{" "}
          <a
            href="#send"
            className="font-semibold text-[#009cff] underline-offset-4 hover:text-[#009cff] hover:underline"
          >
            Upload above
          </a>
          .
        </>
      ) : (
        <>
          <Link
            href="/#send"
            className="font-semibold text-[#009cff] underline-offset-4 hover:underline"
          >
            Jump to upload
          </Link>{" "}
          on the homepage.
        </>
      )}
    </p>
  );

  const toggleFab = () => {
    if (open) closePanel();
    else openPanel();
  };

  const panelWidthClass = "w-[90vw] sm:w-80 max-w-[20rem]";

  return (
    <>
      <AnimatePresence>
        {open ? (
          <m.div
            key="rf-ss-backdrop"
            className="fixed inset-0 z-40 cursor-default bg-black/30 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden
            onClick={() => closePanel()}
          />
        ) : null}
      </AnimatePresence>

      <div className={anchorClass}>
        <AnimatePresence mode="sync">
          {open ? (
            <m.section
              key="rf-ss-panel"
              id={dialogId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${dialogId}-title`}
              layout
              className={`pointer-events-auto rounded-2xl border border-white/55 bg-white/90 px-4 pb-4 pt-3 shadow-2xl backdrop-blur-xl ${panelWidthClass}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 border-b border-zinc-200/80 pb-2">
                <div className="min-w-0">
                  <p
                    id={`${dialogId}-title`}
                    className="truncate text-sm font-semibold text-zinc-900"
                  >
                    RonFax Assistant
                  </p>
                  <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[#009cff]">
                    Smart help · quick replies rotate
                  </p>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closePanel}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-900/10 hover:text-zinc-900"
                  aria-label="Close assistant"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div
                ref={scrollRef}
                className="mt-3 max-h-[min(340px,calc(100dvh-12rem))] space-y-3 overflow-y-auto overscroll-contain text-sm leading-relaxed text-zinc-800"
              >
                <div className="rounded-2xl bg-zinc-100/90 px-3.5 py-2.5 text-zinc-800">
                  Hi! I&apos;m RonFax Assistant. How can I help you send your
                  fax today?
                </div>

                {pickedLabel ? (
                  <div className="flex justify-end">
                    <span className="max-w-[92%] rounded-2xl bg-[#009cff] px-3.5 py-2 font-semibold text-white">
                      {pickedLabel}
                    </span>
                  </div>
                ) : null}

                {pickedLabel ? (
                  <div className="rounded-2xl border border-zinc-200/90 bg-white/90 px-3.5 py-2 shadow-sm backdrop-blur-sm">
                    {isTyping ? (
                      <>
                        <p className="text-xs font-medium text-zinc-500">
                          typing...
                        </p>
                        <TypingDots />
                      </>
                    ) : botReply ? (
                      <div className="space-y-3">
                        <p>{botReply}</p>
                        {pickedLabel === CHECK_STATUS_LABEL &&
                        statusSessionId ? (
                          <Link
                            href={`/status/${statusSessionId}`}
                            className="inline-flex text-[13px] font-semibold text-[#009cff] underline-offset-4 hover:underline"
                          >
                            Open status page
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showChips && !isTyping ? (
                  <div
                    className={`flex flex-col gap-2 pt-1 ${REPLIES_COL_MIN_H}`}
                    aria-live="polite"
                    aria-label="Quick replies carousel"
                  >
                    {hasPinnedStatus ? (
                      <button
                        type="button"
                        onClick={handleStatus}
                        className={`${chipClass} shrink-0`}
                        disabled={isTyping}
                      >
                        {CHECK_STATUS_LABEL}
                      </button>
                    ) : null}

                    <div
                      className={`relative shrink-0 ${
                        hasPinnedStatus ? "min-h-[7.6rem]" : "min-h-[10.95rem]"
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <m.div
                          key={rotationTick}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -14 }}
                          transition={{
                            duration: 0.28,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="flex flex-col gap-2"
                        >
                          {visibleSlots.map((item) => (
                            <button
                              key={`${rotationTick}-${item.id}`}
                              type="button"
                              onClick={() => handleFaqPick(item)}
                              disabled={isTyping}
                              className={`${chipClass} overflow-hidden`}
                            >
                              <span className="line-clamp-2">{item.label}</span>
                            </button>
                          ))}
                        </m.div>
                      </AnimatePresence>
                    </div>
                  </div>
                ) : botReply && !isTyping ? (
                  <button
                    type="button"
                    onClick={resetThread}
                    className="mt-1 w-full rounded-xl border border-dashed border-zinc-300 py-2 text-xs font-semibold text-zinc-600 transition hover:border-[#009cff]/40 hover:bg-zinc-50 hover:text-[#009cff]"
                  >
                    Ask something else
                  </button>
                ) : null}
              </div>

              {cta}
            </m.section>
          ) : null}
        </AnimatePresence>

        <button
          type="button"
          onClick={toggleFab}
          style={{ width: FAB_PX, height: FAB_PX }}
          className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full bg-[#009cff] text-white shadow-xl ring-[3px] ring-white transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009cff] active:scale-[0.98]"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? dialogId : undefined}
          aria-label={
            open ? "Close RonFax assistant" : "Open RonFax assistant"
          }
        >
          {open ? (
            <X className="h-6 w-6" aria-hidden strokeWidth={2} />
          ) : (
            <MessageSquare className="h-6 w-6" aria-hidden strokeWidth={2} />
          )}
        </button>
      </div>
    </>
  );
}

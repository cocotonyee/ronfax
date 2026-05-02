"use client";

import { useEffect } from "react";
import { PRIMARY } from "@/lib/ui-tokens";

type Props = {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
};

export function LetterTemplateModal({ open, title, body, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 id="template-title" className="text-lg font-semibold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto px-5 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-800">
            {body}
          </pre>
        </div>
        <div className="border-t border-zinc-200 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(body);
            }}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            Copy template
          </button>
        </div>
      </div>
    </div>
  );
}

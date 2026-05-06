"use client";

import { useEffect, useRef } from "react";

const VID_KEY = "rf_blog_vid";

export function BlogViewTracker({ slug }: { slug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    let visitorHash: string | undefined;
    try {
      let v = localStorage.getItem(VID_KEY);
      if (!v) {
        v =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(VID_KEY, v);
      }
      visitorHash = v;
    } catch {
      /* private mode */
    }

    void fetch("/api/blog/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        visitorHash,
        referer: typeof document !== "undefined" ? document.referrer : undefined,
      }),
    }).catch(() => {
      /* non-fatal analytics */
    });
  }, [slug]);

  return null;
}

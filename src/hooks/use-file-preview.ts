"use client";

import { useEffect, useRef, useState } from "react";

export function useFilePreview(file: File | null) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [localPageCount, setLocalPageCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    const lower = file.name.toLowerCase();
    const isPdf =
      file.type === "application/pdf" || lower.endsWith(".pdf");
    const isImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png)$/i.test(lower);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setLocalPageCount(null);
        setThumbnail(null);
        setPreviewError(false);
        setRendering(true);

        try {
          if (isImage && !isPdf) {
            const url = URL.createObjectURL(file);
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            objectUrlRef.current = url;
            setThumbnail(url);
            setLocalPageCount(1);
            setRendering(false);
            return;
          }

          if (!isPdf) {
            if (!cancelled) {
              setPreviewError(true);
              setRendering(false);
            }
            return;
          }

          const pdfjs = await import("pdfjs-dist");
          const { getDocument, GlobalWorkerOptions, version } = pdfjs;
          GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

          const buf = await file.arrayBuffer();
          const data = new Uint8Array(buf);
          const pdf = await getDocument({ data }).promise;
          if (cancelled) return;
          setLocalPageCount(pdf.numPages);

          const page = await pdf.getPage(1);
          const base = 220;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = base / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          if (!canvas.getContext("2d")) {
            if (!cancelled) setPreviewError(true);
            return;
          }
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const task = page.render({ canvas, viewport });
          await task.promise;
          if (cancelled) return;
          setThumbnail(canvas.toDataURL("image/png"));
        } catch {
          if (!cancelled) {
            setPreviewError(true);
            setThumbnail(null);
          }
        } finally {
          if (!cancelled) setRendering(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file]);

  return { thumbnail, localPageCount, previewError, rendering };
}

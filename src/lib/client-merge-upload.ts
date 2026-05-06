/**
 * Browser-only: combine multiple images / PDFs into one PDF for the existing upload pipeline.
 */

import { binarizeImageFileToPngBlob } from "@/lib/client-image-binarize";

const MAX_OUT_BYTES = 8 * 1024 * 1024;

function isPdfFile(f: File) {
  const lower = f.name.toLowerCase();
  return f.type === "application/pdf" || lower.endsWith(".pdf");
}

function isImageFile(f: File) {
  const lower = f.name.toLowerCase();
  return (
    f.type.startsWith("image/") || /\.(jpe?g|png)$/i.test(lower)
  );
}

export async function mergeUploadFilesToPdf(
  files: File[],
): Promise<{ file: File; pageCount: number }> {
  if (files.length === 0) {
    throw new Error("Select at least one file.");
  }

  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();

  for (const f of files) {
    if (isPdfFile(f)) {
      const raw = await f.arrayBuffer();
      const doc = await PDFDocument.load(raw);
      const idx = doc.getPageIndices();
      const pages = await out.copyPages(doc, idx);
      for (const p of pages) out.addPage(p);
      continue;
    }

    if (isImageFile(f)) {
      const pngBlob = await binarizeImageFileToPngBlob(f);
      const ab = await pngBlob.arrayBuffer();
      const u8 = new Uint8Array(ab);
      const embedded = await out.embedPng(u8);
      const page = out.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: embedded.width,
        height: embedded.height,
      });
      continue;
    }

    throw new Error(`Unsupported type: ${f.name}`);
  }

  const bytes = await out.save();
  if (bytes.byteLength > MAX_OUT_BYTES) {
    throw new Error("Merged PDF exceeds 8 MB — remove a file or use a lower resolution.");
  }

  const count = out.getPageCount();
  const merged = new File([new Uint8Array(bytes)], "document-merged.pdf", {
    type: "application/pdf",
  });
  return { file: merged, pageCount: count };
}

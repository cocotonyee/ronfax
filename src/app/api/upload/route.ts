import { NextRequest, NextResponse } from "next/server";
import { imageBufferToPdfBytes } from "@/lib/image-to-pdf";
import { storeUploadPdf } from "@/lib/blob-fax";
import { countPdfPages } from "@/lib/pdf-pages";
import { MISSING_BLOB_TOKEN_HINT } from "@/lib/blob-fax";
import {
  formatUsdFromCents,
  priceCentsForPages,
} from "@/lib/pricing";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      { error: MISSING_BLOB_TOKEN_HINT },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Expected file field" }, { status: 400 });
  }

  const lower = file.name.toLowerCase();

  if (/\.(doc|docx)$/i.test(lower)) {
    return NextResponse.json(
      {
        error:
          "Open your document in Word and save as PDF, then upload the PDF — or use JPG/PNG.",
      },
      { status: 400 },
    );
  }

  const isPdfMime = file.type === "application/pdf";
  const isPdfExt = lower.endsWith(".pdf");
  const isImageMime = file.type.startsWith("image/");
  const isImageExt = /\.(jpe?g|png)$/i.test(lower);

  if (!isPdfMime && !isPdfExt && !isImageMime && !isImageExt) {
    return NextResponse.json(
      { error: "Use PDF, JPG, or PNG (max 8 MB)" },
      { status: 400 },
    );
  }

  let buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 8 MB)" },
      { status: 413 },
    );
  }

  let outName = file.name;
  const treatAsImage = isImageMime || (isImageExt && !isPdfExt);

  if (treatAsImage) {
    try {
      const pdfBytes = await imageBufferToPdfBytes(buf);
      buf = Buffer.from(pdfBytes);
      const base = file.name.replace(/\.[^.]+$/, "") || "document";
      outName = `${base}.pdf`;
    } catch {
      return NextResponse.json(
        { error: "Could not read this image" },
        { status: 400 },
      );
    }
  } else if (isPdfMime && !isPdfExt) {
    outName = `${file.name}.pdf`;
  }

  let pageCount: number;
  try {
    pageCount = await countPdfPages(buf);
  } catch {
    return NextResponse.json(
      { error: "Could not read this PDF (corrupt or password-protected)" },
      { status: 400 },
    );
  }

  if (pageCount < 1) {
    return NextResponse.json({ error: "Document has no pages" }, { status: 400 });
  }

  try {
    const { pathname, url } = await storeUploadPdf(buf, outName);
    const priceCents = priceCentsForPages(pageCount);

    return NextResponse.json({
      blobPathname: pathname,
      blobUrl: url,
      pageCount,
      priceCents,
      priceLabel: formatUsdFromCents(priceCents),
      originalFilename: outName,
    });
  } catch (e) {
    console.error("Blob upload failed", e);
    const raw = e instanceof Error ? e.message : String(e);
    const safe = raw.replace(/\s+/g, " ").trim().slice(0, 220);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: isDev
          ? `Upload failed: ${safe || "unknown error"}`
          : "Upload could not be saved. Common causes: invalid BLOB_READ_WRITE_TOKEN, wrong Vercel project, or Blob store not created. See server logs for details.",
        detail: isDev ? safe : undefined,
      },
      { status: 500 },
    );
  }
}

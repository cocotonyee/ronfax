import { del, head, put } from "@vercel/blob";
import { randomUUID } from "crypto";

/** Returned when `BLOB_READ_WRITE_TOKEN` is unset (shown in FaxForm upload/checkout errors). */
export const MISSING_BLOB_TOKEN_HINT =
  "Blob storage is not configured — add BLOB_READ_WRITE_TOKEN to .env.local (Vercel: Dashboard → Storage → Blob → Copy read/write token). Or run: vercel env pull";

function requireBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN");
  }
  return token;
}

export async function storeUploadPdf(
  buffer: Buffer,
  originalName: string,
): Promise<{ pathname: string; url: string }> {
  const safeStub = originalName.replace(/[^\w.\-]+/g, "_").slice(-80) || "doc.pdf";
  const pathname = `fax-uploads/${randomUUID()}-${safeStub}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    addRandomSuffix: false,
    token: requireBlobToken(),
  });
  return { pathname: blob.pathname, url: blob.url };
}

export async function fetchPdfFromPathname(pathname: string): Promise<{
  buffer: Buffer;
  url: string;
}> {
  const token = requireBlobToken();
  const meta = await head(pathname, { token });
  const res = await fetch(meta.url);
  if (!res.ok) {
    throw new Error(`Failed to download blob (${res.status})`);
  }
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), url: meta.url };
}

export async function deleteFaxBlob(pathname: string): Promise<void> {
  const token = requireBlobToken();
  await del(pathname, { token });
}

export async function storeReplyPdf(
  buffer: Buffer,
  refCode: string,
  phaxioFaxId: number,
): Promise<{ pathname: string; url: string }> {
  const safeRef = refCode.replace(/[^A-Z0-9-]/gi, "").slice(0, 16) || "unknown";
  const pathname = `fax-replies/${safeRef}/${phaxioFaxId}.pdf`;
  const blob = await put(pathname, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/pdf",
    token: requireBlobToken(),
  });
  return { pathname: blob.pathname, url: blob.url };
}

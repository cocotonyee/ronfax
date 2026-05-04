import { del, get, put } from "@vercel/blob";
import { randomUUID } from "crypto";

/** Returned when `BLOB_READ_WRITE_TOKEN` is unset (shown in FaxForm upload/checkout errors). */
export const MISSING_BLOB_TOKEN_HINT =
  "Blob storage is not configured — add BLOB_READ_WRITE_TOKEN to .env.local (Vercel: Dashboard → Storage → Blob → Copy read/write token). Or run: vercel env pull";

/**
 * For **inbound reply** blobs (`fax-replies/…`) only. Outbound user uploads use `public` — see {@link storeUploadPdf}.
 * Set `BLOB_STORE_ACCESS=public` if your store is public-only.
 */
export function blobStoreAccess(): "public" | "private" {
  const v = process.env.BLOB_STORE_ACCESS?.trim().toLowerCase();
  if (v === "public") return "public";
  return "private";
}

/** Vercel Blob `get` access: outbound fax PDFs are stored public so carriers/Phaxio can use the URL if needed. */
function readAccessForPathname(pathname: string): "public" | "private" {
  if (pathname.startsWith("fax-uploads/")) return "public";
  return blobStoreAccess();
}

async function readableStreamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

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
  /** Public so Phaxio (or any poller) can fetch by URL; store must allow public objects. */
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
  const access = readAccessForPathname(pathname);
  const result = await get(pathname, { access, token });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob not found or unreadable: ${pathname}`);
  }
  const buffer = await readableStreamToBuffer(result.stream);
  return { buffer, url: result.blob.url };
}

export async function deleteFaxBlob(pathname: string): Promise<void> {
  const token = requireBlobToken();
  await del(pathname, { token });
}

export async function storeReplyPdf(
  buffer: Buffer,
  refCode: string,
  phaxioFaxId: string | number,
): Promise<{ pathname: string; url: string }> {
  const safeRef = refCode.replace(/[^A-Z0-9-]/gi, "").slice(0, 16) || "unknown";
  const safeFaxId = String(phaxioFaxId).replace(/[^\w-]/g, "_").slice(-80);
  const pathname = `fax-replies/${safeRef}/${safeFaxId}.pdf`;
  const blob = await put(pathname, buffer, {
    access: blobStoreAccess(),
    addRandomSuffix: false,
    contentType: "application/pdf",
    token: requireBlobToken(),
  });
  return { pathname: blob.pathname, url: blob.url };
}

import { del } from "@vercel/blob";
import { getTrackRecord, updateTrackRecord } from "@/lib/fax-track";

/**
 * Deletes a single blob by its full **HTTPS URL** or pathname (Vercel Blob SDK).
 * @see https://vercel.com/docs/vercel-blob/using-blob-sdk#delete-a-blob
 */
export async function deleteBlobFile(url: string): Promise<void> {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return;

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    console.warn("[RonFax] deleteBlobFile: BLOB_READ_WRITE_TOKEN missing");
    return;
  }

  await del(u, { token });
}

/**
 * After outbound fax reaches a terminal Sinch state and notification work is done:
 * removes the uploaded PDF from Blob storage and clears `pdfUrl` on the track row.
 * Swallows errors so callers (e.g. webhooks) always return 200.
 */
export async function cleanupTrackPdfBlobAfterTerminal(
  trackToken: string,
): Promise<void> {
  try {
    const rec = await getTrackRecord(trackToken);
    const rawUrl = rec?.pdfUrl;
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return;

    try {
      await deleteBlobFile(rawUrl);
    } catch (e) {
      console.error("[RonFax] cleanup: deleteBlobFile failed (keeping pdfUrl)", e);
      return;
    }

    try {
      await updateTrackRecord(trackToken, { pdfUrl: null });
    } catch (e) {
      console.error("[RonFax] cleanup: pdfUrl clear failed", e);
    }
  } catch (e) {
    console.error("[RonFax] cleanupTrackPdfBlobAfterTerminal", e);
  }
}

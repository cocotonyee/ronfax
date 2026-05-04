import { del } from "@vercel/blob";
import { getFaxTrackBySessionId, mergePatchFaxTrack } from "@/lib/fax-tracks-db";

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
 * removes the uploaded PDF from Blob storage and clears `pdf_url` on `fax_tracks`.
 */
export async function cleanupTrackPdfBlobAfterTerminal(
  checkoutSessionId: string,
): Promise<void> {
  try {
    const rec = await getFaxTrackBySessionId(checkoutSessionId);
    const rawUrl = rec?.pdfUrl;
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return;

    try {
      await deleteBlobFile(rawUrl);
    } catch (e) {
      console.error("[RonFax] cleanup: deleteBlobFile failed (keeping pdfUrl)", e);
      return;
    }

    try {
      await mergePatchFaxTrack(checkoutSessionId, { pdfUrl: null });
    } catch (e) {
      console.error("[RonFax] cleanup: pdfUrl clear failed", e);
    }
  } catch (e) {
    console.error("[RonFax] cleanupTrackPdfBlobAfterTerminal", e);
  }
}

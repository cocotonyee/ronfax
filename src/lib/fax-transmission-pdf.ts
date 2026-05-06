import { countPdfPages } from "@/lib/pdf-pages";
import { buildCoverPdfBytes } from "@/lib/cover-page-pdf";
import { prependCoverToDocument } from "@/lib/merge-pdf-buffers";

/**
 * Build the PDF bytes actually transmitted to the carrier (document + optional cover).
 */
export async function buildTransmissionPdfBuffer(
  documentBuffer: Buffer,
  metadata: Record<string, string>,
  stripeSessionId: string,
): Promise<{ transmissionBuffer: Buffer; pageCount: number }> {
  if (metadata.cover_enabled !== "1") {
    const pageCount = await countPdfPages(documentBuffer);
    return { transmissionBuffer: documentBuffer, pageCount };
  }

  const coverBytes = await buildCoverPdfBytes({
    recipientName: metadata.cover_recipient ?? "",
    subject: metadata.cover_subject ?? "",
    notes: metadata.cover_notes ?? "",
    reference: stripeSessionId,
  });
  const transmissionBuffer = await prependCoverToDocument(
    Buffer.from(coverBytes),
    documentBuffer,
  );
  const pageCount = await countPdfPages(transmissionBuffer);
  return { transmissionBuffer, pageCount };
}

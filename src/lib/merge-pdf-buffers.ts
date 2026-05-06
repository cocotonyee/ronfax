import { PDFDocument } from "pdf-lib";

/** Concatenate PDFs in order (first = top of result). */
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) {
    throw new Error("mergePdfBuffers: no PDFs");
  }
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const p of pages) {
      out.addPage(p);
    }
  }
  const bytes = await out.save();
  return Buffer.from(bytes);
}

/** Prepend cover bytes before document PDF. */
export async function prependCoverToDocument(
  coverPdf: Buffer,
  documentPdf: Buffer,
): Promise<Buffer> {
  return mergePdfBuffers([coverPdf, documentPdf]);
}

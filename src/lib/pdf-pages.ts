import { PDFDocument } from "pdf-lib";

export async function countPdfPages(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer, {
    ignoreEncryption: true,
  });
  return doc.getPageCount();
}

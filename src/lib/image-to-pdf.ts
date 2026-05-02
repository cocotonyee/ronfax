import { PDFDocument } from "pdf-lib";

export async function imageBufferToPdfBytes(buf: Buffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const u8 = new Uint8Array(buf);
  let embedded;
  try {
    embedded = await pdf.embedJpg(u8);
  } catch {
    embedded = await pdf.embedPng(u8);
  }
  const page = pdf.addPage([embedded.width, embedded.height]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: embedded.width,
    height: embedded.height,
  });
  return pdf.save();
}

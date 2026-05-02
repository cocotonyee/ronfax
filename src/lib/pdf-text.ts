import { PDFParse } from "pdf-parse";

/**
 * Best-effort text for matching RF-XXXX in inbound faxes.
 * Image-only / scanned faxes may return empty text (true OCR not implemented).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return typeof result.text === "string" ? result.text : "";
    } finally {
      await parser.destroy();
    }
  } catch (e) {
    console.warn("[RonFax] extractPdfText failed", e);
    return "";
  }
}

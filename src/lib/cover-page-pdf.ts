import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type CoverPageInput = {
  recipientName: string;
  subject: string;
  notes: string;
  reference?: string;
};

/**
 * Single-page letter-size fax cover (high contrast, simple layout).
 */
export async function buildCoverPdfBytes(
  input: CoverPageInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  page.drawText("FAX COVER SHEET", {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 36;

  const block = (label: string, value: string) => {
    page.drawText(label, {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    const lines = value.trim() ? chunkLines(value, 70) : ["—"];
    let ly = y - 16;
    for (const line of lines.slice(0, 12)) {
      page.drawText(line, {
        x: margin,
        y: ly,
        size: 10,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });
      ly -= 14;
    }
    y = ly - 18;
  };

  block("To / Recipient", input.recipientName);
  block("Subject", input.subject);
  block("Notes / Message", input.notes.slice(0, 900));

  if (input.reference?.trim()) {
    block("Reference", input.reference.trim().slice(0, 120));
  }

  page.drawText(
    "Prepared by RonFax (automated cover page — document follows).",
    {
      x: margin,
      y: margin + 20,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    },
  );

  return pdf.save();
}

function chunkLines(text: string, max: number): string[] {
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paras = t.split("\n");
  const out: string[] = [];
  for (const p of paras) {
    const words = p.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length <= max) {
        cur = cur ? `${cur} ${w}` : w;
      } else {
        if (cur) out.push(cur);
        cur = w.length > max ? w.slice(0, max) : w;
      }
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [""];
}

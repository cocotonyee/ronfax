import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type CoverPageInput = {
  recipientName: string;
  subject: string;
  notes: string;
  reference?: string;
};

/**
 * Single-page letter-size fax cover (clean, high-contrast, fax-friendly).
 */
export async function buildCoverPdfBytes(
  input: CoverPageInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 44;
  const contentW = width - margin * 2;
  let y = height - margin;

  // Header band
  page.drawRectangle({
    x: margin,
    y: y - 52,
    width: contentW,
    height: 52,
    borderWidth: 1,
    borderColor: rgb(0.2, 0.2, 0.2),
    color: rgb(0.97, 0.97, 0.97),
  });
  page.drawText("FAX COVER SHEET", {
    x: margin + 14,
    y: y - 20,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText("RONFAX", {
    x: margin + contentW - 78,
    y: y - 19,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 72;

  const drawSection = (
    label: string,
    value: string,
    opts?: { maxLines?: number; minHeight?: number },
  ) => {
    const maxLines = opts?.maxLines ?? 4;
    const lines = value.trim() ? chunkLines(value, 76) : ["—"];
    const shown = lines.slice(0, maxLines);
    const lineHeight = 14;
    const bodyHeight = Math.max(
      opts?.minHeight ?? 52,
      shown.length * lineHeight + 22,
    );

    page.drawRectangle({
      x: margin,
      y: y - bodyHeight,
      width: contentW,
      height: bodyHeight,
      borderWidth: 1,
      borderColor: rgb(0.78, 0.78, 0.78),
      color: rgb(1, 1, 1),
    });
    page.drawText(label, {
      x: margin + 12,
      y: y - 17,
      size: 10,
      font: fontBold,
      color: rgb(0.22, 0.22, 0.22),
    });

    let lineY = y - 36;
    for (const line of shown) {
      page.drawText(line, {
        x: margin + 12,
        y: lineY,
        size: 10.5,
        font,
        color: rgb(0.06, 0.06, 0.06),
      });
      lineY -= lineHeight;
    }
    y -= bodyHeight + 12;
  };

  drawSection("TO / RECIPIENT", input.recipientName, { maxLines: 2, minHeight: 50 });
  drawSection("SUBJECT", input.subject, { maxLines: 3, minHeight: 56 });
  drawSection("NOTES / MESSAGE", input.notes.slice(0, 1100), {
    maxLines: 20,
    minHeight: 230,
  });

  if (input.reference?.trim()) {
    drawSection("REFERENCE", input.reference.trim().slice(0, 120), {
      maxLines: 2,
      minHeight: 50,
    });
  }

  page.drawText("Prepared by RonFax. The faxed document begins on the next page.", {
    x: margin,
    y: 36,
    size: 8.5,
    font,
    color: rgb(0.38, 0.38, 0.38),
  });

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

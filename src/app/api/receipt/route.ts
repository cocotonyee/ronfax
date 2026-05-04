import { readFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { APP_NAME } from "@/lib/constants";
import { getPriceBreakdown } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** Brand from public/logo.svg — primary #009cff */
const BRAND = rgb(0, 156 / 255, 1);
const BRAND_DEEP = rgb(0, 100 / 255, 204 / 255);
const PANEL = rgb(248 / 255, 250 / 255, 252 / 255);
const BORDER = rgb(226 / 255, 232 / 255, 240 / 255);
const TEXT = rgb(18 / 255, 24 / 255, 38 / 255);
const MUTED = rgb(82 / 255, 88 / 255, 102 / 255);
const ACCENT = rgb(0, 128 / 255, 1);
const MONEY = rgb(0, 140 / 255, 90 / 255);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 612;
const PAGE_H = 792;
const M = 52;
const CONTENT_RIGHT = PAGE_W - M;

async function embedLogoFromSvg(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const sharp = (await import("sharp")).default;
    const svgPath = join(process.cwd(), "public", "logo.svg");
    const svgBuf = await readFile(svgPath);
    const pngBuf = await sharp(svgBuf)
      .resize(96, 96, { fit: "contain" })
      .png()
      .toBuffer();
    return await pdfDoc.embedPng(pngBuf);
  } catch {
    return null;
  }
}

function drawRight(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 404 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Not paid" }, { status: 403 });
  }

  const meta = session.metadata ?? {};
  const faxTo = typeof meta.faxTo === "string" ? meta.faxTo : "—";
  const pageCountRaw = meta.pageCount;
  const pageCount =
    typeof pageCountRaw === "string" ? parseInt(pageCountRaw, 10) : NaN;
  const safePages =
    Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1;

  const breakdown = getPriceBreakdown(safePages);
  const paid = session.amount_total ?? breakdown.totalCents;
  const email =
    session.customer_details?.email ??
    session.customer_email ??
    (typeof meta.contactEmail === "string" ? meta.contactEmail : "—");

  const currency = (session.currency ?? "usd").toUpperCase();
  const paidLabel = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: session.currency ?? "USD",
  }).format(paid / 100);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const headerH = 118;
  const headerBottom = PAGE_H - headerH;

  page.drawRectangle({
    x: 0,
    y: headerBottom,
    width: PAGE_W,
    height: headerH,
    color: BRAND,
    borderWidth: 0,
  });

  const logo = await embedLogoFromSvg(pdfDoc);
  const logoSize = 76;
  const logoLeft = M;
  const logoBottom = headerBottom + (headerH - logoSize) / 2;

  if (logo) {
    page.drawImage(logo, {
      x: logoLeft,
      y: logoBottom,
      width: logoSize,
      height: logoSize,
    });
  } else {
    page.drawRectangle({
      x: logoLeft,
      y: logoBottom,
      width: logoSize,
      height: logoSize,
      color: WHITE,
      opacity: 0.2,
      borderWidth: 0,
    });
    page.drawText("RF", {
      x: logoLeft + 24,
      y: logoBottom + 28,
      size: 22,
      font: fontBold,
      color: WHITE,
    });
  }

  const titleX = logo ? logoLeft + logoSize + 22 : M;
  page.drawText(APP_NAME, {
    x: titleX,
    y: headerBottom + headerH - 52,
    size: 28,
    font: fontBold,
    color: WHITE,
  });
  page.drawText("Payment receipt", {
    x: titleX,
    y: headerBottom + headerH - 78,
    size: 11,
    font,
    color: rgb(0.92, 0.96, 1),
  });

  let y = headerBottom - 36;
  const cardH = 148;

  page.drawRectangle({
    x: M,
    y: y - cardH,
    width: CONTENT_RIGHT - M,
    height: cardH,
    color: PANEL,
    borderColor: BORDER,
    borderWidth: 1,
  });

  const cardInnerLeft = M + 18;
  let cy = y - 28;
  page.drawText("RECEIPT DETAILS", {
    x: cardInnerLeft,
    y: cy,
    size: 8,
    font: fontBold,
    color: MUTED,
  });
  cy -= 26;

  page.drawText("Stripe session", {
    x: cardInnerLeft,
    y: cy,
    size: 10,
    font,
    color: MUTED,
  });
  page.drawText(session.id, {
    x: cardInnerLeft + 118,
    y: cy,
    size: 9,
    font,
    color: ACCENT,
  });
  cy -= 20;

  const paidDate = new Date((session.created ?? 0) * 1000);
  page.drawText("Date paid", {
    x: cardInnerLeft,
    y: cy,
    size: 10,
    font,
    color: MUTED,
  });
  page.drawText(
    paidDate.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    {
      x: cardInnerLeft + 118,
      y: cy,
      size: 11,
      font: fontBold,
      color: TEXT,
    },
  );
  cy -= 22;

  page.drawText("Bill to", {
    x: cardInnerLeft,
    y: cy,
    size: 10,
    font,
    color: MUTED,
  });
  const emailShown =
    email.length > 42 ? `${email.slice(0, 40)}…` : email;
  page.drawText(emailShown, {
    x: cardInnerLeft + 118,
    y: cy,
    size: 11,
    font: fontBold,
    color: TEXT,
  });
  cy -= 22;

  page.drawText("Fax destination", {
    x: cardInnerLeft,
    y: cy,
    size: 10,
    font,
    color: MUTED,
  });
  page.drawText(faxTo, {
    x: cardInnerLeft + 118,
    y: cy,
    size: 12,
    font: fontBold,
    color: BRAND_DEEP,
  });

  y = y - cardH - 32;

  const txHead =
    safePages === 1
      ? "Fax transmission · 1 page"
      : `Fax transmission · ${safePages} pages`;

  page.drawText(txHead.toUpperCase(), {
    x: M,
    y: y,
    size: 8,
    font: fontBold,
    color: MUTED,
  });
  y -= 22;

  const rowH = 26;
  const tableTop = y;
  page.drawRectangle({
    x: M,
    y: tableTop - breakdown.lines.length * rowH - 36,
    width: CONTENT_RIGHT - M,
    height: breakdown.lines.length * rowH + 36,
    color: WHITE,
    borderColor: BORDER,
    borderWidth: 1,
  });

  page.drawRectangle({
    x: M,
    y: tableTop - 28,
    width: CONTENT_RIGHT - M,
    height: 28,
    color: rgb(236 / 255, 242 / 255, 252 / 255),
    borderWidth: 0,
  });
  page.drawText("Description", {
    x: M + 14,
    y: tableTop - 18,
    size: 9,
    font: fontBold,
    color: BRAND_DEEP,
  });
  drawRight(page, "Amount", CONTENT_RIGHT - 14, tableTop - 18, fontBold, 9, BRAND_DEEP);

  let ry = tableTop - 44;
  for (const row of breakdown.lines) {
    const amt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(row.amountCents / 100);
    page.drawText(row.label, {
      x: M + 14,
      y: ry,
      size: 10,
      font,
      color: TEXT,
    });
    drawRight(page, amt, CONTENT_RIGHT - 14, ry, font, 10, TEXT);
    ry -= rowH;
  }

  y = tableTop - breakdown.lines.length * rowH - 36 - 28;

  page.drawRectangle({
    x: M,
    y: y - 46,
    width: CONTENT_RIGHT - M,
    height: 46,
    color: rgb(236 / 255, 252 / 255, 244 / 255),
    borderColor: rgb(180 / 255, 230 / 255, 200 / 255),
    borderWidth: 1,
  });
  page.drawText("Total charged", {
    x: M + 16,
    y: y - 28,
    size: 12,
    font: fontBold,
    color: TEXT,
  });
  drawRight(
    page,
    paidLabel,
    CONTENT_RIGHT - 16,
    y - 30,
    fontBold,
    18,
    MONEY,
  );
  page.drawText(`(${currency})`, {
    x: M + 16,
    y: y - 44,
    size: 8,
    font,
    color: MUTED,
  });

  y = y - 46 - 36;

  const disclaimer =
    "Delivery is performed by our fax network partner. This receipt confirms payment only — use your status page for transmission updates.";
  const wrapWidth = CONTENT_RIGHT - M - 8;
  const words = disclaimer.split(/\s+/);
  let line = "";
  let dy = y;
  const discSize = 8;
  const maxW = wrapWidth;

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, discSize) > maxW && line) {
      page.drawText(line, {
        x: M,
        y: dy,
        size: discSize,
        font,
        color: MUTED,
      });
      dy -= 12;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, {
      x: M,
      y: dy,
      size: discSize,
      font,
      color: MUTED,
    });
    dy -= 12;
  }

  dy -= 8;
  page.drawText(`${APP_NAME} · Thank you for your business`, {
    x: M,
    y: dy,
    size: 9,
    font: fontBold,
    color: ACCENT,
  });

  const bytes = await pdfDoc.save();
  const filename = `ronfax-receipt-${sessionId.slice(-12)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { APP_NAME } from "@/lib/constants";
import { getPriceBreakdown } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

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

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 720;
  const left = 48;
  const lineGap = 16;
  const small = 10;
  const body = 11;

  const draw = (t: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? body;
    const f = opts?.bold ? fontBold : font;
    page.drawText(t, {
      x: left,
      y,
      size,
      font: f,
      color: rgb(0.1, 0.1, 0.12),
    });
    y -= opts?.size ? opts.size + 6 : lineGap;
  };

  const txHead =
    safePages === 1
      ? "Fax Transmission - 1 page"
      : `Fax Transmission - ${safePages} pages`;
  draw(`${APP_NAME} — ${txHead}`, { bold: true, size: 18 });
  y -= 8;
  draw(`Session: ${session.id}`, { size: small });
  draw(
    `Date: ${new Date((session.created ?? 0) * 1000).toISOString().slice(0, 10)}`,
    { size: small },
  );
  y -= 8;
  draw("Bill to", { bold: true });
  draw(String(email));
  y -= 8;
  draw("Fax destination", { bold: true });
  draw(faxTo);
  y -= 8;
  draw("Pricing (USD)", { bold: true });
  for (const row of breakdown.lines) {
    const amt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(row.amountCents / 100);
    draw(`${row.label} — ${amt}`);
  }
  draw(`Total charged — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(paid / 100)}`, {
    bold: true,
  });
  y -= 8;
  draw(
    "Delivery is performed by our fax network partner. This receipt confirms payment only.",
    { size: small },
  );

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

import { NextRequest, NextResponse } from "next/server";
import {
  fetchPdfFromPathname,
  MISSING_BLOB_TOKEN_HINT,
} from "@/lib/blob-fax";
import { countPdfPages } from "@/lib/pdf-pages";
import { getPriceBreakdown, priceCentsForPages } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import {
  isValidUsPhoneDigits,
  normalizeUsDigits,
  toE164Us,
} from "@/lib/phone";
import { stashCheckoutSessionMetadata } from "@/lib/checkout-meta-stash";
import { getSiteUrl, isLocalOrLoopbackOrigin } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    blobPathname?: string;
    /** Public Blob URL from upload response — audit trail in Stripe metadata */
    blobUrl?: string;
    faxNumber?: string;
    originalFilename?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const blobPathname = body.blobPathname?.trim();
  const blobUrl =
    typeof body.blobUrl === "string" ? body.blobUrl.trim().slice(0, 500) : "";
  const digits = normalizeUsDigits(body.faxNumber ?? "");
  const originalFilename =
    typeof body.originalFilename === "string"
      ? body.originalFilename
      : "document.pdf";

  if (!blobPathname || !isValidUsPhoneDigits(digits)) {
    return NextResponse.json(
      { error: "Need a PDF upload and valid US fax number" },
      { status: 400 },
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      { error: MISSING_BLOB_TOKEN_HINT },
      { status: 500 },
    );
  }

  /** Same origin as `getSiteUrl()` / Sinch callbacks — must be a public URL in production (not localhost). */
  const appUrl = getSiteUrl();
  if (
    process.env.NODE_ENV === "production" &&
    isLocalOrLoopbackOrigin(appUrl)
  ) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: set NEXT_PUBLIC_APP_URL to your public https origin for Stripe redirects.",
      },
      { status: 500 },
    );
  }

  let buffer: Buffer;
  try {
    const fetched = await fetchPdfFromPathname(blobPathname);
    buffer = fetched.buffer;
  } catch (e) {
    console.error("Checkout blob fetch failed", e);
    return NextResponse.json(
      { error: "Upload expired or missing — please upload again" },
      { status: 400 },
    );
  }

  /** Server-side page count from blob (pdf-lib) — source of truth for pricing. */
  let pageCount: number;
  try {
    pageCount = await countPdfPages(buffer);
  } catch {
    return NextResponse.json(
      { error: "Could not verify PDF on server" },
      { status: 400 },
    );
  }

  const priceCents = priceCentsForPages(pageCount);
  const breakdown = getPriceBreakdown(pageCount);
  const descriptionLines = breakdown.lines
    .map(
      (l) =>
        `${l.label}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(l.amountCents / 100)}`,
    )
    .join(" · ");
  const faxTo = toE164Us(digits);
  const transmissionLabel =
    pageCount === 1
      ? "Fax Transmission - 1 page"
      : `Fax Transmission - ${pageCount} pages`;
  const safeName =
    originalFilename.replace(/[^\w.\-]+/g, "_").slice(-120) || "document.pdf";

  try {
    const stripe = getStripe();
    /** Do not set `customer` or `customer_email` for guest checkout — Stripe shows the email field and the value is read in webhooks from `customer_details.email`. */
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      /** Backup when Stripe webhook/metadata is empty — parsed in webhook if needed */
      client_reference_id: `${digits}::${blobPathname}`.slice(0, 200),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: transmissionLabel,
              description: `${descriptionLines}. Destination ${faxTo}`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/status/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
      metadata: {
        blobPathname: String(blobPathname),
        fileUrl: String(blobUrl || ""),
        faxNumber: String(digits),
        faxTo: String(faxTo),
        pageCount: String(pageCount),
        priceCents: String(priceCents),
        filename: String(safeName),
      },
    });

    const stashOk = await stashCheckoutSessionMetadata(session.id, {
      blobPathname: String(blobPathname),
      fileUrl: String(blobUrl || ""),
      faxNumber: String(digits),
      faxTo: String(faxTo),
      pageCount: String(pageCount),
      priceCents: String(priceCents),
      filename: String(safeName),
      contactName: "",
      contactEmail: "",
    });
    if (!stashOk) {
      console.warn(
        "[checkout] Supabase stash of session metadata failed — webhook will rely on Stripe metadata + retrieve",
      );
    }

    console.log("Payment session created", {
      sessionId: session.id,
      blobPathname,
      hasFileUrl: Boolean(blobUrl),
      faxNumber: digits,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not start checkout" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe checkout error", e);
    return NextResponse.json(
      { error: "Payment provider unavailable" },
      { status: 502 },
    );
  }
}

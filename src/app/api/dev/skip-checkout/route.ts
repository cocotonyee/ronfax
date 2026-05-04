import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cleanupTrackPdfBlobAfterTerminal } from "@/lib/blob";
import { fetchPdfFromPathname, MISSING_BLOB_TOKEN_HINT } from "@/lib/blob-fax";
import { APP_NAME } from "@/lib/constants";
import {
  generateTrackToken,
  linkPhaxioFaxToTrackToken,
  linkStripeSessionToTrackToken,
  saveTrackRecord,
  updateTrackRecord,
} from "@/lib/fax-track";
import { createGuestCheckoutEmail } from "@/lib/guest-checkout-email";
import { countPdfPages } from "@/lib/pdf-pages";
import { priceCentsForPages } from "@/lib/pricing";
import { sendFaxWithPdf } from "@/lib/phaxio";
import { allocateRefCode } from "@/lib/reply-store";
import {
  isValidUsPhoneDigits,
  normalizeUsDigits,
  toE164Us,
} from "@/lib/phone";

export const runtime = "nodejs";

/**
 * DEV ONLY: Mimics Stripe `checkout.session.completed` + webhook send path —
 * skips payment so `/status/cs_…` can be iterated quickly with Phaxio test creds.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    return await handleDevSkipCheckout(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dev skip-checkout] unhandled error", e);
    return NextResponse.json(
      {
        error: `Dev bypass failed: ${msg}`,
        hint:
          "Often Redis (UPSTASH_REDIS_REST_URL / TOKEN), Blob fetch, or Upstash network errors. See terminal logs.",
      },
      { status: 500 },
    );
  }
}

async function handleDevSkipCheckout(req: NextRequest) {
  let body: {
    blobPathname?: string;
    faxNumber?: string;
    originalFilename?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const blobPathname = body.blobPathname?.trim();
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

  let buffer: Buffer;
  let uploadPdfUrl: string | undefined;
  try {
    const fetched = await fetchPdfFromPathname(blobPathname);
    buffer = fetched.buffer;
    uploadPdfUrl = fetched.url;
  } catch (e) {
    console.error("[dev skip-checkout] blob fetch failed", e);
    return NextResponse.json(
      { error: "Upload expired or missing — upload again" },
      { status: 400 },
    );
  }

  let pageCount: number;
  try {
    pageCount = await countPdfPages(buffer);
  } catch (e) {
    console.error("[dev skip-checkout] PDF parse failed", e);
    return NextResponse.json(
      { error: "Could not read PDF on server" },
      { status: 400 },
    );
  }

  if (pageCount < 1) {
    return NextResponse.json({ error: "Document has no pages" }, { status: 400 });
  }

  const paidTotal = priceCentsForPages(pageCount);
  const faxTo = toE164Us(digits);
  const safeName =
    originalFilename.replace(/[^\w.\-]+/g, "_").slice(-120) || "document.pdf";
  /** Looks like Stripe’s `cs_*` ids so `/status` + Redis mapping match production flow */
  const sessionId = `cs_dev_${randomBytes(12).toString("hex")}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  const contactEmail = createGuestCheckoutEmail();
  const contactName = "Dev bypass";

  const token = generateTrackToken();

  const refCode = await allocateRefCode({
    stripeSessionId: sessionId,
    contactEmail,
    contactName,
    faxTo,
    createdAt: Date.now(),
  });

  const trackSaved = await saveTrackRecord(token, {
    stripeSessionId: sessionId,
    refCode: refCode ?? undefined,
    contactEmail,
    contactName,
    faxTo,
    pageCount,
    amountCents: paidTotal,
    faxId: null,
    deliveryStatus: "processing",
    paymentVerified: true,
    linked: false,
    pdfUrl: uploadPdfUrl ?? null,
    updatedAt: Date.now(),
  });

  if (!trackSaved) {
    return NextResponse.json(
      {
        error:
          "Redis not available — UPSTASH_REDIS_REST_* required for tracking /status in dev.",
      },
      { status: 503 },
    );
  }

  const sessionLinked = await linkStripeSessionToTrackToken(sessionId, token);
  if (!sessionLinked) {
    return NextResponse.json(
      {
        error:
          "Redis could not save session→track mapping. Check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (must match your Upstash database).",
      },
      { status: 503 },
    );
  }

  await updateTrackRecord(token, { linked: true, paymentVerified: true });

  const headerText =
    refCode != null ? `${refCode} · ${APP_NAME}`.slice(0, 50) : undefined;

  try {
    const result = await sendFaxWithPdf({
      toE164: faxTo,
      pdf: buffer,
      filename: safeName,
      headerText,
      labels: { ronfax_stripe_session: sessionId },
    });
    const outboundFaxId = result.faxId;
    if (outboundFaxId == null) {
      throw new Error("Sinch Fax API returned no fax id");
    }

    await updateTrackRecord(token, {
      faxId: outboundFaxId,
      deliveryStatus: "sent",
      phaxioLastStatus:
        typeof (result.raw as { status?: string })?.status === "string"
          ? (result.raw as { status: string }).status
          : "submitted",
      linked: true,
      paymentVerified: true,
      progressPercent: 72,
    });
    await linkPhaxioFaxToTrackToken(outboundFaxId, token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fax send failed";
    console.error("[dev skip-checkout] Phaxio send failed", e);
    await updateTrackRecord(token, {
      deliveryStatus: "failure",
      errorMessage: msg,
      linked: true,
      paymentVerified: true,
      progressPercent: 100,
    });
    try {
      await cleanupTrackPdfBlobAfterTerminal(token);
    } catch (blobErr) {
      console.error("[dev skip-checkout] blob cleanup (non-fatal)", blobErr);
    }
    /** Still return redirect so UI can inspect /status failures */
    return NextResponse.json({
      sessionId,
      redirectUrl: appUrl ? `${appUrl}/status/${sessionId}` : `/status/${sessionId}`,
      phaxioError: msg,
      warning:
        "Phaxio rejected or failed — open status page to see error state.",
    });
  }

  return NextResponse.json({
    sessionId,
    redirectUrl: appUrl ? `${appUrl}/status/${sessionId}` : `/status/${sessionId}`,
  });
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { deleteFaxBlob, fetchPdfFromPathname } from "@/lib/blob-fax";
import { APP_NAME, GUEST_CHECKOUT_EMAIL_DOMAIN } from "@/lib/constants";
import {
  generateTrackToken,
  linkStripeSessionToTrackToken,
  saveTrackRecord,
  updateTrackRecord,
} from "@/lib/fax-track";
import { sendTrackingEmail } from "@/lib/mail";
import { countPdfPages } from "@/lib/pdf-pages";
import { priceCentsForPages } from "@/lib/pricing";
import { sendFaxWithPdf } from "@/lib/phaxio";
import {
  allocateRefCode,
  markReplyPaid,
  REPLY_UNLOCK_CENTS,
} from "@/lib/reply-store";
import {
  claimStripeWebhookEvent,
  releaseStripeWebhookEvent,
} from "@/lib/redis";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature error", err);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const claimed = await claimStripeWebhookEvent(event.id);
  if (!claimed) {
    return NextResponse.json({ received: true });
  }

  if (session.metadata?.purpose === "reply_download") {
    const downloadToken = session.metadata?.downloadToken?.trim() ?? "";
    const paid = session.amount_total;
    if (!downloadToken || paid !== REPLY_UNLOCK_CENTS) {
      console.error("Invalid reply_unlock checkout", {
        session: session.id,
        paid,
        hasToken: Boolean(downloadToken),
      });
      return NextResponse.json({ received: true });
    }
    await markReplyPaid(downloadToken);
    return NextResponse.json({ received: true });
  }

  const blobPathname = session.metadata?.blobPathname;
  const faxTo = session.metadata?.faxTo;
  const filename =
    session.metadata?.filename?.replace(/[^\w.\-]+/g, "_") || "document.pdf";
  const contactEmail = session.metadata?.contactEmail?.trim() ?? "";
  const contactName = session.metadata?.contactName?.trim();
  const pageCountMeta = session.metadata?.pageCount;

  if (!blobPathname || !faxTo) {
    console.error("Checkout session missing blob metadata", session.id);
    return NextResponse.json({ received: true });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Missing BLOB_READ_WRITE_TOKEN");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const paidTotal = session.amount_total;
  if (paidTotal == null) {
    console.error("Session missing amount_total", session.id);
    return NextResponse.json({ received: true });
  }

  let buffer: Buffer;
  try {
    const fetched = await fetchPdfFromPathname(blobPathname);
    buffer = fetched.buffer;
  } catch (e) {
    console.error("Webhook blob fetch failed", e);
    await releaseStripeWebhookEvent(event.id);
    return NextResponse.json({ error: "Blob unavailable" }, { status: 500 });
  }

  let pageCount: number;
  try {
    pageCount = await countPdfPages(buffer);
  } catch (e) {
    console.error("Webhook PDF parse failed", e);
    await releaseStripeWebhookEvent(event.id);
    return NextResponse.json({ received: true });
  }

  const expectedCents = priceCentsForPages(pageCount);
  if (paidTotal !== expectedCents) {
    console.error("Paid amount does not match PDF page pricing", {
      sessionId: session.id,
      paidTotal,
      pageCount,
      expectedCents,
    });
    return NextResponse.json({ received: true });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const token = generateTrackToken();
  const trackUrl = appUrl ? `${appUrl}/status/${session.id}` : "";

  const refCode = await allocateRefCode({
    stripeSessionId: session.id,
    contactEmail,
    contactName,
    faxTo,
    createdAt: Date.now(),
  });

  const trackSaved = await saveTrackRecord(token, {
    stripeSessionId: session.id,
    refCode: refCode ?? undefined,
    contactEmail,
    contactName,
    faxTo,
    pageCount:
      typeof pageCountMeta === "string"
        ? parseInt(pageCountMeta, 10) || pageCount
        : pageCount,
    amountCents: paidTotal,
    faxId: null,
    deliveryStatus: "processing",
    updatedAt: Date.now(),
  });

  if (trackSaved) {
    await linkStripeSessionToTrackToken(session.id, token);
  }

  const headerText =
    refCode != null ? `${refCode} · ${APP_NAME}`.slice(0, 50) : undefined;

  let faxIdNum: number | null = null;
  try {
    const result = await sendFaxWithPdf({
      toE164: faxTo,
      pdf: buffer,
      filename,
      headerText,
    });
    faxIdNum = result.faxId;

    if (trackSaved) {
      await updateTrackRecord(token, {
        faxId: faxIdNum,
        deliveryStatus: "submitted",
        phaxioLastStatus: "submitted",
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fax send failed";
    console.error("Phaxio send failed", e);
    if (trackSaved) {
      await updateTrackRecord(token, {
        deliveryStatus: "failure",
        errorMessage: msg,
      });
    }
    if (
      contactEmail &&
      !contactEmail.endsWith(`@${GUEST_CHECKOUT_EMAIL_DOMAIN}`) &&
      trackUrl
    ) {
      await sendTrackingEmail({
        to: contactEmail,
        trackUrl,
        faxTo,
      });
    }
    return NextResponse.json({ received: true });
  }

  try {
    await deleteFaxBlob(blobPathname);
  } catch (e) {
    console.error("Blob delete failed (fax already sent)", e);
  }

  if (
    contactEmail &&
    !contactEmail.endsWith(`@${GUEST_CHECKOUT_EMAIL_DOMAIN}`) &&
    trackSaved &&
    trackUrl
  ) {
    await sendTrackingEmail({
      to: contactEmail,
      trackUrl,
      faxTo,
    });
  }

  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { deleteFaxBlob, fetchPdfFromPathname } from "@/lib/blob-fax";
import { APP_NAME, GUEST_CHECKOUT_EMAIL_DOMAIN } from "@/lib/constants";
import {
  faxSessionRedisKey,
  generateTrackToken,
  linkPhaxioFaxToTrackToken,
  linkStripeSessionToTrackToken,
  saveTrackRecord,
  setFaxSessionSnapshot,
  updateTrackRecord,
} from "@/lib/fax-track";
import { sendTrackingEmail } from "@/lib/mail";
import { countPdfPages } from "@/lib/pdf-pages";
import { priceCentsForPages } from "@/lib/pricing";
import { sendFaxWithPdf, sendFaxWithPublicFileUrl } from "@/lib/phaxio";
import {
  allocateRefCode,
  markReplyPaid,
  REPLY_UNLOCK_CENTS,
} from "@/lib/reply-store";
import {
  claimStripeWebhookEvent,
  releaseStripeWebhookEvent,
} from "@/lib/redis";
import { resolveFaxCheckoutMetadata } from "@/lib/checkout-meta-stash";
import { getStripe } from "@/lib/stripe";
import { isUpstashRedisConfigured } from "@/lib/upstash-redis";

export const runtime = "nodejs";

/** Stripe only POSTs webhooks; reject browser probes without participating in redirects. */
export function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

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

  console.log("🔔 Webhook received:", event.type);

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const rawObject = event.data.object;
  if (
    typeof rawObject !== "object" ||
    rawObject === null ||
    (rawObject as { object?: string }).object !== "checkout.session"
  ) {
    console.error(
      "Stripe webhook: expected checkout.session object, got",
      rawObject,
    );
    return NextResponse.json({ received: true });
  }
  const session: Stripe.Checkout.Session =
    rawObject as Stripe.Checkout.Session;

  console.log("Stripe checkout.session.completed", {
    stripeEventId: event.id,
    sessionId: session.id,
  });

  const claimed = await claimStripeWebhookEvent(event.id);
  if (!claimed) {
    console.log("Stripe webhook: duplicate event (skipped)", event.id);
    return NextResponse.json({ received: true });
  }

  try {
    console.log("Processing Session ID:", session.id);
    console.log("Current Metadata:", session.metadata ?? {});

    console.log(
      "📦 Full Metadata:",
      JSON.stringify(session.metadata ?? {}, null, 2),
    );

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

  const {
    merged: metadata,
    usedStash,
    usedRetrieve,
  } = await resolveFaxCheckoutMetadata(session);
  if (
    Object.keys(session.metadata ?? {}).length === 0 &&
    Object.keys(metadata).length > 0
  ) {
    console.log("Fax metadata recovered (webhook payload empty)", {
      sessionId: session.id,
      usedStash,
      usedRetrieve,
    });
  }

  const blobPathname = metadata.blobPathname?.trim();
  const fileUrlFromStripe = metadata.fileUrl?.trim() ?? "";
  const faxNumberMeta = metadata.faxNumber?.trim() ?? "";
  const faxTo = metadata.faxTo?.trim();
  const filename =
    metadata.filename?.replace(/[^\w.\-]+/g, "_") || "document.pdf";
  const pageCountMeta = metadata.pageCount;

  const emailFromMetadata = metadata.contactEmail?.trim() ?? "";
  const nameFromMetadata = metadata.contactName?.trim() ?? "";
  /** Real email from Checkout — do not use guest placeholders from metadata for new sessions. */
  const emailFromCheckout =
    session.customer_details?.email?.trim() ||
    (typeof session.customer_email === "string" ? session.customer_email.trim() : "") ||
    "";
  const nameFromCheckout = session.customer_details?.name?.trim() ?? "";

  const contactEmail = emailFromCheckout || emailFromMetadata;
  const contactName =
    (nameFromCheckout || nameFromMetadata || "Guest").trim() || "Guest";

  console.log("Stripe metadata parsed (fax checkout)", {
    sessionId: session.id,
    hasBlobPathname: Boolean(blobPathname),
    faxTo: faxTo ?? null,
    hasFileUrl: Boolean(fileUrlFromStripe),
    faxNumber: faxNumberMeta || null,
    filename,
    hasPayerEmail: Boolean(emailFromCheckout),
  });

  if (!blobPathname || !faxTo) {
    console.error(
      "Checkout session missing required metadata (blobPathname / faxTo)",
      {
        sessionId: session.id,
        metadataKeys: Object.keys(metadata),
        hint:
          "If this cs_* id is NOT the one logged by POST /api/checkout, the webhook is for another checkout (mixed Stripe CLI / multiple endpoints). Stash only applies when session ids match.",
      },
    );
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

  if (!isUpstashRedisConfigured()) {
    console.error(
      "[RonFax] Webhook: Redis env missing — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL + KV_REST_API_TOKEN). Vercel: Project → Settings → Environment Variables.",
    );
    await releaseStripeWebhookEvent(event.id);
    return NextResponse.json(
      { error: "Redis not configured" },
      { status: 500 },
    );
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
    paymentVerified: true,
    linked: false,
    updatedAt: Date.now(),
  });

  if (!trackSaved) {
    console.error(
      "[RonFax] saveTrackRecord failed — Redis SET rejected or failed (check Upstash dashboard / token).",
    );
    await releaseStripeWebhookEvent(event.id);
    return NextResponse.json(
      { error: "Redis write failed" },
      { status: 500 },
    );
  }

  const linkedOk = await linkStripeSessionToTrackToken(session.id, token);
  if (!linkedOk) {
    console.error(
      "Stripe webhook: linkStripeSessionToTrackToken failed",
      session.id,
    );
    await releaseStripeWebhookEvent(event.id);
    return NextResponse.json(
      { error: "Redis session link failed" },
      { status: 500 },
    );
  }

  await updateTrackRecord(token, {
    linked: true,
    paymentVerified: true,
  });

  const headerText =
    refCode != null ? `${refCode} · ${APP_NAME}`.slice(0, 50) : undefined;

  /** Sinch Fax API v3 `POST /v3/projects/{projectId}/faxes` */
  let outboundFaxId: string | null = null;
  try {
    const usePublicUrl =
      /^https?:\/\//i.test(fileUrlFromStripe) && fileUrlFromStripe.length > 8;
    console.log("🚀 Attempting Sinch Fax send…", {
      sessionId: session.id,
      faxTo,
      mode: usePublicUrl ? "contentUrl (metadata.fileUrl)" : "multipart file",
      fileUrl: usePublicUrl ? fileUrlFromStripe : undefined,
    });

    const sinchLabels = { ronfax_stripe_session: session.id };
    const result = usePublicUrl
      ? await sendFaxWithPublicFileUrl({
          toE164: faxTo,
          fileUrl: fileUrlFromStripe,
          headerText,
          labels: sinchLabels,
        })
      : await sendFaxWithPdf({
          toE164: faxTo,
          pdf: buffer,
          filename,
          headerText,
          labels: sinchLabels,
        });
    outboundFaxId = result.faxId;

    if (outboundFaxId == null) {
      throw new Error("Sinch Fax API returned no fax id");
    }

    const statusFromApi =
      typeof (result.raw as { status?: string })?.status === "string"
        ? (result.raw as { status: string }).status
        : "submitted";

    console.log("✅ Sinch Fax success, id:", outboundFaxId);

    const updated = await updateTrackRecord(token, {
      faxId: outboundFaxId,
      deliveryStatus: "sent",
      phaxioLastStatus: statusFromApi,
      linked: true,
      paymentVerified: true,
      progressPercent: 72,
    });
    if (!updated) {
      console.error(
        "[Stripe webhook] Redis row missing after Sinch send — fax id may not persist",
        outboundFaxId,
      );
    }
    const linkFaxOk = await linkPhaxioFaxToTrackToken(outboundFaxId, token);
    if (!linkFaxOk) {
      console.error(
        "[Stripe webhook] linkPhaxioFaxToTrackToken failed",
        outboundFaxId,
      );
    }
    await setFaxSessionSnapshot(session.id, {
      faxId: outboundFaxId,
      deliveryStatus: "sent",
    });
    console.log("[Stripe webhook] Persisted Sinch faxId to Redis", {
      faxId: outboundFaxId,
      sessionSnapshotKey: faxSessionRedisKey(session.id),
      trackRowKey: `ronfax:track:${token.slice(0, 10)}…`,
      updateOk: updated,
      outboundLinkOk: linkFaxOk,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Fax send failed";
    console.error("❌ SINCH FAX ERROR (full):", {
      message: msg,
      stack: error instanceof Error ? error.stack : undefined,
      sessionId: session.id,
      faxTo,
      raw: error,
    });
    await setFaxSessionSnapshot(session.id, {
      deliveryStatus: "failure",
      error: msg,
    });
    await updateTrackRecord(token, {
      deliveryStatus: "failure",
      errorMessage: msg,
      linked: true,
      paymentVerified: true,
      progressPercent: 100,
    });
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
    trackUrl
  ) {
    await sendTrackingEmail({
      to: contactEmail,
      trackUrl,
      faxTo,
    });
  }

  return NextResponse.json({ received: true });
  } catch (pipelineError) {
    console.error(
      "Stripe webhook checkout.session.completed pipeline error:",
      pipelineError,
    );
    await releaseStripeWebhookEvent(event.id);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

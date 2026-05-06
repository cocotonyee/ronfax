/**
 * Email-to-fax inbound webhook — typically called by a **Cloudflare Worker** in front of
 * Cloudflare Email Routing (Workers no longer use CloudMailin).
 *
 * **Auth:** `Authorization: Bearer <EMAIL_INBOUND_SECRET>`. Configure the Worker to attach
 * the same secret; the Next.js app validates it server-side (`process.env.EMAIL_INBOUND_SECRET`).
 *
 * **Body:** `application/json` (legacy / Worker-assembled payload) **or**
 * `multipart/form-data`:
 * - field `payload` (stringified JSON compatible with inbound JSON schema), **or**
 * - fields `from`, `to` (or `envelope_from` / `envelope_to`), optional `subject`, `message_id`,
 *   plus one or more **file parts** (`File` blobs — PDF/JPEG/PNG).
 *
 * **Resend** does not receive mail here; it only **sends** checkout links and receipts (see `src/lib/mail.ts`).
 */
import { NextRequest, NextResponse } from "next/server";
import { storeUploadPdf } from "@/lib/blob-fax";
import { countPdfPages } from "@/lib/pdf-pages";
import { getPriceBreakdown, priceCentsForPages } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import {
  isValidUsPhoneDigits,
  toE164Us,
} from "@/lib/phone";
import {
  attachmentToBuffer,
  parseEmailInboundRequest,
  shouldTreatAsPdf,
} from "@/lib/email-inbound-parse";
import { stashCheckoutSessionMetadata } from "@/lib/checkout-meta-stash";
import { getSiteUrl, isLocalOrLoopbackOrigin } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { upsertFaxTrack } from "@/lib/fax-tracks-db";
import { sendEmailInboundPaymentLink } from "@/lib/mail";
import { imageBufferToPdfBytes } from "@/lib/image-to-pdf";
import { mergePdfBuffers } from "@/lib/merge-pdf-buffers";

export const runtime = "nodejs";

/** Extract 10-digit US fax from plus-address e.g. fax+15551234567@domain or fax@... */
function parseFaxDigitsFromTo(toRaw: string): string | null {
  const lower = toRaw.toLowerCase();
  const plus = lower.match(/fax\+?1?(\d{10})@/);
  if (plus?.[1] && isValidUsPhoneDigits(plus[1])) return plus[1];
  const sub = lower.match(/(\d{10})@/);
  if (sub?.[1] && isValidUsPhoneDigits(sub[1])) return sub[1];
  return null;
}

function extractSubjectFaxDigits(subject: string): string | null {
  const d = subject.replace(/\D/g, "");
  if (d.length >= 10) {
    const last10 = d.slice(-10);
    if (isValidUsPhoneDigits(last10)) return last10;
  }
  return null;
}

type InboundJson = {
  headers?: { "Message-Id"?: string; message_id?: string };
  envelope?: { from?: string; to?: string };
  reply_plain?: string;
  subject?: string;
  attachments?: {
    file_name: string;
    content_type?: string;
    content?: string;
  }[];
};

export async function POST(req: NextRequest) {
  const secret = process.env.EMAIL_INBOUND_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  const bearer =
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  /**
   * Shared secret is compared to the Bearer token. In production the **Cloudflare Worker**
   * should set `Authorization: Bearer ${EMAIL_INBOUND_SECRET}` when forwarding to this URL
   * (secret lives in Worker env + app env; never expose in client-side code).
   */
  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseEmailInboundRequest(req);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.body as InboundJson;

  const messageId =
    body.headers?.["Message-Id"] ??
    body.headers?.message_id ??
    `gen-${Date.now()}`;

  const sup = getSupabaseAdmin();
  if (sup) {
    const { error: ins } = await sup.from("email_inbound_fax_dedupe").insert({
      message_id: messageId.slice(0, 500),
    });
    if (ins?.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    if (ins) {
      console.error("[email-inbound] dedupe insert", ins);
    }
  }

  const fromEmail = body.envelope?.from?.trim() ?? "";
  const toAddr = body.envelope?.to?.trim() ?? "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const digits =
    parseFaxDigitsFromTo(toAddr) ?? extractSubjectFaxDigits(subject);

  if (!fromEmail || !digits) {
    return NextResponse.json(
      {
        error:
          "Need From + fax destination in To (e.g. fax+15551234567@yourdomain)",
      },
      { status: 400 },
    );
  }

  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const buffers: Buffer[] = [];

  for (const att of attachments) {
    const parsedAtt = attachmentToBuffer(att);
    if (!parsedAtt) continue;
    const { buf, file_name, content_type } = parsedAtt;
    const name = file_name.toLowerCase();
    if (shouldTreatAsPdf(buf, file_name, content_type)) {
      buffers.push(buf);
    } else if (
      /\.(jpe?g|png)$/.test(name) ||
      content_type?.toLowerCase().startsWith("image/")
    ) {
      try {
        const pdfBuf = await imageBufferToPdfBytes(buf);
        buffers.push(Buffer.from(pdfBuf));
      } catch {
        console.warn("[email-inbound] skip bad image", name);
      }
    }
  }

  if (!buffers.length) {
    return NextResponse.json(
      { error: "No PDF or image attachment found" },
      { status: 400 },
    );
  }

  const merged =
    buffers.length === 1 ? buffers[0]! : await mergePdfBuffers(buffers);

  let docPages: number;
  try {
    docPages = await countPdfPages(merged);
  } catch {
    return NextResponse.json({ error: "Invalid PDF" }, { status: 400 });
  }
  if (docPages < 1) {
    return NextResponse.json({ error: "Empty PDF" }, { status: 400 });
  }

  const faxTo = toE164Us(digits);
  const priceCents = priceCentsForPages(docPages);
  const breakdown = getPriceBreakdown(docPages);
  const descriptionLines = breakdown.lines
    .map(
      (l) =>
        `${l.label}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(l.amountCents / 100)}`,
    )
    .join(" · ");

  const appUrl = getSiteUrl();
  if (
    process.env.NODE_ENV === "production" &&
    isLocalOrLoopbackOrigin(appUrl)
  ) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL must be public for Stripe" },
      { status: 500 },
    );
  }

  let pathname: string;
  let blobUrl: string;
  try {
    const stored = await storeUploadPdf(
      merged,
      `email-fax-${messageId.slice(0, 24)}.pdf`,
    );
    pathname = stored.pathname;
    blobUrl = stored.url;
  } catch (e) {
    console.error("[email-inbound] blob", e);
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: fromEmail.includes("@") ? fromEmail : undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name:
                docPages === 1
                  ? "Fax Transmission - 1 page (email)"
                  : `Fax Transmission - ${docPages} pages (email)`,
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
        blobPathname: pathname,
        fileUrl: blobUrl,
        faxNumber: digits,
        faxTo,
        document_pages: String(docPages),
        billed_pages: String(docPages),
        pageCount: String(docPages),
        priceCents: String(priceCents),
        filename: "document.pdf",
        email_inbound: "1",
        source: "email_inbound",
        source_keyword: "email-inbound",
        cover_enabled: "0",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "No checkout URL" }, { status: 500 });
    }

    try {
      // Stripe Checkout session update does not expose client_reference_id in typed API;
      // linkage for webhooks is stripe_session_id + source in metadata (and fax_tracks PK = session.id).
      await stripe.checkout.sessions.update(session.id, {
        metadata: {
          blobPathname: pathname,
          fileUrl: blobUrl,
          faxNumber: digits,
          faxTo,
          document_pages: String(docPages),
          billed_pages: String(docPages),
          pageCount: String(docPages),
          priceCents: String(priceCents),
          filename: "document.pdf",
          email_inbound: "1",
          source: "email_inbound",
          source_keyword: "email-inbound",
          cover_enabled: "0",
          stripe_session_id: session.id,
        },
      });
    } catch (e) {
      console.warn("[email-inbound] session update metadata", e);
    }

    await stashCheckoutSessionMetadata(session.id, {
      blobPathname: pathname,
      fileUrl: blobUrl,
      faxNumber: digits,
      faxTo,
      pageCount: String(docPages),
      priceCents: String(priceCents),
      filename: "document.pdf",
      contactName: "",
      contactEmail: fromEmail,
      source_keyword: "email-inbound",
      source: "email_inbound",
    });

    if (sup) {
      const awaitingSaved = await upsertFaxTrack({
        stripeSessionId: session.id,
        contactEmail: fromEmail,
        contactName: "",
        faxTo,
        pageCount: docPages,
        amountCents: priceCents,
        faxId: null,
        deliveryStatus: "awaiting_payment",
        paymentVerified: false,
        pdfUrl: blobUrl,
        updatedAt: Date.now(),
        sourceKeyword: "email-inbound",
      });
      if (!awaitingSaved) {
        console.error(
          "[email-inbound] fax_tracks awaiting_payment upsert failed",
        );
      }
    }

    await sendEmailInboundPaymentLink({
      to: fromEmail,
      checkoutUrl: session.url,
      faxTo,
      pageCount: docPages,
    });

    if (sup) {
      await sup
        .from("email_inbound_fax_dedupe")
        .update({ stripe_session_id: session.id })
        .eq("message_id", messageId.slice(0, 500));
    }

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (e) {
    console.error("[email-inbound] checkout", e);
    return NextResponse.json(
      { error: "Checkout creation failed" },
      { status: 500 },
    );
  }
}

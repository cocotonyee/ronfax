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
 * - zero-dependency Worker mode can also send `raw_rfc822_base64` (base64-encoded full MIME email);
 *   this route parses attachments server-side.
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
  type InboundJsonLike,
  parseEmailInboundRequest,
  shouldTreatAsPdf,
} from "@/lib/email-inbound-parse";
import { parseRfc822ToInbound } from "@/lib/email-inbound-rfc822";
import { stashCheckoutSessionMetadata } from "@/lib/checkout-meta-stash";
import { getSiteUrl, isLocalOrLoopbackOrigin } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { upsertFaxTrack } from "@/lib/fax-tracks-db";
import { sendEmailInboundPaymentLink } from "@/lib/mail";
import { imageBufferToPdfBytes } from "@/lib/image-to-pdf";
import { mergePdfBuffers } from "@/lib/merge-pdf-buffers";

export const runtime = "nodejs";

/** Extract 10-digit US fax from plus-address e.g. fax+15551234567@domain or 10digits@... */
function parseFaxDigitsFromTo(toRaw: string): string | null {
  const lower = toRaw.toLowerCase();
  const plus = lower.match(/fax\+?1?(\d{10})@/);
  if (plus?.[1] && isValidUsPhoneDigits(plus[1])) return plus[1];
  const sub = lower.match(/(\d{10})@/);
  if (sub?.[1] && isValidUsPhoneDigits(sub[1])) return sub[1];
  return null;
}

function extractBareEmail(raw: string): string {
  const m = raw.trim().match(/<([^>]+@[^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

/** True when the recipient is `fax@anydomain` (no plus-address digits) — fax number is taken from Subject first. */
function isPlainFaxMailbox(toRaw: string): boolean {
  const addr = extractBareEmail(toRaw);
  const at = addr.indexOf("@");
  if (at <= 0) return false;
  const local = addr.slice(0, at);
  return local === "fax";
}

function extractSubjectFaxDigits(subject: string): string | null {
  const d = subject.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.length === 10 && isValidUsPhoneDigits(d)) return d;
  if (d.length === 11 && d.startsWith("1")) {
    const ten = d.slice(1);
    if (isValidUsPhoneDigits(ten)) return ten;
  }
  if (d.length > 10) {
    const last10 = d.slice(-10);
    if (isValidUsPhoneDigits(last10)) return last10;
  }
  return null;
}

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
  let body = parsed.body as InboundJsonLike;
  if (
    typeof body.raw_rfc822_base64 === "string" &&
    body.raw_rfc822_base64.trim() !== ""
  ) {
    try {
      body = await parseRfc822ToInbound(body.raw_rfc822_base64, {
        from: body.envelope?.from,
        to: body.envelope?.to,
        subject: body.subject,
        messageId: body.headers?.["Message-Id"] ?? body.headers?.message_id,
      });
    } catch (e) {
      console.error("[email-inbound] raw RFC822 parse failed", e);
      return NextResponse.json(
        { error: "Invalid RFC822 payload in raw_rfc822_base64" },
        { status: 400 },
      );
    }
  }

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
  const fromTo = parseFaxDigitsFromTo(toAddr);
  const fromSubject = extractSubjectFaxDigits(subject);
  const digits = isPlainFaxMailbox(toAddr)
    ? (fromSubject ?? fromTo)
    : (fromTo ?? fromSubject);

  if (!fromEmail || !digits) {
    const hint = isPlainFaxMailbox(toAddr)
      ? "For fax@… addresses, put the 10-digit US fax number in the email Subject (e.g. 5551234567), or use To: fax+5551234567@yourdomain."
      : "Need a valid recipient: use fax+10digitnumber@… in To, or fax@… with 10 digits in the Subject.";
    return NextResponse.json({ error: hint }, { status: 400 });
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

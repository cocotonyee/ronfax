import { createElement } from "react";
import { render } from "@react-email/render";
import { FaxResultEmail } from "@/components/emails/FaxResultEmail";
import { PaymentSuccessEmail } from "@/components/emails/PaymentSuccessEmail";
import {
  APP_NAME,
  GUEST_CHECKOUT_EMAIL_DOMAIN,
  SUPPORT_EMAIL,
} from "@/lib/constants";

function shouldSkipReceiptEmail(to: string): boolean {
  return to.toLowerCase().endsWith(`@${GUEST_CHECKOUT_EMAIL_DOMAIN.toLowerCase()}`);
}

/** Fixed Resend `From` domain — avoids Gmail/unverified `From` 403 blocking later work (e.g. Redis cleanup paths). */
const RESEND_FROM_FIXED = "no-reply@ronfax.com";

function resolveResendFromEmail(): string {
  const override = process.env.RESEND_FROM_EMAIL?.trim();
  if (override && override.toLowerCase() !== RESEND_FROM_FIXED.toLowerCase()) {
    console.warn(
      "[RonFax] RESEND_FROM_EMAIL ignored — all Resend mail uses",
      RESEND_FROM_FIXED,
    );
  }
  return RESEND_FROM_FIXED;
}

export async function sendTaskStartedEmail(params: {
  to: string;
  trackUrl: string;
  faxTo: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveResendFromEmail();

  if (!apiKey) {
    console.warn(
      "[RonFax] RESEND_API_KEY missing — task-started email not sent. URL:",
      params.trackUrl,
    );
    return { ok: false, skipped: true };
  }

  if (shouldSkipReceiptEmail(params.to)) {
    return { ok: true, skipped: true };
  }

  try {
    const html = await render(
      createElement(PaymentSuccessEmail, {
        faxTo: params.faxTo,
        trackUrl: params.trackUrl,
      }),
    );
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${from}>`,
      to: params.to,
      subject: `${APP_NAME} — Payment received · Fax send started`,
      html,
    });
    if (error) {
      console.warn(
        "[RonFax] Resend task-started failed (non-fatal — fax pipeline continues)",
        error,
      );
      return { ok: true, skipped: true };
    }
    return { ok: true };
  } catch (e) {
    console.warn(
      "[RonFax] sendTaskStartedEmail exception (non-fatal — fax pipeline continues)",
      e,
    );
    return { ok: true, skipped: true };
  }
}

export async function sendFaxDeliveredEmail(params: {
  to: string;
  faxTo: string;
  trackUrl: string;
  /** Same Stripe Checkout session used by <code>/api/receipt</code> */
  stripeSessionId: string;
  pdfAttachment: Buffer;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveResendFromEmail();

  if (!apiKey) {
    console.warn(
      "[RonFax] RESEND_API_KEY missing — delivered email not sent",
      params.stripeSessionId,
    );
    return { ok: false, skipped: true };
  }

  if (shouldSkipReceiptEmail(params.to)) {
    return { ok: true, skipped: true };
  }

  try {
    const html = await render(
      createElement(FaxResultEmail, {
        faxTo: params.faxTo,
        trackUrl: params.trackUrl,
        hasPdfAttachment: true,
      }),
    );
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${from}>`,
      to: params.to,
      subject: `${APP_NAME} — Fax delivered · PDF attached`,
      html,
      attachments: [
        {
          filename: "submitted-document.pdf",
          content: params.pdfAttachment,
        },
      ],
    });
    if (error) {
      console.error("[RonFax] Resend delivered email error", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[RonFax] sendFaxDeliveredEmail", e);
    return { ok: false };
  }
}

/** Same as delivered but without PDF if generation/fetch failed. */
export async function sendFaxDeliveredEmailNoAttachment(params: {
  to: string;
  faxTo: string;
  trackUrl: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveResendFromEmail();

  if (!apiKey) {
    return { ok: false, skipped: true };
  }
  if (shouldSkipReceiptEmail(params.to)) {
    return { ok: true, skipped: true };
  }

  try {
    const html = await render(
      createElement(FaxResultEmail, {
        faxTo: params.faxTo,
        trackUrl: params.trackUrl,
        hasPdfAttachment: false,
      }),
    );
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${from}>`,
      to: params.to,
      subject: `${APP_NAME} — Fax delivered`,
      html,
    });
    if (error) {
      console.error("[RonFax] Resend delivered (no PDF) error", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[RonFax] sendFaxDeliveredEmailNoAttachment", e);
    return { ok: false };
  }
}

export async function sendFaxDeliveryFailedEmail(params: {
  to: string;
  faxTo: string;
  trackUrl: string;
  reason: string;
  homeUrl: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveResendFromEmail();

  if (!apiKey) {
    console.warn(
      "[RonFax] RESEND_API_KEY missing — delivery-failed email not sent",
    );
    return { ok: false, skipped: true };
  }

  if (shouldSkipReceiptEmail(params.to)) {
    return { ok: true, skipped: true };
  }

  const reasonHtml = escapeHtml(params.reason);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${from}>`,
      to: params.to,
      subject: `${APP_NAME} — Fax could not be delivered`,
      html: `
        <p>Your fax to <strong>${escapeHtml(params.faxTo)}</strong> did not complete successfully.</p>
        <p><strong>Carrier reported:</strong> ${reasonHtml}</p>
        <p><strong>What you can try</strong></p>
        <ul>
          <li>Confirm the fax number (including country code) and try sending again from <a href="${escapeHtml(params.homeUrl)}">${escapeHtml(params.homeUrl)}</a>.</li>
          <li>Ask the recipient whether their line is busy or filtering unknown senders.</li>
          <li>If payment went through but transmission keeps failing, email <a href="mailto:${SUPPORT_EMAIL}">${escapeHtml(SUPPORT_EMAIL)}</a> with your status link.</li>
        </ul>
        <p>Track details:</p>
        <p><a href="${escapeHtml(params.trackUrl)}">${escapeHtml(params.trackUrl)}</a></p>
      `,
    });
    if (error) {
      console.error("[RonFax] Resend delivery-failed email error", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[RonFax] sendFaxDeliveryFailedEmail", e);
    return { ok: false };
  }
}

/** Sinch API rejected the send before carrier delivery (e.g. upload error). */
export async function sendFaxSubmitFailedEmail(params: {
  to: string;
  faxTo: string;
  trackUrl: string;
  errorSummary: string;
  homeUrl: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveResendFromEmail();

  if (!apiKey) {
    return { ok: false, skipped: true };
  }
  if (shouldSkipReceiptEmail(params.to)) {
    return { ok: true, skipped: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${from}>`,
      to: params.to,
      subject: `${APP_NAME} — Fax send failed (not delivered)`,
      html: `
        <p>Your payment was received, but we could not hand off your fax to the carrier.</p>
        <p><strong>Error:</strong> ${escapeHtml(params.errorSummary)}</p>
        <p><strong>Next steps</strong></p>
        <ul>
          <li>Open your <a href="${escapeHtml(params.trackUrl)}">status page</a> for the latest message.</li>
          <li>Try a new send from <a href="${escapeHtml(params.homeUrl)}">${escapeHtml(params.homeUrl)}</a> with a smaller PDF or a different file.</li>
          <li>Need help? ${escapeHtml(SUPPORT_EMAIL)}</li>
        </ul>
      `,
    });
    if (error) {
      console.error("[RonFax] Resend submit-failed email error", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[RonFax] sendFaxSubmitFailedEmail", e);
    return { ok: false };
  }
}

export async function sendTrackingEmail(params: {
  to: string;
  /** Preferred: `/status/{stripeSessionId}` public URL */
  trackUrl: string;
  faxTo: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveResendFromEmail();

  if (!apiKey) {
    console.warn(
      "[RonFax] RESEND_API_KEY missing — tracking email not sent. URL:",
      params.trackUrl,
    );
    return { ok: false, skipped: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${from}>`,
      to: params.to,
      subject: `${APP_NAME} — Fax submitted · Track status (24h link)`,
      html: `
        <p>Your fax to <strong>${escapeHtml(params.faxTo)}</strong> has been submitted.</p>
        <p>View delivery status (no login required, expires in 24 hours):</p>
        <p><a href="${escapeHtml(params.trackUrl)}">${escapeHtml(params.trackUrl)}</a></p>
        <p style="color:#64748b;font-size:13px;">If you did not request this, you can ignore this email.</p>
      `,
    });
    if (error) {
      console.error("[RonFax] Resend error", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[RonFax] sendTrackingEmail", e);
    return { ok: false };
  }
}

export async function sendReplyMatchedEmail(params: {
  to: string;
  refCode: string;
  payUrl: string;
  fromNumber?: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveResendFromEmail();

  if (!apiKey) {
    console.warn(
      "[RonFax] RESEND_API_KEY missing — reply notification not sent. Pay URL:",
      params.payUrl,
    );
    return { ok: false, skipped: true };
  }

  const fromLine = params.fromNumber
    ? `<p>Caller ID: <strong>${escapeHtml(params.fromNumber)}</strong></p>`
    : "";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${from}>`,
      to: params.to,
      subject: `${APP_NAME} — Reply fax matched (${params.refCode})`,
      html: `
        <p>We received an inbound fax that matches your reference <strong>${escapeHtml(params.refCode)}</strong>.</p>
        ${fromLine}
        <p><strong>Unlock the PDF for $0.99</strong> (one-time) to download your reply:</p>
        <p><a href="${escapeHtml(params.payUrl)}">${escapeHtml(params.payUrl)}</a></p>
        <p style="color:#64748b;font-size:13px;">If you did not send a fax with this reference, you can ignore this email.</p>
      `,
    });
    if (error) {
      console.error("[RonFax] Resend reply email error", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[RonFax] sendReplyMatchedEmail", e);
    return { ok: false };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

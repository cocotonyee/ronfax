import { APP_NAME } from "@/lib/constants";

export async function sendTrackingEmail(params: {
  to: string;
  /** Preferred: `/status/{stripeSessionId}` public URL */
  trackUrl: string;
  faxTo: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

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
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

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

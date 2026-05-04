import { deleteBlobFile } from "@/lib/blob";
import { fetchPdfBufferFromBlobUrl } from "@/lib/blob-fax";
import type { FaxTrackRecord } from "@/lib/fax-track";
import {
  getTrackRecord,
  getTrackTokenForPhaxioFax,
  getTrackTokenForStripeSession,
  linkPhaxioFaxToTrackToken,
  setFaxSessionSnapshot,
  updateTrackRecord,
} from "@/lib/fax-track";
import {
  sendFaxDeliveredEmail,
  sendFaxDeliveredEmailNoAttachment,
  sendFaxDeliveryFailedEmail,
} from "@/lib/mail";
import { mapPhaxioToUi } from "@/lib/phaxio-status";
import { claimTerminalDeliveryEmail } from "@/lib/redis";
import { getSiteUrl } from "@/lib/site-url";

export type ApplyPhaxioOutboundResult = {
  applied: boolean;
  /** Opaque track token — call `cleanupTrackPdfBlobAfterTerminal` from `@/lib/blob` after terminal callbacks */
  trackToken?: string;
  /** Sinch reported COMPLETED / FAILURE (or legacy equivalents), not QUEUED / IN_PROGRESS */
  isTerminal?: boolean;
};

/**
 * Applies Sinch / Phaxio **outbound** completion callbacks to Redis track row + `fax:{cs_*}` snapshot.
 * Sets `progressPercent: 100` when transmission reaches a terminal Sinch state (success/failure).
 */
export async function applyPhaxioOutboundStatus(params: {
  faxId: string | number;
  statusRaw: string;
  errorMessage?: string | null;
  /** From Sinch `labels.ronfax_stripe_session` when fax→track link is missing */
  stripeSessionIdHint?: string | null;
  /** e.g. `FAX_COMPLETED` — used when `status` is empty but event implies success */
  completionEvent?: string | null;
  /** Cents, already coerced from Phaxio string/number fields */
  amountCentsFromWebhook?: number;
}): Promise<ApplyPhaxioOutboundResult> {
  let token: string | null = null;
  if (
    typeof params.stripeSessionIdHint === "string" &&
    params.stripeSessionIdHint.startsWith("cs_")
  ) {
    token = await getTrackTokenForStripeSession(params.stripeSessionIdHint);
    if (token) {
      console.log(
        "[Sinch outbound] resolved track via ronfax:session-to-track + ronfax:track (session",
        params.stripeSessionIdHint,
        ")",
      );
    }
  }
  if (!token) {
    token = await getTrackTokenForPhaxioFax(params.faxId);
  }
  if (!token) {
    console.warn(
      "[Phaxio outbound] no Redis mapping for fax id — send may predate fax→track linking",
      { faxId: params.faxId, hadStripeHint: Boolean(params.stripeSessionIdHint) },
    );
    return { applied: false };
  }

  const eventUpper = String(params.completionEvent ?? "").toUpperCase();
  let effectiveStatus = String(params.statusRaw ?? "").trim();
  if (!effectiveStatus && eventUpper === "FAX_COMPLETED") {
    effectiveStatus = "COMPLETED";
  }

  let ui = mapPhaxioToUi(effectiveStatus);
  if (ui === "pending" && eventUpper === "FAX_COMPLETED") {
    ui = "success";
  }

  const patch: Partial<FaxTrackRecord> = {
    phaxioLastStatus: effectiveStatus || params.statusRaw,
    faxId: params.faxId,
  };

  if (
    typeof params.amountCentsFromWebhook === "number" &&
    Number.isFinite(params.amountCentsFromWebhook) &&
    params.amountCentsFromWebhook > 0
  ) {
    patch.amountCents = Math.round(params.amountCentsFromWebhook);
  }

  if (ui === "failure") {
    patch.deliveryStatus = "failure";
    const err =
      typeof params.errorMessage === "string" && params.errorMessage.trim()
        ? params.errorMessage.trim()
        : "Transmission failed";
    patch.errorMessage = err;
    patch.progressPercent = 100;
    patch.linked = true;
  } else if (ui === "success") {
    patch.deliveryStatus = "success";
    patch.errorMessage = "";
    patch.progressPercent = 100;
    patch.linked = true;
  }

  await updateTrackRecord(token, patch);
  await linkPhaxioFaxToTrackToken(params.faxId, token);

  const rec = await getTrackRecord(token);
  if (rec?.stripeSessionId) {
    if (ui === "failure") {
      await setFaxSessionSnapshot(rec.stripeSessionId, {
        deliveryStatus: "failure",
        error: patch.errorMessage ?? "Transmission failed",
      });
    } else if (ui === "success") {
      await setFaxSessionSnapshot(rec.stripeSessionId, {
        faxId: params.faxId,
        deliveryStatus: "sent",
      });
    }
  }

  if (rec?.stripeSessionId && rec.contactEmail) {
    const site = getSiteUrl();
    const trackUrl = `${site}/status/${rec.stripeSessionId}`;

    if (ui === "success") {
      const claimed = await claimTerminalDeliveryEmail(
        rec.stripeSessionId,
        "delivered",
      );
      if (claimed) {
        let blobPdf: Buffer | null = null;
        if (rec.pdfUrl) {
          blobPdf = await fetchPdfBufferFromBlobUrl(rec.pdfUrl);
        }

        let sent: { ok: boolean; skipped?: boolean };
        if (blobPdf?.length) {
          sent = await sendFaxDeliveredEmail({
            to: rec.contactEmail,
            faxTo: rec.faxTo,
            trackUrl,
            stripeSessionId: rec.stripeSessionId,
            pdfAttachment: blobPdf,
          });
        } else {
          sent = await sendFaxDeliveredEmailNoAttachment({
            to: rec.contactEmail,
            faxTo: rec.faxTo,
            trackUrl,
          });
        }

        if (
          blobPdf?.length &&
          sent.ok &&
          !sent.skipped &&
          typeof rec.pdfUrl === "string" &&
          rec.pdfUrl.trim()
        ) {
          try {
            await deleteBlobFile(rec.pdfUrl.trim());
            await updateTrackRecord(token, { pdfUrl: null });
          } catch (e) {
            console.error(
              "[Phaxio outbound] blob del after FaxResult email (non-fatal)",
              e,
            );
          }
        }
      }
    } else if (ui === "failure") {
      const claimed = await claimTerminalDeliveryEmail(
        rec.stripeSessionId,
        "failed",
      );
      if (claimed) {
        const reason =
          (typeof params.errorMessage === "string" &&
            params.errorMessage.trim()) ||
          patch.errorMessage ||
          "Transmission failed";
        await sendFaxDeliveryFailedEmail({
          to: rec.contactEmail,
          faxTo: rec.faxTo,
          trackUrl,
          reason,
          homeUrl: site,
        });
      }
    }
  }

  const isTerminal = ui === "success" || ui === "failure";

  return { applied: true, trackToken: token, isTerminal };
}

import { deleteBlobFile } from "@/lib/blob";
import { fetchPdfBufferFromBlobUrl } from "@/lib/blob-fax";
import { parseCheckoutSessionId } from "@/lib/checkout-session";
import {
  getFaxTrackByFaxId,
  getFaxTrackBySessionId,
  mergePatchFaxTrack,
  type FaxTrackPayload,
} from "@/lib/fax-tracks-db";
import {
  sendFaxDeliveredEmail,
  sendFaxDeliveredEmailNoAttachment,
  sendFaxDeliveryFailedEmail,
} from "@/lib/mail";
import { mapPhaxioToUi } from "@/lib/phaxio-status";
import { claimTerminalDeliveryEmail } from "@/lib/supabase-kv";
import { getSiteUrl } from "@/lib/site-url";

export type ApplyPhaxioOutboundResult = {
  applied: boolean;
  checkoutSessionId?: string;
  isTerminal?: boolean;
};

/**
 * Applies Sinch / Phaxio **outbound** completion — updates `fax_tracks` by Stripe session id (`cs_*`).
 */
export async function applyPhaxioOutboundStatus(params: {
  faxId: string | number;
  statusRaw: string;
  errorMessage?: string | null;
  stripeSessionIdHint?: string | null;
  completionEvent?: string | null;
  amountCentsFromWebhook?: number;
}): Promise<ApplyPhaxioOutboundResult> {
  let checkoutSessionId: string | null = parseCheckoutSessionId(
    typeof params.stripeSessionIdHint === "string"
      ? params.stripeSessionIdHint
      : null,
  );
  if (!checkoutSessionId) {
    const byFax = await getFaxTrackByFaxId(params.faxId);
    checkoutSessionId = byFax?.stripeSessionId ?? null;
  }
  if (!checkoutSessionId) {
    console.warn(
      "[Phaxio outbound] no session — unknown fax_id and no labels.ronfax_stripe_session",
      { faxId: params.faxId, hadStripeHint: Boolean(params.stripeSessionIdHint) },
    );
    return { applied: false };
  }

  const row = await getFaxTrackBySessionId(checkoutSessionId);
  if (!row) {
    console.warn(
      "[Phaxio outbound] no fax_tracks row for session (Stripe not persisted yet?)",
      checkoutSessionId,
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

  let patch: Partial<FaxTrackPayload> = {
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
    const err =
      typeof params.errorMessage === "string" && params.errorMessage.trim()
        ? params.errorMessage.trim()
        : "Transmission failed";
    patch = {
      ...patch,
      deliveryStatus: "failure",
      errorMessage: err,
      progressPercent: 100,
    };
  } else if (ui === "success") {
    patch = {
      ...patch,
      deliveryStatus: "success",
      errorMessage: "",
      progressPercent: 100,
    };
  }

  await mergePatchFaxTrack(checkoutSessionId, patch);

  const rec = await getFaxTrackBySessionId(checkoutSessionId);
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
            await mergePatchFaxTrack(checkoutSessionId, { pdfUrl: null });
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

  return { applied: true, checkoutSessionId, isTerminal };
}

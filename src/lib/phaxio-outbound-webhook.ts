import type { FaxTrackRecord } from "@/lib/fax-track";
import {
  getTrackRecord,
  getTrackTokenForPhaxioFax,
  getTrackTokenForStripeSession,
  linkPhaxioFaxToTrackToken,
  setFaxSessionSnapshot,
  updateTrackRecord,
} from "@/lib/fax-track";
import { mapPhaxioToUi } from "@/lib/phaxio-status";

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
}): Promise<boolean> {
  let token = await getTrackTokenForPhaxioFax(params.faxId);
  if (
    !token &&
    typeof params.stripeSessionIdHint === "string" &&
    params.stripeSessionIdHint.startsWith("cs_")
  ) {
    token = await getTrackTokenForStripeSession(params.stripeSessionIdHint);
    if (token) {
      console.log(
        "[Sinch outbound] resolved track token via labels.ronfax_stripe_session",
        params.stripeSessionIdHint,
      );
    }
  }
  if (!token) {
    console.warn(
      "[Phaxio outbound] no Redis mapping for fax id — send may predate fax→track linking",
      { faxId: params.faxId, hadStripeHint: Boolean(params.stripeSessionIdHint) },
    );
    return false;
  }

  const ui = mapPhaxioToUi(params.statusRaw);
  const patch: Partial<FaxTrackRecord> = {
    phaxioLastStatus: params.statusRaw,
  };

  if (ui === "failure") {
    patch.deliveryStatus = "failure";
    const err =
      typeof params.errorMessage === "string" && params.errorMessage.trim()
        ? params.errorMessage.trim()
        : "Transmission failed";
    patch.errorMessage = err;
    patch.progressPercent = 100;
  } else if (ui === "success") {
    patch.deliveryStatus = "success";
    patch.errorMessage = "";
    patch.progressPercent = 100;
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

  return true;
}

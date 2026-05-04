import {
  getFaxSessionSnapshot,
  getTrackRecord,
  getTrackTokenForPhaxioFax,
  getTrackTokenForStripeSession,
} from "@/lib/fax-track";
import { getPhaxioFax, mapPhaxioToUi } from "@/lib/phaxio-status";
import { formatUsdFromCents } from "@/lib/pricing";

/** Response shape for `/api/status/progress` and `/api/fax-status/[id]` */
export type FaxStatusPayload = {
  linked: boolean;
  paymentVerified: boolean;
  faxTo: string | null;
  pageCount: number | null;
  amountCents?: number | null;
  amountLabel?: string;
  stepUploadToPhaxio: boolean;
  stepTransmission: boolean;
  uiState: "pending" | "success" | "failure";
  detail: string;
  refCode?: string;
  /** 0–100 for animated progress bar */
  progressPercent: number;
  phaxioStatus?: string | null;
};

export async function buildFaxStatusPayload(
  sessionId: string,
): Promise<FaxStatusPayload | { error: string }> {
  if (!sessionId.startsWith("cs_")) {
    return { error: "Invalid session id" };
  }

  let token = await getTrackTokenForStripeSession(sessionId);
  const snapNoToken = !token
    ? await getFaxSessionSnapshot(sessionId)
    : null;
  /** Webhook writes `fax:{sessionId}`; resolve track token via Phaxio fax id when session→track is not linked yet. */
  if (!token && snapNoToken?.deliveryStatus === "failure") {
    return {
      linked: false,
      paymentVerified: true,
      faxTo: null,
      pageCount: null,
      amountCents: null,
      stepUploadToPhaxio: true,
      stepTransmission: true,
      uiState: "failure",
      detail: snapNoToken.error ?? "Transmission failed.",
      progressPercent: 100,
    };
  }
  if (
    !token &&
    snapNoToken &&
    "faxId" in snapNoToken &&
    snapNoToken.faxId != null
  ) {
    token = await getTrackTokenForPhaxioFax(snapNoToken.faxId);
  }
  if (!token) {
    return {
      linked: false,
      paymentVerified: true,
      faxTo: null,
      pageCount: null,
      amountCents: null,
      stepUploadToPhaxio: false,
      stepTransmission: false,
      uiState: "pending",
      detail: "Confirming payment and preparing your fax…",
      progressPercent: 12,
    };
  }

  const rec = await getTrackRecord(token);
  if (!rec) {
    return {
      linked: false,
      paymentVerified: true,
      faxTo: null,
      pageCount: null,
      amountCents: null,
      stepUploadToPhaxio: false,
      stepTransmission: false,
      uiState: "pending",
      detail: "Syncing…",
      progressPercent: 18,
    };
  }

  let uiState: "pending" | "success" | "failure" = "pending";
  let detail = "";
  let phaxioStatus: string | null = null;

  if (rec.deliveryStatus === "failure" || rec.errorMessage) {
    uiState = "failure";
    detail = rec.errorMessage ?? "Transmission failed.";
  } else if (rec.faxId != null) {
    const live = await getPhaxioFax(rec.faxId);
    const st = live?.status ?? rec.phaxioLastStatus;
    phaxioStatus = typeof st === "string" ? st : null;
    uiState = mapPhaxioToUi(st);
    if (live?.error_message) detail = live.error_message;
    else if (uiState === "pending") detail = "Dialing recipient and transmitting…";
    else if (uiState === "success") detail = "Delivered.";
    else if (uiState === "failure") detail = live?.error_message ?? "Send failed.";
  } else if (rec.deliveryStatus === "processing") {
    detail = "Uploading your document to the fax network…";
  } else {
    detail = "Processing…";
  }

  const stepUploadToPhaxio = rec.deliveryStatus !== "processing";
  const stepTransmission = uiState === "success" || uiState === "failure";

  const progressPercent = computeProgressPercent({
    stepUploadToPhaxio,
    stepTransmission,
    uiState,
  });

  return {
    linked: true,
    paymentVerified: true,
    faxTo: rec.faxTo,
    pageCount: rec.pageCount,
    amountCents: rec.amountCents,
    amountLabel: formatUsdFromCents(rec.amountCents),
    stepUploadToPhaxio,
    stepTransmission,
    uiState,
    detail,
    refCode: rec.refCode,
    progressPercent,
    phaxioStatus,
  };
}

function computeProgressPercent(opts: {
  stepUploadToPhaxio: boolean;
  stepTransmission: boolean;
  uiState: "pending" | "success" | "failure";
}): number {
  if (opts.stepTransmission) return 100;
  if (!opts.stepUploadToPhaxio) return 38;
  if (opts.uiState === "pending") return 72;
  return 55;
}

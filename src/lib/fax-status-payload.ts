import { createHash } from "crypto";
import { parseCheckoutSessionId } from "@/lib/checkout-session";
import { getFaxTrackBySessionId } from "@/lib/fax-tracks-db";
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
  progressPercent: number;
  phaxioStatus?: string | null;
  /** Mirrors fax_tracks.delivery_status when a row exists */
  deliveryStatus?: string | null;
  enhancedConversions?: {
    sha256EmailAddress?: string;
  };
};

function hashEmailForEnhancedConversions(email: string | undefined): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export async function buildFaxStatusPayload(
  sessionId: string,
): Promise<FaxStatusPayload | { error: string }> {
  const sid = parseCheckoutSessionId(sessionId);
  if (!sid) {
    return { error: "Invalid session id" };
  }

  const rec = await getFaxTrackBySessionId(sid);
  if (!rec) {
    return {
      linked: false,
      paymentVerified: false,
      faxTo: null,
      pageCount: null,
      amountCents: null,
      stepUploadToPhaxio: false,
      stepTransmission: false,
      uiState: "pending",
      detail: "Confirming payment and preparing your fax…",
      progressPercent: 12,
      deliveryStatus: null,
    };
  }

  const isTerminalDelivery =
    rec.deliveryStatus === "failure" ||
    rec.deliveryStatus === "error" ||
    rec.deliveryStatus === "sent";

  const isAwaitingPayment = rec.deliveryStatus === "awaiting_payment";
  /** Paid (or free) — handoff to Sinch not necessarily complete */
  const paymentSettledForUi =
    rec.deliveryStatus !== "awaiting_payment" &&
    (rec.paymentVerified !== false || isTerminalDelivery);

  let uiState: "pending" | "success" | "failure" = "pending";
  let detail = "";
  let phaxioStatus: string | null = null;

  if (
    rec.deliveryStatus === "failure" ||
    rec.deliveryStatus === "error" ||
    rec.errorMessage
  ) {
    uiState = "failure";
    detail = rec.errorMessage ?? "Transmission failed.";
  } else if (rec.faxId != null) {
    const live = await getPhaxioFax(rec.faxId);
    const st = live?.status ?? rec.phaxioLastStatus;
    phaxioStatus = typeof st === "string" ? st : null;
    uiState = mapPhaxioToUi(st);
    if (live?.error_message) detail = live.error_message;
    else if (uiState === "pending")
      detail = "Dialing recipient and transmitting…";
    else if (uiState === "success") detail = "Delivered.";
    else if (uiState === "failure")
      detail = live?.error_message ?? "Send failed.";
  } else if (isAwaitingPayment) {
    detail = "等待支付中";
  } else if (rec.deliveryStatus === "processing") {
    detail = "正在提交至全球传真网关";
  } else {
    detail = "Processing…";
  }

  /** Step 2 “upload to Phaxio” is done once we’re past awaiting/processing-without-faxId, or have a fax id */
  const stepUploadToPhaxio =
    !isAwaitingPayment &&
    (rec.deliveryStatus !== "processing" || rec.faxId != null);

  const stepTransmission = uiState === "success" || uiState === "failure";

  const progressPercent = computeProgressPercent(rec, {
    stepUploadToPhaxio,
    stepTransmission,
    uiState,
  });

  return {
    linked: true,
    paymentVerified: paymentSettledForUi,
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
    deliveryStatus: rec.deliveryStatus,
    enhancedConversions: {
      sha256EmailAddress:
        hashEmailForEnhancedConversions(rec.contactEmail) ?? undefined,
    },
  };
}

function computeProgressPercent(
  rec: {
    deliveryStatus: string;
    faxId: string | number | null;
  },
  opts: {
    stepUploadToPhaxio: boolean;
    stepTransmission: boolean;
    uiState: "pending" | "success" | "failure";
  },
): number {
  if (rec.deliveryStatus === "awaiting_payment") return 20;
  if (rec.deliveryStatus === "processing" && rec.faxId == null) return 50;
  if (opts.stepTransmission) return 100;
  if (!opts.stepUploadToPhaxio) return 38;
  if (opts.uiState === "pending") return 72;
  return 55;
}

import { NextRequest, NextResponse } from "next/server";
import { cleanupTrackPdfBlobAfterTerminal } from "@/lib/blob";
import { storeReplyPdf } from "@/lib/blob-fax";
import { applyPhaxioOutboundStatus } from "@/lib/phaxio-outbound-webhook";
import { extractRefCodes } from "@/lib/ref-code";
import { sendReplyMatchedEmail } from "@/lib/mail";
import {
  claimInboundFaxCallback,
  generateDownloadToken,
  getRefMapping,
  saveInboundReply,
} from "@/lib/reply-store";

export const runtime = "nodejs";

/** Browser health checks — Sinch only POSTs to this URL. */
export function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed — outbound fax callbacks use POST" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

/**
 * Verify outbound callbacks genuinely came from our Phaxio account setup.
 * Configure `PHAXIO_WEBHOOK_TOKEN` in Phaxio dashboard / env and send the same value in
 * `Authorization: Bearer …` or `X-Phaxio-Signature`.
 */
function authorize(req: NextRequest): boolean {
  const token = process.env.PHAXIO_WEBHOOK_TOKEN?.trim();
  if (!token) return true;
  const header =
    req.headers.get("x-phaxio-signature") ??
    req.headers.get("authorization");
  const ok = header === token || header === `Bearer ${token}`;
  if (!ok) {
    console.warn(
      "[Phaxio webhook] auth mismatch — set PHAXIO_WEBHOOK_TOKEN in Vercel to match dashboard header (X-Phaxio-Signature or Authorization: Bearer …)",
    );
  }
  return ok;
}

function parseOutboundFaxId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function stripeSessionFromLabels(
  faxLike: Record<string, unknown> | null,
  json: Record<string, unknown>,
): string | null {
  const labelsRaw =
    (faxLike?.labels != null && typeof faxLike.labels === "object"
      ? faxLike.labels
      : null) ??
    (json.labels != null && typeof json.labels === "object"
      ? json.labels
      : null);
  if (!labelsRaw || typeof labelsRaw !== "object") return null;
  const sid = (labelsRaw as Record<string, unknown>).ronfax_stripe_session;
  return typeof sid === "string" && sid.startsWith("cs_") ? sid : null;
}

/** Phaxio legacy JSON + Sinch v3 `faxCompleted` / `FAX_COMPLETED` (JSON body). */
function parseOutboundSentFromJson(json: Record<string, unknown>): {
  faxId: string;
  statusRaw: string;
  errorMessage: string | null;
  stripeSessionIdHint: string | null;
} | null {
  const faxLike =
    json.fax != null && typeof json.fax === "object"
      ? (json.fax as Record<string, unknown>)
      : json.data != null && typeof json.data === "object"
        ? (json.data as Record<string, unknown>)
        : null;

  const topDirection = String(json.direction ?? "").toLowerCase();
  const faxDirection = String(faxLike?.direction ?? "").toUpperCase();
  if (topDirection === "received") return null;
  if (faxDirection === "INBOUND") return null;

  const idRaw =
    faxLike?.id ??
    json.id ??
    json.fax_id ??
    (faxLike as Record<string, unknown> | null)?.fax_id;
  const faxId = parseOutboundFaxId(idRaw);
  if (!faxId) return null;

  const statusRaw = String(
    faxLike?.status ?? json.status ?? json.completion_status ?? "",
  );
  const errRaw =
    faxLike?.errorMessage ??
    faxLike?.error_message ??
    json.error_message ??
    faxLike?.error_type ??
    json.error_type ??
    null;
  const errorMessage =
    typeof errRaw === "string"
      ? errRaw
      : errRaw != null
        ? String(errRaw)
        : null;

  const stripeSessionIdHint = stripeSessionFromLabels(faxLike, json);

  return { faxId, statusRaw, errorMessage, stripeSessionIdHint };
}

async function handleOutboundSentMultipart(form: FormData): Promise<void> {
  const idRaw = form.get("id") ?? form.get("fax_id");
  const faxId = parseOutboundFaxId(idRaw);
  if (!faxId) {
    console.warn("[fax webhook sent] missing fax id");
    return;
  }

  const statusRaw = String(
    form.get("status") ??
      form.get("completion_status") ??
      form.get("fax_status") ??
      "",
  );
  const errRaw =
    form.get("error_message") ??
    form.get("error_type") ??
    form.get("message");
  const errorMessage =
    typeof errRaw === "string"
      ? errRaw
      : errRaw != null
        ? String(errRaw)
        : null;

  let stripeSessionIdHint: string | null = null;
  const labelsField = form.get("labels");
  if (typeof labelsField === "string" && labelsField.trim()) {
    try {
      const lab = JSON.parse(labelsField) as Record<string, unknown>;
      const sid = lab.ronfax_stripe_session;
      if (typeof sid === "string" && sid.startsWith("cs_")) {
        stripeSessionIdHint = sid;
      }
    } catch {
      /* ignore */
    }
  }

  let outbound: Awaited<ReturnType<typeof applyPhaxioOutboundStatus>> = {
    applied: false,
  };
  try {
    outbound = await applyPhaxioOutboundStatus({
      faxId,
      statusRaw,
      errorMessage,
      stripeSessionIdHint,
    });
  } catch (e) {
    console.error("[Phaxio webhook] multipart outbound apply failed", e);
  }
  if (outbound.applied && outbound.isTerminal && outbound.trackToken) {
    try {
      await cleanupTrackPdfBlobAfterTerminal(outbound.trackToken);
    } catch (e) {
      console.error("[Phaxio webhook] terminal blob cleanup (non-fatal)", e);
    }
  }
}

/** Phaxio send/receive callbacks are usually multipart form posts (not JSON). */
export async function POST(req: NextRequest) {
  try {
    console.log(
      "Phaxio Body:",
      (await req.clone().text()).slice(0, 16000),
    );
  } catch (e) {
    console.log("Phaxio Body: <could not read>", e);
  }

  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("application/json")) {
    try {
      const json = (await req.json()) as Record<string, unknown>;
      const parsed = parseOutboundSentFromJson(json);
      if (parsed) {
        let outbound: Awaited<ReturnType<typeof applyPhaxioOutboundStatus>> = {
          applied: false,
        };
        try {
          outbound = await applyPhaxioOutboundStatus({
            faxId: parsed.faxId,
            statusRaw: parsed.statusRaw,
            errorMessage: parsed.errorMessage,
            stripeSessionIdHint: parsed.stripeSessionIdHint,
          });
        } catch (applyErr) {
          console.error(
            "[Phaxio webhook] outbound apply failed (non-fatal)",
            applyErr,
          );
        }
        if (outbound.applied && outbound.isTerminal && outbound.trackToken) {
          try {
            await cleanupTrackPdfBlobAfterTerminal(outbound.trackToken);
          } catch (e) {
            console.error(
              "[Phaxio webhook] terminal blob cleanup JSON (non-fatal)",
              e,
            );
          }
        }
      }
    } catch (e) {
      console.error("[Phaxio webhook] JSON body failed", e);
    }
    return NextResponse.json({ received: true });
  }

  if (!ct.includes("multipart/form-data")) {
    const text = await req.text();
    console.log(
      "Sinch Webhook received (non-multipart body preview):",
      text.slice(0, 400),
    );
    return NextResponse.json({ received: true });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    console.error("[Phaxio webhook] formData failed", e);
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const direction = String(form.get("direction") ?? "").toLowerCase();
  const event = String(form.get("event") ?? "").toUpperCase();

  /** Sinch v3 outbound completion may use `event=FAX_COMPLETED` without legacy `direction=sent`. */
  if (direction === "sent" || event === "FAX_COMPLETED") {
    try {
      await handleOutboundSentMultipart(form);
    } catch (e) {
      console.error("[Phaxio webhook sent] handler failed", e);
    }
    return NextResponse.json({ received: true });
  }

  if (direction !== "received") {
    console.info("[Phaxio webhook] unknown direction/event", {
      direction,
      event,
    });
    return NextResponse.json({ received: true });
  }

  const successRaw = form.get("success");
  const ok =
    String(successRaw).toLowerCase() === "true" || successRaw === "1";

  if (!ok) {
    console.warn("[Phaxio receive] success=false");
    return NextResponse.json({ received: true });
  }

  const idRaw = form.get("id") ?? form.get("fax_id");
  const faxId = parseOutboundFaxId(idRaw);
  if (!faxId) {
    console.error("[fax receive] missing fax id");
    return NextResponse.json({ received: true });
  }

  const claimed = await claimInboundFaxCallback(faxId);
  if (!claimed) {
    return NextResponse.json({ received: true });
  }

  const metadataStr =
    typeof form.get("metadata") === "string"
      ? (form.get("metadata") as string)
      : "";

  const fileEntry = form.get("file");
  let pdfBuffer: Buffer | null = null;
  if (fileEntry instanceof Blob) {
    pdfBuffer = Buffer.from(await fileEntry.arrayBuffer());
  }

  if (!pdfBuffer?.length) {
    console.error("[Phaxio receive] no file buffer");
    return NextResponse.json({ received: true });
  }

  const fromNumber =
    typeof form.get("from_number") === "string"
      ? (form.get("from_number") as string)
      : undefined;

  const refsMeta = extractRefCodes(metadataStr);
  let pdfText = "";
  try {
    /** Dynamic import — `pdf-parse` pulls code that expects browser APIs at module load; keep off route cold path. */
    const { extractPdfText } = await import("@/lib/pdf-text");
    pdfText = await extractPdfText(pdfBuffer);
  } catch (e) {
    console.warn("[Phaxio receive] pdf text extract", e);
  }
  const refsPdf = extractRefCodes(pdfText);

  let mapping: Awaited<ReturnType<typeof getRefMapping>> = null;
  let matchedVia: "metadata" | "pdf_text" | null = null;
  let matchedRef: string | null = null;

  for (const ref of refsMeta) {
    const m = await getRefMapping(ref);
    if (m) {
      mapping = m;
      matchedVia = "metadata";
      matchedRef = ref;
      break;
    }
  }
  if (!mapping || !matchedRef) {
    for (const ref of refsPdf) {
      const m = await getRefMapping(ref);
      if (m) {
        mapping = m;
        matchedVia = "pdf_text";
        matchedRef = ref;
        break;
      }
    }
  }

  if (!mapping || !matchedVia || !matchedRef) {
    console.info("[Phaxio receive] no RF-XXXX match", {
      faxId,
      refsMeta,
      refsPdfCount: refsPdf.length,
    });
    return NextResponse.json({ received: true });
  }

  let blobPathname: string;
  try {
    const stored = await storeReplyPdf(pdfBuffer, matchedRef, faxId);
    blobPathname = stored.pathname;
  } catch (e) {
    console.error("[Phaxio receive] blob store failed", e);
    return NextResponse.json({ error: "Storage" }, { status: 500 });
  }

  const downloadToken = generateDownloadToken();
  const saved = await saveInboundReply({
    downloadToken,
    refCode: matchedRef,
    phaxioFaxId: faxId,
    blobPathname,
    notifyEmail: mapping.contactEmail,
    matchedVia,
    createdAt: Date.now(),
    paid: false,
  });

  if (!saved) {
    console.error("[RonFax] inbound reply not persisted (Redis?)");
    return NextResponse.json({ received: true });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const payUrl = appUrl
    ? `${appUrl}/api/reply/checkout?d=${encodeURIComponent(downloadToken)}`
    : "";

  if (payUrl) {
    await sendReplyMatchedEmail({
      to: mapping.contactEmail,
      refCode: matchedRef,
      payUrl,
      fromNumber,
    });
  }

  return NextResponse.json({ received: true });
}

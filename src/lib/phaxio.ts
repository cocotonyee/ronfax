import {
  getSiteUrl,
  isLocalOrLoopbackOrigin,
} from "@/lib/site-url";

/**
 * Outbound fax send via **Sinch Fax API v3** (Phaxio migration path).
 * @see https://developers.sinch.com/docs/fax/v2-v3migration
 *
 * Webhook URL for completion callbacks — same path kept for fewer dashboard changes.
 * Uses {@link getSiteUrl} so preview/prod always send a public HTTPS origin when configured.
 */
export function getPhaxioOutboundCallbackUrl(): string | null {
  const base = getSiteUrl();
  if (
    process.env.NODE_ENV === "production" &&
    isLocalOrLoopbackOrigin(base)
  ) {
    console.error(
      "[Sinch Fax] Refusing localhost/loopback callbackUrl in production — set NEXT_PUBLIC_APP_URL to your public https domain.",
    );
    return null;
  }
  return `${base}/api/webhooks/phaxio`;
}

const SINCH_FAX_API = "https://fax.api.sinch.com";

/** Sinch Build dashboard → Access keys (Key ID + Key Secret). Reuses legacy PHAXIO_* env names. */
function requireSinchBasicAuth(): string {
  const key = process.env.PHAXIO_API_KEY;
  const secret = process.env.PHAXIO_API_SECRET;
  if (!key || !secret) {
    throw new Error("Missing PHAXIO_API_KEY or PHAXIO_API_SECRET (Sinch key id + secret)");
  }
  return Buffer.from(`${key}:${secret}`).toString("base64");
}

function requireProjectId(): string {
  const id = process.env.PHAXIO_PROJECT_ID?.trim();
  if (!id) {
    throw new Error("Missing PHAXIO_PROJECT_ID (Sinch project id)");
  }
  return id;
}

function sinchSendFaxUrl(): string {
  const projectId = requireProjectId();
  /** Sinch Fax API v3 — not v1 */
  return `${SINCH_FAX_API}/v3/projects/${encodeURIComponent(projectId)}/faxes`;
}

function sinchDebugLogging(): boolean {
  return (
    process.env.SINCH_FAX_DEBUG === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

function appendOutboundOptions(form: FormData, headerText?: string): void {
  const cb = getPhaxioOutboundCallbackUrl();
  if (cb) {
    form.append("callbackUrl", cb);
    form.append("callbackUrlContentType", "application/json");
  } else {
    console.warn(
      "[Sinch Fax] completion callbackUrl omitted (check NEXT_PUBLIC_APP_URL and production localhost guard)",
    );
  }
  const from = process.env.SINCH_FAX_FROM?.trim() || process.env.PHAXIO_CALLER_ID?.trim();
  if (from) {
    form.append("from", from);
  }
  if (headerText) {
    const t = headerText.trim().slice(0, 50);
    if (t) form.append("headerText", t);
  }
}

/**
 * POST multipart to Sinch; response is JSON fax object with string `id`.
 */
function logMultipartSummary(form: FormData): void {
  const summary: Record<string, string> = {};
  try {
    for (const [key, value] of form.entries()) {
      if (value instanceof Blob) {
        summary[key] = `[Blob ${value.size} bytes, ${value.type || "no type"}]`;
      } else {
        summary[key] = String(value).slice(0, 800);
      }
    }
  } catch {
    summary._note = "could not enumerate FormData";
  }
  console.log(
    "SENDING TO SINCH (multipart fields):",
    JSON.stringify(summary),
  );
}

async function postSinchFaxMultipart(form: FormData): Promise<{
  faxId: string | null;
  raw: unknown;
}> {
  if (sinchDebugLogging()) {
    logMultipartSummary(form);
  }
  const auth = requireSinchBasicAuth();
  const res = await fetch(sinchSendFaxUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: form,
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      typeof raw.message === "string"
        ? raw.message
        : typeof raw.error === "string"
          ? raw.error
          : `Sinch Fax API failed (${res.status})`;
    throw new Error(msg);
  }

  const idRaw = raw.id;
  const faxId =
    typeof idRaw === "string" && idRaw.length > 0
      ? idRaw
      : idRaw != null
        ? String(idRaw)
        : null;

  return { faxId, raw };
}

async function postSinchFaxJson(body: Record<string, unknown>): Promise<{
  faxId: string | null;
  raw: unknown;
}> {
  if (sinchDebugLogging()) {
    console.log("SENDING TO SINCH:", JSON.stringify(body));
  }
  const auth = requireSinchBasicAuth();
  const res = await fetch(sinchSendFaxUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      typeof raw.message === "string"
        ? raw.message
        : typeof raw.error === "string"
          ? raw.error
          : `Sinch Fax API failed (${res.status})`;
    throw new Error(msg);
  }

  const idRaw = raw.id;
  const faxId =
    typeof idRaw === "string" && idRaw.length > 0
      ? idRaw
      : idRaw != null
        ? String(idRaw)
        : null;

  return { faxId, raw };
}

/**
 * Sends a fax using a public PDF URL.
 * Sinch JSON field is **`contentUrl`** (not `fileUrl`); we only use `fileUrl` as our param name.
 */
export async function sendFaxWithPublicFileUrl(params: {
  toE164: string;
  fileUrl: string;
  headerText?: string;
}): Promise<{ faxId: string | null; raw: unknown }> {
  const u = params.fileUrl.trim();
  if (!/^https?:\/\//i.test(u)) {
    throw new Error("fileUrl must be an http(s) URL");
  }
  const payload: Record<string, unknown> = {
    to: params.toE164,
    contentUrl: u,
  };
  const cb = getPhaxioOutboundCallbackUrl();
  if (cb) {
    payload.callbackUrl = cb;
    payload.callbackUrlContentType = "application/json";
  }
  const from = process.env.SINCH_FAX_FROM?.trim() || process.env.PHAXIO_CALLER_ID?.trim();
  if (from) payload.from = from;
  if (params.headerText) {
    const t = params.headerText.trim().slice(0, 50);
    if (t) payload.headerText = t;
  }
  return postSinchFaxJson(payload);
}

/**
 * Sends a PDF via multipart `file` (same flow as Phaxio form upload).
 */
export async function sendFaxWithPdf(params: {
  toE164: string;
  pdf: Buffer;
  filename: string;
  headerText?: string;
}): Promise<{ faxId: string | null; raw: unknown }> {
  const form = new FormData();
  form.append("to", params.toE164);
  const pdfBytes = new Uint8Array(params.pdf);
  form.append(
    "file",
    new Blob([pdfBytes], { type: "application/pdf" }),
    params.filename.replace(/[^\w.\-]+/g, "_") || "document.pdf",
  );
  appendOutboundOptions(form, params.headerText);
  return postSinchFaxMultipart(form);
}

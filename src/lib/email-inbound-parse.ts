import { NextRequest, NextResponse } from "next/server";

/** Normalized inbound shape consumed by `/api/webhooks/email-inbound` */

export type InboundAttachmentJson = {
  file_name: string;
  content_type?: string;
  /** Base64 (standard or URL-safe); optional `data:...;base64,` prefix allowed */
  content?: string;
};

export type InboundJsonLike = {
  headers?: { "Message-Id"?: string; message_id?: string };
  envelope?: { from?: string; to?: string };
  reply_plain?: string;
  subject?: string;
  attachments?: InboundAttachmentJson[];
  /** Cloudflare worker raw-forward mode (base64-encoded RFC822 source) */
  raw_rfc822_base64?: string;
  raw_rfc822_encoding?: string;
};

export type ParsedEmailInbound =
  | { ok: true; body: InboundJsonLike }
  | { ok: false; response: NextResponse };

function decodeBase64PayloadLoose(b64: string): Buffer | null {
  const trimmed = b64.trim();
  const dataUrlIdx = trimmed.indexOf("base64,");
  const raw =
    dataUrlIdx >= 0 ? trimmed.slice(dataUrlIdx + "base64,".length) : trimmed;
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded =
    pad === 0 ? normalized : normalized + "=".repeat(4 - pad);
  try {
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

/** True if bytes look like a PDF after Cloudflare / MIME forwarding. */
export function bufferLooksLikePdf(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  const head = buf.subarray(0, 5).toString("latin1");
  return head.startsWith("%PDF");
}

/**
 * Prefer filename / content-type hint, then sniff PDF magic (Worker may rename parts).
 */

export function shouldTreatAsPdf(
  buf: Buffer,
  fileName: string,
  contentType?: string,
): boolean {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return true;
  if (
    contentType?.toLowerCase().includes("pdf") ||
    contentType === "application/octet-stream"
  ) {
    return bufferLooksLikePdf(buf);
  }
  return bufferLooksLikePdf(buf);
}

export function attachmentToBuffer(
  att: InboundAttachmentJson,
): { buf: Buffer; file_name: string; content_type?: string } | null {
  if (!att?.content?.trim()) return null;
  const buf = decodeBase64PayloadLoose(att.content);
  if (!buf || buf.length === 0) return null;
  const name =
    typeof att.file_name === "string" && att.file_name.trim()
      ? att.file_name.trim()
      : "attachment.bin";
  return { buf, file_name: name, content_type: att.content_type };
}

async function blobToAttachmentJson(
  file: Blob,
  fallbackName: string,
): Promise<InboundAttachmentJson> {
  const buf = Buffer.from(await file.arrayBuffer());
  let name =
    typeof (file as File).name === "string" &&
    ((file as File).name ?? "").trim() !== ""
      ? (file as File).name
      : fallbackName;
  if (!name || name.trim() === "") name = fallbackName;
  const content_type = file.type || undefined;
  return {
    file_name: name,
    content_type,
    content: buf.toString("base64"),
  };
}

/** Cloudflare Workers often POST `multipart/form-data` with `payload` JSON or discrete fields + files */
async function parseMultipart(req: NextRequest): Promise<ParsedEmailInbound> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid multipart body" },
        { status: 400 },
      ),
    };
  }

  const payloadField = form.get("payload") ?? form.get("body");
  if (typeof payloadField === "string" && payloadField.trim().startsWith("{")) {
    try {
      const body = JSON.parse(payloadField) as InboundJsonLike;
      return { ok: true, body };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "`payload` must be valid JSON when provided" },
          { status: 400 },
        ),
      };
    }
  }

  const fromRaw =
    String(form.get("from") ?? "") ||
    String(form.get("envelope_from") ?? "") ||
    String(form.get("Envelope-From") ?? "");
  const toRaw =
    String(form.get("to") ?? "") ||
    String(form.get("envelope_to") ?? "") ||
    String(form.get("Envelope-To") ?? "");
  const subject = String(form.get("subject") ?? "");
  const messageId =
    String(form.get("message_id") ?? form.get("Message-Id") ?? "") ||
    `gen-${Date.now()}`;

  const attachments: InboundAttachmentJson[] = [];
  let fileIndex = 0;
  for (const [, value] of form.entries()) {
    if (typeof value !== "object" || value === null) continue;
    if (!(value instanceof Blob)) continue;

    try {
      const att = await blobToAttachmentJson(
        value,
        `attachment-${fileIndex}`,
      );
      attachments.push(att);
      fileIndex += 1;
    } catch {
      console.warn("[email-inbound] skip unreadable multipart file part");
    }
  }

  if (!fromRaw.trim() || !toRaw.trim()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Multipart requests need `payload` JSON, or fields `from`/`to` (or envelope_from/envelope_to) plus file attachments",
        },
        { status: 400 },
      ),
    };
  }

  const body: InboundJsonLike = {
    headers: {
      "Message-Id": messageId,
      message_id: messageId,
    },
    envelope: { from: fromRaw.trim(), to: toRaw.trim() },
    subject,
    attachments,
  };

  return { ok: true, body };
}

/**
 * Parses JSON (Cloudflare / worker or legacy provider) or `multipart/form-data`
 * forwarded by a Cloudflare Worker.
 */
export async function parseEmailInboundRequest(
  req: NextRequest,
): Promise<ParsedEmailInbound> {
  const ctRaw = req.headers.get("content-type") ?? "";
  const ct = ctRaw.toLowerCase();

  if (ct.includes("application/x-www-form-urlencoded")) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Use multipart/form-data with file parts or JSON body; URL-encoded payloads cannot carry raw PDF bytes",
        },
        { status: 400 },
      ),
    };
  }

  if (ct.includes("multipart/form-data")) {
    return parseMultipart(req);
  }

  if (
    ct.includes("application/json") ||
    ct === "" ||
    ct === "*/*" ||
    ct === "*"
  ) {
    try {
      const body = (await req.json()) as InboundJsonLike;
      return { ok: true, body };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Expected JSON body or multipart/form-data" },
          { status: 400 },
        ),
      };
    }
  }

  /* Some proxies send octet-stream with JSON — try JSON once */
  try {
    const body = (await req.json()) as InboundJsonLike;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unsupported Content-Type; use application/json or multipart/form-data" },
        { status: 415 },
      ),
    };
  }
}

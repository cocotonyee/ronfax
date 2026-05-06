import { simpleParser } from "mailparser";
import type { InboundAttachmentJson, InboundJsonLike } from "@/lib/email-inbound-parse";

function toBase64(v: Buffer | Uint8Array | null | undefined): string | null {
  if (!v) return null;
  const b = Buffer.isBuffer(v) ? v : Buffer.from(v);
  if (!b.length) return null;
  return b.toString("base64");
}

function firstParsedAddress(v: unknown): string | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const a = firstParsedAddress(item);
      if (a) return a;
    }
    return null;
  }
  if (typeof v === "object") {
    const obj = v as {
      address?: string;
      value?: Array<{ address?: string }>;
    };
    if (typeof obj.address === "string" && obj.address.trim()) {
      return obj.address.trim();
    }
    if (Array.isArray(obj.value)) {
      for (const item of obj.value) {
        if (typeof item?.address === "string" && item.address.trim()) {
          return item.address.trim();
        }
      }
    }
  }
  return null;
}

/** Parse raw RFC822 bytes (forwarded by Cloudflare email worker) into the normalized inbound JSON shape. */
export async function parseRfc822ToInbound(
  rawRfc822Base64: string,
  fallback: {
    from?: string;
    to?: string;
    subject?: string;
    messageId?: string;
  },
): Promise<InboundJsonLike> {
  const raw = Buffer.from(rawRfc822Base64, "base64");
  const parsed = await simpleParser(raw);

  const from = firstParsedAddress(parsed.from) ?? fallback.from?.trim() ?? "";
  const to = firstParsedAddress(parsed.to) ?? fallback.to?.trim() ?? "";
  const subject = (parsed.subject ?? fallback.subject ?? "").trim();
  const messageId =
    parsed.messageId?.trim() ?? fallback.messageId?.trim() ?? `gen-${Date.now()}`;

  const attachments: InboundAttachmentJson[] = [];
  for (let i = 0; i < (parsed.attachments?.length ?? 0); i++) {
    const a = parsed.attachments[i];
    if (!a) continue;
    const content = toBase64(a.content);
    if (!content) continue;
    attachments.push({
      file_name: a.filename?.trim() || `attachment-${i}`,
      content_type: a.contentType || undefined,
      content,
    });
  }

  return {
    headers: { "Message-Id": messageId, message_id: messageId },
    envelope: { from, to },
    subject,
    attachments,
  };
}

/**
 * Sends a PDF via Phaxio REST API.
 * @see https://www.phaxio.com/docs/api-reference/faxes/send-a-fax
 */
export async function sendFaxWithPdf(params: {
  toE164: string;
  pdf: Buffer;
  filename: string;
  /** Shown at top of each page (Phaxio max 50 chars). */
  headerText?: string;
}): Promise<{ faxId: number | null; raw: unknown }> {
  const key = process.env.PHAXIO_API_KEY;
  const secret = process.env.PHAXIO_API_SECRET;
  if (!key || !secret) {
    throw new Error("Missing PHAXIO_API_KEY or PHAXIO_API_SECRET");
  }

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const form = new FormData();
  form.append("to", params.toE164);
  const pdfBytes = new Uint8Array(params.pdf);
  form.append(
    "file",
    new Blob([pdfBytes], { type: "application/pdf" }),
    params.filename.replace(/[^\w.\-]+/g, "_") || "document.pdf",
  );

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (base) {
    form.append("callback_url", `${base}/api/webhooks/phaxio`);
  }

  if (params.headerText) {
    const t = params.headerText.trim().slice(0, 50);
    if (t) form.append("header_text", t);
  }

  const res = await fetch("https://api.phaxio.com/v2/faxes", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: form,
  });

  const raw = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!res.ok) {
    const msg =
      typeof raw.message === "string"
        ? raw.message
        : `Phaxio request failed (${res.status})`;
    throw new Error(msg);
  }

  const data = raw.data as { id?: number } | undefined;
  const id = data?.id;
  const faxId =
    typeof id === "number" && Number.isFinite(id) ? id : null;

  return { faxId, raw };
}

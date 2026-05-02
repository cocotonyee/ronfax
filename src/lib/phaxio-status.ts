/**
 * Poll Phaxio for fax delivery state.
 * @see https://www.phaxio.com/docs/api/v2.1/faxes/get_fax
 */
export type PhaxioFaxView = {
  id: number;
  status?: string;
  completed_at?: string | null;
  error_message?: string | null;
};

export async function getPhaxioFax(
  faxId: number,
): Promise<PhaxioFaxView | null> {
  const key = process.env.PHAXIO_API_KEY;
  const secret = process.env.PHAXIO_API_SECRET;
  if (!key || !secret) return null;

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const urls = [
    `https://api.phaxio.com/v2/faxes/${faxId}`,
    `https://api.phaxio.com/v2.1/faxes/${faxId}`,
  ];

  for (const url of urls) {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      next: { revalidate: 0 },
    });
    const raw = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) continue;
    const data = raw.data as Record<string, unknown> | undefined;
    if (!data) continue;
    return {
      id: Number(data.id ?? faxId),
      status: typeof data.status === "string" ? data.status : undefined,
      completed_at:
        data.completed_at != null ? String(data.completed_at) : null,
      error_message:
        typeof data.error_message === "string" ? data.error_message : null,
    };
  }

  return null;
}

export function mapPhaxioToUi(
  status?: string,
): "pending" | "success" | "failure" {
  if (!status) return "pending";
  const s = status.toLowerCase();
  if (s === "success" || s === "partialsuccess") return "success";
  if (s === "failure") return "failure";
  return "pending";
}

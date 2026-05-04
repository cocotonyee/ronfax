/**
 * Poll Sinch Fax API v3 for delivery state (legacy name kept for imports).
 * @see https://developers.sinch.com/docs/fax/api-reference/fax/faxes/getfaxinfoperid.md
 */
export type PhaxioFaxView = {
  id: string | number;
  status?: string;
  completed_at?: string | null;
  error_message?: string | null;
};

function sinchProjectId(): string | undefined {
  return process.env.PHAXIO_PROJECT_ID?.trim();
}

export async function getPhaxioFax(
  faxId: string | number,
): Promise<PhaxioFaxView | null> {
  const key = process.env.PHAXIO_API_KEY;
  const secret = process.env.PHAXIO_API_SECRET;
  const projectId = sinchProjectId();
  if (!key || !secret || !projectId) return null;

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const id = encodeURIComponent(String(faxId));
  const url = `https://fax.api.sinch.com/v3/projects/${encodeURIComponent(projectId)}/faxes/${id}`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    next: { revalidate: 0 },
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return null;

  const status = typeof raw.status === "string" ? raw.status : undefined;
  const err =
    typeof raw.errorMessage === "string"
      ? raw.errorMessage
      : typeof raw.error_message === "string"
        ? raw.error_message
        : null;

  const completed =
    raw.completedTime != null
      ? String(raw.completedTime)
      : raw.completed_at != null
        ? String(raw.completed_at)
        : null;

  const idOut =
    typeof raw.id === "string"
      ? raw.id
      : raw.id != null
        ? String(raw.id)
        : String(faxId);

  return {
    id: idOut,
    status,
    completed_at: completed,
    error_message: err,
  };
}

/** Maps Phaxio legacy + Sinch v3 status strings to UI terminal states. */
export function mapPhaxioToUi(
  status?: string,
): "pending" | "success" | "failure" {
  if (!status) return "pending";
  const s = status.toUpperCase();
  // Sinch v3
  if (s === "COMPLETED") return "success";
  if (s === "FAILURE") return "failure";
  if (s === "QUEUED" || s === "IN_PROGRESS") return "pending";
  // Phaxio legacy
  const lower = status.toLowerCase();
  if (lower === "success" || lower === "partialsuccess") return "success";
  if (lower === "failure") return "failure";
  return "pending";
}

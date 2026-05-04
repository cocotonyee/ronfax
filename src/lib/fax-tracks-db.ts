import { getSupabaseAdmin } from "@/lib/supabase-server";

export type FaxTrackRow = {
  stripe_session_id: string;
  fax_id: string | null;
  contact_email: string;
  delivery_status: string;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  fax_to: string | null;
  page_count: number | null;
  amount_cents: number | null;
  contact_name: string | null;
  ref_code: string | null;
  error_message: string | null;
  phaxio_last_status: string | null;
  progress_percent: number | null;
  payment_verified: boolean | null;
};

/** Fax row for status UI / webhooks (camelCase). */
export type FaxTrackPayload = {
  stripeSessionId: string;
  refCode?: string;
  contactEmail: string;
  contactName?: string;
  faxTo: string;
  pageCount: number;
  amountCents: number;
  faxId: string | number | null;
  deliveryStatus: string;
  phaxioLastStatus?: string;
  errorMessage?: string;
  paymentVerified?: boolean;
  linked?: boolean;
  progressPercent?: number;
  pdfUrl?: string | null;
  updatedAt: number;
};

export function rowToPayload(r: FaxTrackRow): FaxTrackPayload {
  return {
    stripeSessionId: r.stripe_session_id,
    refCode: r.ref_code ?? undefined,
    contactEmail: r.contact_email,
    contactName: r.contact_name ?? undefined,
    faxTo: r.fax_to ?? "",
    pageCount: r.page_count ?? 0,
    amountCents: r.amount_cents ?? 0,
    faxId: r.fax_id,
    deliveryStatus: r.delivery_status,
    phaxioLastStatus: r.phaxio_last_status ?? undefined,
    errorMessage: r.error_message ?? undefined,
    paymentVerified: r.payment_verified ?? undefined,
    progressPercent: r.progress_percent ?? undefined,
    pdfUrl: r.pdf_url,
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

function payloadToRow(p: FaxTrackPayload): Record<string, unknown> {
  return {
    stripe_session_id: p.stripeSessionId,
    fax_id: p.faxId == null ? null : String(p.faxId),
    contact_email: p.contactEmail,
    contact_name: p.contactName ?? null,
    fax_to: p.faxTo,
    page_count: p.pageCount,
    amount_cents: p.amountCents,
    ref_code: p.refCode ?? null,
    error_message: p.errorMessage ?? null,
    phaxio_last_status: p.phaxioLastStatus ?? null,
    progress_percent: p.progressPercent ?? null,
    payment_verified: p.paymentVerified ?? true,
    delivery_status: p.deliveryStatus,
    pdf_url: p.pdfUrl ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function getFaxTrackBySessionId(
  stripeSessionId: string,
): Promise<FaxTrackPayload | null> {
  const sup = getSupabaseAdmin();
  if (!sup) return null;
  const { data, error } = await sup
    .from("fax_tracks")
    .select("*")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToPayload(data as FaxTrackRow);
}

export async function getFaxTrackByFaxId(
  faxId: string | number,
): Promise<FaxTrackPayload | null> {
  const sup = getSupabaseAdmin();
  if (!sup) return null;
  const fid = String(faxId).trim();
  if (!fid) return null;
  const { data, error } = await sup
    .from("fax_tracks")
    .select("*")
    .eq("fax_id", fid)
    .maybeSingle();
  if (error || !data) return null;
  return rowToPayload(data as FaxTrackRow);
}

export async function upsertFaxTrack(payload: FaxTrackPayload): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return false;
  const row = payloadToRow(payload);
  const { error } = await sup.from("fax_tracks").upsert(row, {
    onConflict: "stripe_session_id",
  });
  if (error) {
    console.error("[fax_tracks] upsert failed", error);
    return false;
  }
  return true;
}

export async function mergePatchFaxTrack(
  stripeSessionId: string,
  patch: Partial<FaxTrackPayload>,
): Promise<boolean> {
  const cur = await getFaxTrackBySessionId(stripeSessionId);
  if (!cur) {
    console.error("[fax_tracks] mergePatch: no row", stripeSessionId);
    return false;
  }
  const next: FaxTrackPayload = {
    ...cur,
    ...patch,
    stripeSessionId,
    faxId: patch.faxId !== undefined ? patch.faxId : cur.faxId,
    pdfUrl: patch.pdfUrl !== undefined ? patch.pdfUrl : cur.pdfUrl,
    updatedAt: Date.now(),
  };
  return upsertFaxTrack(next);
}

export async function mergePatchFaxTrackByFaxId(
  faxId: string | number,
  patch: Partial<FaxTrackPayload>,
): Promise<boolean> {
  const cur = await getFaxTrackByFaxId(faxId);
  if (!cur) return false;
  return mergePatchFaxTrack(cur.stripeSessionId, patch);
}

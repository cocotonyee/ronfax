import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  shortRefFromStripeSession,
  type RefMappingValue,
} from "@/lib/ref-code";

export const REPLY_UNLOCK_CENTS = 99;

export type InboundReplyRecord = {
  downloadToken: string;
  refCode: string;
  phaxioFaxId: string | number;
  blobPathname: string;
  /** Original outbound sender */
  notifyEmail: string;
  matchedVia: "metadata" | "pdf_text";
  createdAt: number;
  paid: boolean;
};

export async function allocateRefCode(
  data: RefMappingValue,
): Promise<string | null> {
  const sup = getSupabaseAdmin();
  if (!sup) return null;

  for (let salt = 0; salt < 48; salt++) {
    const ref = shortRefFromStripeSession(data.stripeSessionId, salt);
    const { error } = await sup.from("reply_ref_mappings").insert({
      ref_code: ref,
      mapping: data as unknown as Record<string, unknown>,
    });
    if (!error) return ref;
    if (error.code !== "23505") {
      console.error("[reply-store] allocateRefCode insert", error);
      return null;
    }
  }

  const n = randomBytes(2).readUInt16BE(0) % 10000;
  const fallback = `RF-${n.toString().padStart(4, "0")}`;
  const { error } = await sup.from("reply_ref_mappings").insert({
    ref_code: fallback,
    mapping: data as unknown as Record<string, unknown>,
  });
  return error ? null : fallback;
}

export async function getRefMapping(
  refCode: string,
): Promise<RefMappingValue | null> {
  const sup = getSupabaseAdmin();
  if (!sup) return null;
  const { data, error } = await sup
    .from("reply_ref_mappings")
    .select("mapping")
    .eq("ref_code", refCode)
    .maybeSingle();
  if (error || !data?.mapping) return null;
  return data.mapping as unknown as RefMappingValue;
}

export function generateDownloadToken(): string {
  return randomBytes(32).toString("hex");
}

export async function saveInboundReply(
  rec: InboundReplyRecord,
): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return false;
  const { error } = await sup.from("reply_downloads").upsert(
    {
      download_token: rec.downloadToken,
      record: rec as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "download_token" },
  );
  if (error) {
    console.error("[reply-store] saveInboundReply", error);
    return false;
  }
  return true;
}

export async function getInboundReply(
  downloadToken: string,
): Promise<InboundReplyRecord | null> {
  const sup = getSupabaseAdmin();
  if (!sup) return null;
  const { data, error } = await sup
    .from("reply_downloads")
    .select("record")
    .eq("download_token", downloadToken)
    .maybeSingle();
  if (error || !data?.record) return null;
  return data.record as unknown as InboundReplyRecord;
}

export async function markReplyPaid(downloadToken: string): Promise<void> {
  const cur = await getInboundReply(downloadToken);
  if (!cur) return;
  const sup = getSupabaseAdmin();
  if (!sup) return;
  const next: InboundReplyRecord = { ...cur, paid: true };
  await sup.from("reply_downloads").upsert({
    download_token: downloadToken,
    record: next as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  });
}

export async function claimInboundFaxCallback(
  phaxioFaxId: string | number,
): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return true;
  const id = String(phaxioFaxId).trim();
  const { error } = await sup.from("reply_inbound_dedupe").insert({
    phaxio_fax_id: id,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[reply-store] claimInboundFaxCallback", error);
  return true;
}

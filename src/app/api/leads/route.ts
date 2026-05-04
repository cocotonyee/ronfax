import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; message?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().slice(0, 200) ?? "";
  const message = body.message?.trim().slice(0, 2000) ?? "";
  const source = body.source?.trim().slice(0, 80) ?? "inbound";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const sup = getSupabaseAdmin();
  if (sup) {
    const { error } = await sup.from("leads").insert({
      email,
      message: message || null,
      source,
    });
    if (error) {
      console.error("[RonFax] leads insert", error);
    }
  } else {
    console.info("[RonFax] lead (no Supabase):", { email, message, source });
  }

  return NextResponse.json({ ok: true });
}

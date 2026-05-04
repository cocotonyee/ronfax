import { NextRequest, NextResponse } from "next/server";
import { getUpstashRedis } from "@/lib/upstash-redis";

export const runtime = "nodejs";

const LEADS_KEY = "ronfax:leads";
const MAX_LEADS = 500;

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

  const payload = JSON.stringify({
    email,
    message,
    source,
    createdAt: new Date().toISOString(),
  });

  const r = getUpstashRedis();
  if (r) {
    await r.lpush(LEADS_KEY, payload);
    await r.ltrim(LEADS_KEY, 0, MAX_LEADS - 1);
  } else {
    console.info("[RonFax] lead (no Redis):", payload);
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { buildFaxStatusPayload } from "@/lib/fax-status-payload";

export const runtime = "nodejs";

/** @deprecated Prefer `/api/fax-status/[id]` — kept for backward compatibility. */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }
  const payload = await buildFaxStatusPayload(sessionId);
  if ("error" in payload) {
    return NextResponse.json(payload, { status: 400 });
  }
  return NextResponse.json(payload);
}

import { NextRequest, NextResponse } from "next/server";
import { buildFaxStatusPayload } from "@/lib/fax-status-payload";
import { parseCheckoutSessionId } from "@/lib/fax-track";

export const runtime = "nodejs";

/** @deprecated Prefer `/api/fax-status/[id]` — kept for backward compatibility. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("session_id");
  const sessionId = parseCheckoutSessionId(raw);
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing or invalid session_id (expected cs_…)" },
      { status: 400 },
    );
  }
  const payload = await buildFaxStatusPayload(sessionId);
  if ("error" in payload) {
    return NextResponse.json(payload, { status: 400 });
  }
  return NextResponse.json(payload);
}

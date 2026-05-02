import { NextRequest, NextResponse } from "next/server";
import { buildFaxStatusPayload } from "@/lib/fax-status-payload";

export const runtime = "nodejs";

/** Poll fax transmission status by Stripe Checkout session id (`cs_…`). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const payload = await buildFaxStatusPayload(id);
  if ("error" in payload) {
    return NextResponse.json(payload, { status: 400 });
  }
  return NextResponse.json(payload);
}

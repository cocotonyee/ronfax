import { NextRequest, NextResponse } from "next/server";
import { buildFaxStatusPayload } from "@/lib/fax-status-payload";
import { parseCheckoutSessionId } from "@/lib/fax-track";
import { tryConsumeFaxStatusManualRefresh } from "@/lib/redis";

export const runtime = "nodejs";

/** Fax transmission status by Stripe Checkout session id (`cs_…`). Use `?manual=1` only from “Refresh Status” (max once / 10s). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const id = parseCheckoutSessionId(rawId);
  if (!id) {
    return NextResponse.json(
      { error: "Invalid session id — expected Stripe Checkout id (cs_…)" },
      { status: 400 },
    );
  }
  const manual = req.nextUrl.searchParams.get("manual") === "1";

  if (manual) {
    const ok = await tryConsumeFaxStatusManualRefresh(id);
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "Please wait at least 10 seconds between manual status refreshes.",
        },
        { status: 429 },
      );
    }
  }

  const payload = await buildFaxStatusPayload(id);
  if ("error" in payload) {
    return NextResponse.json(payload, { status: 400 });
  }
  return NextResponse.json(payload);
}

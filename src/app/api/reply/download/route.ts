import { NextRequest, NextResponse } from "next/server";
import { fetchPdfFromPathname } from "@/lib/blob-fax";
import { getInboundReply } from "@/lib/reply-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d")?.trim();
  if (!d) {
    return NextResponse.json({ error: "Missing d" }, { status: 400 });
  }

  const rec = await getInboundReply(d);
  if (!rec || !rec.paid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { buffer } = await fetchPdfFromPathname(rec.blobPathname);
    const safe = rec.refCode.replace(/[^A-Z0-9-]/gi, "") || "reply";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ronfax-reply-${safe}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[reply/download]", e);
    return NextResponse.json({ error: "File unavailable" }, { status: 500 });
  }
}

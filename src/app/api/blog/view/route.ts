import { NextRequest, NextResponse } from "next/server";
import { recordBlogView } from "@/lib/blog-views";
import { getPostBySlug } from "@/lib/blog";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { slug?: string; visitorHash?: string; referer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug || !getPostBySlug(slug)) {
    return NextResponse.json({ error: "Unknown post" }, { status: 400 });
  }

  const ok = await recordBlogView({
    blogSlug: slug,
    visitorHash: body.visitorHash ?? null,
    referer: body.referer ?? null,
  });

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
  return NextResponse.json({ ok: true });
}

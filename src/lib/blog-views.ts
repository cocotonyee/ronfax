import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function recordBlogView(input: {
  blogSlug: string;
  visitorHash?: string | null;
  referer?: string | null;
}): Promise<boolean> {
  const sup = getSupabaseAdmin();
  if (!sup) return false;
  const slug = input.blogSlug.trim().slice(0, 200);
  if (!slug) return false;

  const { error } = await sup.from("blog_views").insert({
    blog_slug: slug,
    visitor_hash: input.visitorHash?.trim().slice(0, 128) || null,
    referer: input.referer?.trim().slice(0, 1000) || null,
  });

  if (error) {
    console.error("[blog_views] insert failed", error);
    return false;
  }
  return true;
}

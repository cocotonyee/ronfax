import fs from "fs";
import matter from "gray-matter";
import path from "path";

export type BlogFaqItem = {
  question: string;
  answer: string;
};

export type BlogFrontmatter = {
  title: string;
  description: string;
  /** ISO date */
  date: string;
  keywords?: string[] | string;
  faq?: BlogFaqItem[];
};

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export function getBlogDir(): string {
  return BLOG_DIR;
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getPostBySlug(slug: string): {
  slug: string;
  data: BlogFrontmatter;
  content: string;
} | null {
  const safe = slug.replace(/[^\w-]/g, "");
  if (!safe || safe !== slug) return null;
  const full = path.join(BLOG_DIR, `${safe}.md`);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, "utf8");
  const { data, content } = matter(raw);
  const d = data as Partial<BlogFrontmatter>;
  if (!d.title || !d.description || !d.date) return null;
  return {
    slug: safe,
    data: {
      title: d.title,
      description: d.description,
      date: d.date,
      keywords: d.keywords,
      faq: Array.isArray(d.faq) ? d.faq : undefined,
    },
    content,
  };
}

export function getAllPostsMeta(): {
  slug: string;
  title: string;
  description: string;
  date: string;
}[] {
  return getPostSlugs()
    .map((slug) => {
      const p = getPostBySlug(slug);
      if (!p) return null;
      return {
        slug,
        title: p.data.title,
        description: p.data.description,
        date: p.data.date,
      };
    })
    .filter(Boolean) as {
    slug: string;
    title: string;
    description: string;
    date: string;
  }[];
}

export function normalizeKeywords(
  k: BlogFrontmatter["keywords"],
): string[] {
  if (Array.isArray(k)) return k.map((s) => String(s).trim()).filter(Boolean);
  if (typeof k === "string" && k.trim())
    return k.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

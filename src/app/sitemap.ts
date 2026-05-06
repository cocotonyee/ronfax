import type { MetadataRoute } from "next";
import { getClinicsIndex } from "@/lib/clinics";
import { getAllPostsMeta } from "@/lib/blog";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const { list } = await getClinicsIndex();
  const posts = getAllPostsMeta();

  const staticPaths = [
    "",
    "/templates",
    "/blog",
    "/privacy",
    "/terms",
  ] as const;

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.75,
  }));

  const faxToEntries: MetadataRoute.Sitemap = list.map((c) => ({
    url: `${base}/fax-to/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.65,
  }));

  const templateEntries: MetadataRoute.Sitemap = list.map((c) => ({
    url: `${base}/templates/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.68,
  }));

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.72,
  }));

  return [...staticEntries, ...blogEntries, ...templateEntries, ...faxToEntries];
}

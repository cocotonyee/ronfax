import type { MetadataRoute } from "next";
import { getClinicsIndex } from "@/lib/clinics";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const { list } = await getClinicsIndex();

  const staticPaths = [
    "",
    "/templates",
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

  return [...staticEntries, ...templateEntries, ...faxToEntries];
}

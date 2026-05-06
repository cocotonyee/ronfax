import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticleJsonLd } from "@/components/blog/BlogArticleJsonLd";
import { BlogBreadcrumbs } from "@/components/blog/BlogBreadcrumbs";
import { BlogCta } from "@/components/blog/BlogCta";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import { BlogOnPageFaq } from "@/components/blog/BlogOnPageFaq";
import { BlogViewTracker } from "@/components/blog/BlogViewTracker";
import {
  getAllPostsMeta,
  getPostBySlug,
  getPostSlugs,
  normalizeKeywords,
} from "@/lib/blog";
import { getMetadataBaseUrl, getSiteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not found" };

  const kws = normalizeKeywords(post.data.keywords);
  const path = `/blog/${post.slug}`;
  const canonical = new URL(path, getMetadataBaseUrl()).toString();

  return {
    title: { absolute: post.data.title },
    description: post.data.description,
    keywords: kws.length ? kws : undefined,
    alternates: { canonical: path },
    openGraph: {
      title: post.data.title,
      description: post.data.description,
      type: "article",
      publishedTime: post.data.date,
      url: canonical,
      siteName: "RonFax",
    },
    twitter: {
      card: "summary_large_image",
      title: post.data.title,
      description: post.data.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const kws = normalizeKeywords(post.data.keywords);
  const faq = post.data.faq ?? [];
  const site = getSiteUrl();

  return (
    <>
      <BlogViewTracker slug={post.slug} />
      <BlogArticleJsonLd
        urlPath={`/blog/${post.slug}`}
        title={post.data.title}
        description={post.data.description}
        datePublished={post.data.date}
        keywords={kws}
        faq={faq}
      />
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <BlogBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blog" },
            { label: post.data.title, href: `/blog/${post.slug}` },
          ]}
        />
        <header className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            RonFax Blog
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            {post.data.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Published{" "}
            <time dateTime={post.data.date}>
              {new Date(post.data.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {" · "}
            <span className="text-zinc-400">{site.replace(/^https?:\/\//, "")}</span>
          </p>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            {post.data.description}
          </p>
        </header>

        <BlogMarkdown content={post.content} />
        <BlogOnPageFaq items={faq} />
        <BlogCta blogSlug={post.slug} />
      </article>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { getAllPostsMeta } from "@/lib/blog";

export const metadata: Metadata = {
  title: { absolute: "Blog | Online Fax Guides & Alternatives — RonFax" },
  description:
    "Guides for where to fax documents near you, how to fax without a printer, and how RonFax compares to services users search for in 2026.",
  openGraph: {
    title: "RonFax Blog — Fax guides & SEO insights",
    description:
      "High-intent guides based on US Google Trends: retail fax vs online, printer workarounds, and transparent pricing.",
  },
};

export default function BlogIndexPage() {
  const posts = getAllPostsMeta().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {APP_NAME}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
        Blog
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-600">
        Practical guides aligned with what people actually search for—online fax,
        store alternatives, and pay-as-you-go sending from home.
      </p>

      <ul className="mt-12 space-y-6">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="group block rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-primary/30 hover:shadow-md"
            >
              <time
                dateTime={p.date}
                className="text-xs font-medium text-zinc-500"
              >
                {new Date(p.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900 group-hover:text-primary">
                {p.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {p.description}
              </p>
              <span className="mt-3 inline-block text-sm font-semibold text-primary">
                Read guide →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {posts.length === 0 ? (
        <p className="mt-8 text-zinc-600">
          No articles yet — check back soon.
        </p>
      ) : null}
    </div>
  );
}

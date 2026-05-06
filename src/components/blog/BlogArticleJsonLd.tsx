import { APP_NAME } from "@/lib/constants";
import { getSiteUrl } from "@/lib/site-url";
import type { BlogFaqItem } from "@/lib/blog";

type Props = {
  urlPath: string;
  title: string;
  description: string;
  datePublished: string;
  keywords: string[];
  faq: BlogFaqItem[];
};

export function BlogArticleJsonLd({
  urlPath,
  title,
  description,
  datePublished,
  keywords,
  faq,
}: Props) {
  const base = getSiteUrl();
  const url = `${base.replace(/\/$/, "")}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished,
    dateModified: datePublished,
    author: { "@type": "Organization", name: APP_NAME },
    publisher: {
      "@type": "Organization",
      name: APP_NAME,
      url: base,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    keywords: keywords.join(", "),
    inLanguage: "en-US",
  };

  const faqPage =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${base.replace(/\/$/, "")}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${base.replace(/\/$/, "")}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: url,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      {faqPage ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
        />
      ) : null}
    </>
  );
}

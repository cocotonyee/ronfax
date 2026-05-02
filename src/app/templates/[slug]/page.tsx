import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClinicHowToJsonLd } from "@/components/ClinicHowToJsonLd";
import { APP_NAME } from "@/lib/constants";
import { getClinicBySlug } from "@/lib/clinics";
import { formatUsPhone } from "@/lib/phone";
import { getSiteUrl } from "@/lib/site-url";

type Props = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getClinicBySlug(slug);
  if (!entry) {
    return { title: "Send Fax Online" };
  }

  const faxDisplay = entry.faxDisplay ?? formatUsPhone(entry.faxDigits);
  const description =
    entry.description ??
    `Send a fax to ${entry.name} (${faxDisplay}) from your browser. ${APP_NAME}: $1.99 for up to 3 pages, no subscription.`;

  const base = getSiteUrl();
  const canonical = `${base}/templates/${slug}`;

  return {
    title: entry.name,
    description,
    alternates: { canonical },
    openGraph: {
      description,
      url: canonical,
      siteName: APP_NAME,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      description,
    },
  };
}

export default async function ClinicTemplatePage({ params }: Props) {
  const { slug } = await params;
  const entry = await getClinicBySlug(slug);
  if (!entry?.faxDigits) notFound();

  const faxDisplay = entry.faxDisplay ?? formatUsPhone(entry.faxDigits);
  const sendHref = `/?fax=${entry.faxDigits}`;

  return (
    <div className="bg-surface">
      <ClinicHowToJsonLd entry={entry} />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <nav className="mb-8 flex flex-wrap gap-x-2 text-sm text-zinc-500">
          <Link href="/" className="font-medium text-primary hover:underline">
            Home
          </Link>
          <span aria-hidden className="text-zinc-300">
            /
          </span>
          <Link
            href="/templates"
            className="font-medium text-primary hover:underline"
          >
            Templates
          </Link>
          <span aria-hidden className="text-zinc-300">
            /
          </span>
          <span className="truncate text-zinc-700">{entry.name}</span>
        </nav>

        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
          How to send a fax to {entry.name} ({faxDisplay})
        </h1>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href={sendHref}
            scroll={false}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:opacity-90"
          >
            Send fax now
          </Link>
          <p className="text-sm text-zinc-600">
            Opens the send form with this number prefilled ($1.99 for up to 3
            pages).
          </p>
        </div>

        {entry.description ? (
          <p className="mt-10 text-base leading-relaxed text-zinc-700">
            {entry.description}
          </p>
        ) : null}

        <section className="mt-10" aria-labelledby="steps-heading">
          <h2
            id="steps-heading"
            className="text-lg font-bold tracking-tight text-zinc-950"
          >
            Steps
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-700 marker:font-semibold marker:text-primary">
            <li>
              Click <strong>Send fax now</strong>—your browser opens RonFax
              with <strong>{faxDisplay}</strong> in the recipient field
              (country code +1).
            </li>
            <li>
              Upload a PDF or image (max 8 MB). Word files must be exported to
              PDF first.
            </li>
            <li>
              Enter your name and email, review the price (from $1.99 for up to
              3 pages), pay securely, and submit. Track status on the page we
              provide after checkout.
            </li>
          </ol>
        </section>

        <p className="mt-10 text-sm text-zinc-600">
          <Link
            href={`/fax-to/${entry.slug}`}
            className="font-semibold text-primary hover:underline"
          >
            Full institution profile
          </Link>{" "}
          — fax line details and optional letter template.
        </p>
      </article>
    </div>
  );
}

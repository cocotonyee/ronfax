import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaxForm } from "@/components/FaxForm";
import { InstitutionPanel } from "@/components/InstitutionPanel";
import { APP_NAME } from "@/lib/constants";
import { getClinicBySlug, getClinicsIndex } from "@/lib/clinics";
import { getSiteUrl } from "@/lib/site-url";
import type { ClinicRecord } from "@/lib/clinic-types";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = true;

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getClinicBySlug(slug);
  if (!entry) {
    return { title: "Institution" };
  }

  const title = `${entry.name} fax number · ${entry.city}, ${entry.state}`;
  const description =
    entry.description ??
    `Send a fax to ${entry.name} in ${entry.city}. Verified fax · ${APP_NAME}.`;

  const base = getSiteUrl();
  const canonical = `${base}/fax-to/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: APP_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical },
  };
}

export default async function FaxToInstitutionPage({ params }: Props) {
  const { slug } = await params;
  const entry = await getClinicBySlug(slug);
  if (!entry || !entry.faxDigits) notFound();

  const { list } = await getClinicsIndex();
  const related = pickRelated(entry, list, 6);

  return (
    <div className="bg-white px-4 pb-16 pt-8 sm:px-6">
      <nav className="mx-auto mb-8 flex max-w-3xl text-sm text-zinc-500">
        <Link href="/" className="font-medium text-primary hover:underline">
          Home
        </Link>
        <span className="mx-2 text-zinc-300">/</span>
        <Link
          href="/templates"
          className="font-medium text-primary hover:underline"
        >
          Directory
        </Link>
        <span className="mx-2 text-zinc-300">/</span>
        <span className="truncate text-zinc-700">{entry.name}</span>
      </nav>

      <article className="mx-auto max-w-3xl space-y-10">
        <InstitutionPanel entry={entry} />

        {entry.description ? (
          <p className="text-center text-base leading-relaxed text-zinc-600">
            {entry.description}
          </p>
        ) : null}

        <div>
          <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Send your fax
          </p>
          <FaxForm
            key={entry.slug}
            initialPhoneDigits={entry.faxDigits}
          />
        </div>

        <RelatedStrip related={related} />
      </article>
    </div>
  );
}

function pickRelated(
  current: ClinicRecord,
  list: ClinicRecord[],
  n: number,
): ClinicRecord[] {
  const out: ClinicRecord[] = [];
  for (const r of list) {
    if (r.slug === current.slug) continue;
    out.push(r);
    if (out.length >= n) break;
  }
  return out;
}

function RelatedStrip({ related }: { related: ClinicRecord[] }) {
  if (related.length === 0) return null;

  return (
    <section className="border-t border-zinc-200 pt-10">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
        More institutions
      </p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {related.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/fax-to/${r.slug}`}
              className="inline-block rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-primary transition hover:border-primary/40 hover:bg-primary/5"
            >
              {r.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

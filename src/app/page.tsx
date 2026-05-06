import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FaqSection } from "@/components/FaqSection";
import { FaxForm } from "@/components/FaxForm";
import { HeroHeadline } from "@/components/HeroHeadline";
import { HeroTrustBadges } from "@/components/HeroTrustBadges";
import { LandingTrustBar } from "@/components/LandingTrustBar";
import { HeroSimplePricing } from "@/components/HeroSimplePricing";
import { LocalSEOSection } from "@/components/LocalSEOSection";
import { PopularDestinationsGrid } from "@/components/PopularDestinationsGrid";
import { SecurityHighlights } from "@/components/SecurityHighlights";
import { sanitizeFaxFromUrlParam } from "@/lib/fax-url";
import { getClinicsIndex } from "@/lib/clinics";
import { selectPopularGridEntries } from "@/lib/popular-destinations";
import { sanitizeSourceKeyword } from "@/lib/source-keyword";

const HOME_TITLE =
  "Online Fax Service | Send Fax from Computer — RonFax (US)";
const HOME_DESCRIPTION =
  "Send fax from computer or iPhone without a printer or store visit. Faster than searching where to fax documents near me at FedEx or Staples — pay-as-you-go online fax service. Cocofax alternative & FaxZero alternative with transparent pricing.";

const homeKeywords = [
  "online fax service",
  "send fax from computer",
  "where to fax documents near me",
  "fax documents near me",
  "how to send a fax from printer",
  "fax app for iPhone",
  "Cocofax alternative",
  "FaxZero alternative",
];

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  keywords: homeKeywords,
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    type: "website",
  },
  twitter: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

export default async function Home({ params, searchParams }: PageProps<'/'>) {
  await params;
  const { list } = await getClinicsIndex();
  const gridEntries = selectPopularGridEntries(list, 8);
  const sp = await searchParams;
  const faxRaw = typeof sp.fax === "string" ? sp.fax : undefined;
  const initialPhoneDigits = sanitizeFaxFromUrlParam(faxRaw) ?? undefined;
  const kwRaw = typeof sp.kw === "string" ? sp.kw : undefined;
  const initialSourceKeyword = sanitizeSourceKeyword(kwRaw);

  return (
    <div className="bg-surface">
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-primary/[0.06]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(0,156,255,0.1)_0%,_transparent_52%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(0,156,255,0.09),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:items-center lg:gap-x-32">
            <div className="flex flex-col justify-center space-y-6 lg:max-w-xl lg:pr-2">
              <HeroTrustBadges />
              <HeroHeadline />
              <HeroSimplePricing />
            </div>
            <div className="min-w-0 lg:sticky lg:top-28">
              <Suspense
                fallback={
                  <div
                    className="min-h-[min(520px,70vh)] animate-pulse rounded-3xl border border-zinc-200/90 bg-white shadow-2xl"
                    aria-hidden
                  />
                }
              >
                <FaxForm
                  initialPhoneDigits={initialPhoneDigits}
                  initialSourceKeyword={initialSourceKeyword}
                />
              </Suspense>
              <section
                aria-label="Send via email quick guide"
                className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 shadow-sm"
              >
                <h3 className="text-sm font-bold text-zinc-900">
                  Send via Email (Beta)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-700">
                  Email to fax service for quick sends. Fax via Gmail with no
                  setup and No account faxing flow after secure checkout.
                </p>
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-zinc-300" />
                    <span className="h-2 w-2 rounded-full bg-zinc-300" />
                    <span className="h-2 w-2 rounded-full bg-zinc-300" />
                    <span className="ml-2 text-[11px] font-semibold text-zinc-500">
                      New Message
                    </span>
                  </div>
                  <div className="space-y-2 px-3 py-3 text-xs text-zinc-800">
                    <p>
                      <span className="font-semibold text-zinc-500">To:</span>{" "}
                      fax@ronfax.com
                    </p>
                    <p>
                      <span className="font-semibold text-zinc-500">
                        Subject:
                      </span>{" "}
                      1234567890 (10-digit number)
                    </p>
                    <p>
                      <span className="font-semibold text-zinc-500">
                        Attachment:
                      </span>{" "}
                      document.pdf
                    </p>
                  </div>
                </div>
                <Link
                  href="/blog/email-to-fax-gmail-outlook-pay-later"
                  className="mt-3 inline-flex text-xs font-semibold text-primary underline underline-offset-2"
                >
                  Learn how it works
                </Link>
              </section>
            </div>
          </div>
        </div>
      </section>

      <LandingTrustBar />

      <section
        id="security"
        className="mx-auto max-w-7xl scroll-mt-28 px-4 py-14 sm:px-8"
      >
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-950 sm:text-[1.65rem]">
          Security you can stand behind
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-zinc-600">
          Layered protection from upload to purge — so your team can fax with
          confidence.
        </p>
        <SecurityHighlights />
      </section>

      {gridEntries.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Popular destinations
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-950">
              Fax numbers people search for
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
              Jump to a verified destination — government, healthcare, and more.
            </p>
          </div>
          <PopularDestinationsGrid entries={gridEntries} />
        </section>
      ) : null}

      <LocalSEOSection />

      <section
        id="faq"
        className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-20 pt-6 sm:px-8"
      >
        <FaqSection />
      </section>
    </div>
  );
}

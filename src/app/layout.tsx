import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { domAnimation, LazyMotion } from "framer-motion";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { SmartSupport } from "@/components/SmartSupport";
import { getMetadataBaseUrl, getSiteUrl } from "@/lib/site-url";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNavbar } from "@/components/SiteNavbar";

const defaultTitle =
  "RonFax | Online Fax Service — Send Fax from Computer (US)";

const defaultDescription =
  "Online fax service to send fax from computer or phone. Alternatives to fax documents near me at stores: upload PDF, dial any US fax number, pay as you go. Cocofax alternative & FaxZero alternative — no subscription, HIPAA-friendly workflow, 256-bit encryption.";

export async function generateMetadata(): Promise<Metadata> {
  const site = getSiteUrl();
  return {
    metadataBase: getMetadataBaseUrl(),
    title: {
      default: defaultTitle,
      template: "RonFax | %s",
    },
    description: defaultDescription,
    keywords: [
      "online fax service",
      "send fax from computer",
      "where to fax documents near me",
      "fax documents near me",
      "how to send a fax from printer",
      "fax app for iPhone",
      "Cocofax alternative",
      "FaxZero alternative",
      "fax without fax machine",
    ],
    applicationName: "RonFax",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: site,
      siteName: "RonFax",
      title: defaultTitle,
      description: defaultDescription,
      locale: "en_US",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "RonFax — send fax online to US and Canada",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [`${site}/opengraph-image`],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/logo.svg", type: "image/svg+xml" },
      ],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#009cff",
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/'>) {
  await params;
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} flex min-h-full flex-col bg-surface font-sans text-zinc-900 antialiased`}
      >
        <JsonLd />
        <LazyMotion features={domAnimation} strict>
          <a
            href="#send"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
          >
            Skip to send fax
          </a>
          <SiteNavbar />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <SmartSupport />
        </LazyMotion>
        <Analytics />
      </body>
    </html>
  );
}

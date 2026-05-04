import type { Metadata, Viewport } from "next";
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
  "RonFax | Send Fax Online to US & Canada - No Subscription";

const defaultDescription =
  "Securely send faxes to any US or Canada number for just $1.99. HIPAA-compliant, no account required, 256-bit encryption. Pay as you go.";

export async function generateMetadata(): Promise<Metadata> {
  const site = getSiteUrl();
  return {
    metadataBase: getMetadataBaseUrl(),
    title: {
      default: defaultTitle,
      template: "RonFax | %s",
    },
    description: defaultDescription,
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
      </body>
    </html>
  );
}

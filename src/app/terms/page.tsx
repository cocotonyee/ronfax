import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${APP_NAME}.`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link
        href="/"
        className="text-sm font-medium text-primary hover:underline"
      >
        ← Back to home
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-zinc-900">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: May 2, 2026</p>
      <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-600">
        <p>
          These Terms of Service (“Terms”) govern your use of {APP_NAME}
          (&quot;we,&quot; &quot;us&quot;) website and fax transmission services.
          By using the service, you agree to these Terms.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">Service</h2>
        <p>
          {APP_NAME} provides a paid online fax delivery service. You supply a
          PDF and destination fax number; we transmit the document through our
          telecommunications partner after successful payment.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">
          Acceptable use
        </h2>
        <p>
          You may not use the service for unlawful, harassing, or fraudulent
          content. You represent that you have authority to send documents to the
          fax number provided.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">
          Disclaimer
        </h2>
        <p>
          Fax delivery depends on third-party networks; we do not guarantee
          delivery time or successful receipt at the destination machine. Our
          liability is limited to the extent permitted by law.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">Contact</h2>
        <p>
          For questions about these Terms, contact us through the support channel
          listed on our website.
        </p>
      </div>
    </div>
  );
}

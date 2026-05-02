import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${APP_NAME}.`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link
        href="/"
        className="text-sm font-medium text-primary hover:underline"
      >
        ← Back to home
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-zinc-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: May 2, 2026</p>
      <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-600">
        <p>
          This Privacy Policy describes how {APP_NAME} (“we”) handles information
          when you use our website and fax services.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">
          Information we process
        </h2>
        <p>
          We process PDF files you upload, destination fax numbers, and payment
          information handled by Stripe. We may receive technical logs (e.g. IP,
          browser type) for security and operations.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">Retention</h2>
        <p>
          Uploaded PDFs are stored only long enough to complete payment and
          transmission, then deleted from our object storage after a successful
          send (subject to backup and logging constraints of our providers).
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">Sharing</h2>
        <p>
          We use subprocessors such as payment processors (Stripe), cloud
          storage (e.g. Vercel Blob), fax carriers (e.g. Phaxio), and
          infrastructure providers as needed to operate the service.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">Security</h2>
        <p>
          We use encryption in transit (HTTPS/TLS). No method of transmission over
          the Internet is 100% secure.
        </p>
        <h2 className="mt-8 text-base font-semibold text-zinc-900">Your rights</h2>
        <p>
          Depending on your jurisdiction, you may have rights to access, correct,
          or delete personal information. Contact us to exercise those rights.
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import { VERIFIED_STAMP } from "@/lib/ui-tokens";

const year = 2026;

const footerLinks = [
  { href: "/#security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200/80 bg-white">
      <div className="border-b border-zinc-100 bg-zinc-50/80 py-3 text-center text-sm font-medium text-zinc-800">
        Trusted by 50,000+ users and healthcare providers.
      </div>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-bold text-zinc-950">{APP_NAME}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Secure outbound fax for regulated teams. Directory listings
              verified {VERIFIED_STAMP}.
            </p>
            <p className="mt-4 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-700">Contact: </span>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-sm font-medium text-zinc-700">
              <li>
                <Link href="/" className="hover:text-primary">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/templates" className="hover:text-primary">
                  Browse directory
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-primary">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Explore
            </p>
            <ul className="mt-3 space-y-2 text-sm font-medium text-zinc-700">
              {footerLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-zinc-200 pt-8 text-center text-xs text-zinc-500">
          © {year} {APP_NAME}. Directory data verified {VERIFIED_STAMP}.
        </p>
      </div>
    </footer>
  );
}

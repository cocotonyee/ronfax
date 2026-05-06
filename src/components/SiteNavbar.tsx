import Link from "next/link";
import { Logo } from "@/components/Logo";

export function SiteNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/30 bg-white/65 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/55">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          href="/"
          aria-label="RonFax home"
          className="group flex shrink-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Logo size={32} className="shrink-0" />
          <span className="font-sans text-xl font-extrabold tracking-tighter text-zinc-950">
            RonFax
          </span>
        </Link>
        <nav
          className="hidden items-center gap-6 text-sm font-semibold text-zinc-700 md:flex"
          aria-label="Primary"
        >
          <Link
            href="/templates"
            className="transition hover:text-primary"
          >
            Templates
          </Link>
          <Link href="/blog" className="transition hover:text-primary">
            Blog
          </Link>
          <Link
            href="/#security"
            className="transition hover:text-primary"
          >
            Security
          </Link>
        </nav>
        <Link
          href="/#send"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90"
        >
          Send Fax →
        </Link>
      </div>
    </header>
  );
}

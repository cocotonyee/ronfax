import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Blog",
  description: `Updates and guides from ${APP_NAME}.`,
};

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">Blog</h1>
      <p className="mt-4 text-zinc-600">
        Product updates and fax tips are coming soon. For now, visit our{" "}
        <Link href="/templates" className="font-semibold text-primary hover:underline">
          templates & directory
        </Link>{" "}
        or{" "}
        <Link href="/#faq" className="font-semibold text-primary hover:underline">
          FAQ
        </Link>
        .
      </p>
    </div>
  );
}

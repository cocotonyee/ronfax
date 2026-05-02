"use client";

import { m, useInView } from "framer-motion";
import { Lock, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import { useRef } from "react";

const items: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: ShieldCheck,
    title: "HIPAA-ready pipeline",
    description:
      "TLS 1.2+ in transit and infrastructure designed for regulated workflows. Suitable for teams that need auditable, encrypted transmission.",
  },
  {
    icon: Lock,
    title: "Encryption & secure checkout",
    description:
      "AES-256 protection for files at rest while we process your send. Payments run through Stripe — card data never touches RonFax servers.",
  },
  {
    icon: Trash2,
    title: "Zero-retention policy",
    description:
      "Uploads are automatically purged from secure storage after your fax is delivered or definitively fails — no long-term document vault.",
  },
];

function IconCard({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <li
      ref={ref}
      className="flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm"
    >
      <m.span
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
        animate={
          isInView ? { rotate: [0, -6, 6, -3, 0] } : { rotate: 0 }
        }
        transition={{
          duration: 0.85,
          ease: "easeInOut" as const,
          delay: 0.15,
        }}
      >
        <Icon className="h-5 w-5 stroke-[2.25]" aria-hidden />
      </m.span>
      <h3 className="mt-4 text-base font-bold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
    </li>
  );
}

export function SecurityHighlights() {
  return (
    <ul className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-3">
      {items.map(({ icon: Icon, title, description }) => (
        <IconCard key={title} Icon={Icon} title={title} description={description} />
      ))}
    </ul>
  );
}

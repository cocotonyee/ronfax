import type { BlogFaqItem } from "@/lib/blog";

export function BlogOnPageFaq({ items }: { items: BlogFaqItem[] }) {
  if (!items.length) return null;
  return (
    <section
      className="mt-14 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-5 py-8 sm:px-8"
      aria-labelledby="blog-faq-heading"
    >
      <h2
        id="blog-faq-heading"
        className="text-xl font-bold tracking-tight text-zinc-950"
      >
        Frequently asked questions
      </h2>
      <dl className="mt-6 space-y-6">
        {items.map((item) => (
          <div key={item.question}>
            <dt className="font-semibold text-zinc-900">{item.question}</dt>
            <dd className="mt-2 leading-relaxed text-zinc-700">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

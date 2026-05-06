import Link from "next/link";

type Item = { label: string; href: string };

export function BlogBreadcrumbs({ items }: { items: Item[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span aria-hidden className="text-zinc-300">
                /
              </span>
            ) : null}
            {i === items.length - 1 ? (
              <span className="font-medium text-zinc-700">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-primary hover:underline"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

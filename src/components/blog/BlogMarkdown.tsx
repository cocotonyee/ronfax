import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function BlogMarkdown({ content }: { content: string }) {
  return (
    <div className="blog-md text-zinc-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-12 text-3xl font-bold tracking-tight text-zinc-950 first:mt-0 sm:text-4xl">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-12 scroll-mt-24 border-b border-zinc-200 pb-2 text-2xl font-bold tracking-tight text-zinc-950 first:mt-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 text-xl font-semibold text-zinc-900">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-6 text-lg font-semibold text-zinc-900">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="mt-4 text-base leading-relaxed text-zinc-700">{children}</p>
          ),
          code: ({ children, className }) => {
            const isBlock = typeof className === "string" && className.includes("language-");
            if (isBlock) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.92em] text-zinc-900">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950/95 p-4 text-sm leading-relaxed text-zinc-100">
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className="mt-4 list-disc space-y-2.5 pl-6 text-zinc-700 marker:text-zinc-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-4 list-decimal space-y-2.5 pl-6 text-zinc-700 marker:font-semibold marker:text-zinc-500">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-900">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src ?? ""}
              alt={alt ?? ""}
              className="my-6 w-full rounded-2xl border border-zinc-200 object-cover shadow-sm"
            />
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-zinc-200 bg-zinc-50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 font-semibold text-zinc-900">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-zinc-100 px-4 py-3 text-zinc-700">
              {children}
            </td>
          ),
          hr: () => <hr className="my-10 border-zinc-200" />,
          blockquote: ({ children }) => (
            <blockquote className="my-6 rounded-r-xl border-l-4 border-primary/40 bg-primary/[0.05] px-4 py-3 text-zinc-700 italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

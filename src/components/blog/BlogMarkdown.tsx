import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function BlogMarkdown({ content }: { content: string }) {
  return (
    <div className="blog-md text-zinc-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-10 scroll-mt-24 text-2xl font-bold tracking-tight text-zinc-950 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 text-xl font-semibold text-zinc-900">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mt-4 text-base leading-relaxed text-zinc-700">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mt-4 list-disc space-y-2 pl-6 text-zinc-700">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-4 list-decimal space-y-2 pl-6 text-zinc-700">{children}</ol>
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
            <blockquote className="my-6 border-l-4 border-primary/40 pl-4 text-zinc-600 italic">
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

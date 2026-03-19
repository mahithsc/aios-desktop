import { memo, type JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  children: string
}

const Markdown = memo(function Markdown({ children }: MarkdownProps): JSX.Element {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-stone-400 underline-offset-2 hover:decoration-stone-700"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="my-3 list-disc pl-6 first:mt-0 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-3 list-decimal pl-6 first:mt-0 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="my-1">{children}</li>,
        h1: ({ children }) => (
          <h1 className="mt-6 mb-3 text-lg font-semibold first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-5 mb-2 text-base font-semibold first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-4 mb-2 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-stone-300 pl-4 text-stone-600 first:mt-0 last:mb-0">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.startsWith('language-')
          if (isBlock) {
            return (
              <pre className="my-3 overflow-x-auto rounded-xl bg-stone-100 px-4 py-3 font-mono text-[13px] leading-6 text-stone-800 first:mt-0 last:mb-0">
                <code>{children}</code>
              </pre>
            )
          }
          return (
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[13px] text-stone-800">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <>{children}</>,
        hr: () => <hr className="my-4 border-stone-200" />,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto first:mt-0 last:mb-0">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-stone-200 px-3 py-2 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="border-b border-stone-100 px-3 py-2">{children}</td>
      }}
    >
      {children}
    </ReactMarkdown>
  )
})

export default Markdown

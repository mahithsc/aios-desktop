import { memo, type JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  children: string
  darkMode?: boolean
}

const Markdown = memo(function Markdown({
  children,
  darkMode = false
}: MarkdownProps): JSX.Element {
  const textClass = darkMode ? 'text-white/92' : 'text-stone-800'
  const mutedTextClass = darkMode ? 'text-white/70' : 'text-stone-600'
  const codeBgClass = darkMode ? 'bg-white/10 text-white/92' : 'bg-stone-100 text-stone-800'
  const blockBgClass = darkMode ? 'bg-white/8 text-white/92' : 'bg-stone-100 text-stone-800'
  const ruleClass = darkMode ? 'border-white/10' : 'border-stone-200'
  const tableBorderClass = darkMode ? 'border-white/10' : 'border-stone-200'
  const tableRowBorderClass = darkMode ? 'border-white/5' : 'border-stone-100'

  return (
    <div className="min-w-0 max-w-full wrap-break-word">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className={`my-3 wrap-break-word first:mt-0 last:mb-0 ${textClass}`}>{children}</p>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-all underline underline-offset-2 ${
                darkMode
                  ? 'decoration-white/40 hover:decoration-white/80'
                  : 'decoration-stone-400 hover:decoration-stone-700'
              }`}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc wrap-break-word pl-6 first:mt-0 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal wrap-break-word pl-6 first:mt-0 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="my-1 wrap-break-word">{children}</li>,
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 wrap-break-word text-lg font-semibold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2 wrap-break-word text-base font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={`mt-4 mb-2 wrap-break-word text-sm font-semibold first:mt-0 ${textClass}`}
            >
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`my-3 border-l-2 pl-4 first:mt-0 last:mb-0 ${
                darkMode ? 'border-white/20 text-white/70' : 'border-stone-300 text-stone-600'
              }`}
            >
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.startsWith('language-')
            if (isBlock) {
              return (
                <pre
                  className={`my-3 max-w-full overflow-x-auto rounded-xl px-4 py-3 font-mono text-[13px] leading-6 first:mt-0 last:mb-0 ${blockBgClass}`}
                >
                  <code>{children}</code>
                </pre>
              )
            }
            return (
              <code
                className={`break-all rounded px-1.5 py-0.5 font-mono text-[13px] ${codeBgClass}`}
              >
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>,
          hr: () => <hr className={`my-4 ${ruleClass}`} />,
          table: ({ children }) => (
            <div className="my-3 max-w-full overflow-x-auto first:mt-0 last:mb-0">
              <table className={`w-full text-sm ${textClass}`}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`border-b px-3 py-2 text-left font-semibold ${tableBorderClass}`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`border-b px-3 py-2 ${tableRowBorderClass} ${mutedTextClass}`}>
              {children}
            </td>
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})

export default Markdown

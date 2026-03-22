import { type JSX, type KeyboardEventHandler, useRef, useEffect } from 'react'

type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onKeyDown: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>
  onSubmit: () => void
  fixed?: boolean
  placeholder?: string
}

const MULTILINE_THRESHOLD = 80

const SendButton = ({ onClick }: { onClick: () => void }): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-stone-800"
    aria-label="Send message"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  </button>
)

const ChatComposer = ({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  fixed = true,
  placeholder = 'Message an agent...'
}: ChatComposerProps): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMultiline = value.length > MULTILINE_THRESHOLD || value.includes('\n')

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, isMultiline])

  useEffect(() => {
    if (!isMultiline) return
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [isMultiline])

  const handleInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault()
      onChange(value + '\n')
      return
    }
    onKeyDown(event)
  }

  const inputClasses =
    'w-full bg-transparent text-sm leading-6 text-black outline-none placeholder:text-stone-400'

  const wrapperClasses = fixed
    ? 'fixed inset-x-0 bottom-6 z-20 flex justify-center px-6'
    : 'mx-auto flex w-full max-w-184 justify-center'

  if (isMultiline) {
    return (
      <div className={wrapperClasses}>
        <div className="flex w-full max-w-184 flex-col gap-2 rounded-3xl border border-stone-200 bg-white px-3.5 py-2.5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            className={`max-h-64 resize-none ${inputClasses}`}
          />
          <div className="flex justify-end">
            <SendButton onClick={onSubmit} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClasses}>
      <div className="flex w-full max-w-184 items-center gap-2.5 rounded-full border border-stone-200 bg-white px-3.5 py-2.5">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className={inputClasses}
        />
        <SendButton onClick={onSubmit} />
      </div>
    </div>
  )
}

export default ChatComposer

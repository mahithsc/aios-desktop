import type { JSX, KeyboardEventHandler } from 'react'

type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onKeyDown: KeyboardEventHandler<HTMLInputElement>
  onSubmit: () => void
}

const ChatComposer = ({
  value,
  onChange,
  onKeyDown,
  onSubmit
}: ChatComposerProps): JSX.Element => {
  return (
    <div className="fixed inset-x-0 bottom-6 z-20 flex justify-center px-6">
      <div className="flex w-full max-w-4xl items-center gap-3 rounded-[20px] border border-stone-300 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message an agent..."
          className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
        />

        <button
          type="button"
          onClick={onSubmit}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white"
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
      </div>
    </div>
  )
}

export default ChatComposer

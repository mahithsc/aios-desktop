import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react'

type AssistantHeroInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop?: () => void
  isSubmitting?: boolean
  submitDisabled?: boolean
  canStop?: boolean
  placeholder?: string
  submitLabel?: string
}

const AssistantHeroInput = ({
  value,
  onChange,
  onSubmit,
  onStop,
  isSubmitting = false,
  submitDisabled = false,
  canStop = false,
  placeholder = 'What should this assistant help with?',
  submitLabel = 'Create assistant'
}: AssistantHeroInputProps): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    onSubmit()
  }

  return (
    <div className="w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="min-h-[4rem] max-h-80 w-full resize-none bg-transparent text-3xl font-light leading-[1.08] tracking-tight text-foreground caret-foreground outline-none placeholder:text-muted-foreground/70 sm:text-[2.6rem]"
      />

      <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div />

        <button
          type="button"
          onClick={canStop ? onStop : onSubmit}
          disabled={canStop ? !onStop : submitDisabled}
          className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {canStop ? 'Stop' : isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  )
}

export default AssistantHeroInput

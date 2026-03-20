import type { JSX, KeyboardEvent } from 'react'
import { useEffect, useRef } from 'react'

type DesktopWidgetTextInputProps = {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onSubmit: () => void
}

const DesktopWidgetTextInput = ({
  value,
  placeholder,
  onChange,
  onSubmit
}: DesktopWidgetTextInputProps): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`
  }, [value])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter') {
      if (e.shiftKey) return
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={1}
      className="max-h-35 min-h-7 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-7 text-white outline-none ring-0 placeholder:text-white/45 focus:ring-0 focus-visible:ring-0"
    />
  )
}

export default DesktopWidgetTextInput

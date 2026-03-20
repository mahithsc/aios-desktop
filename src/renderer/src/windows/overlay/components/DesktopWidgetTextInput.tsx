import type { JSX, KeyboardEvent } from 'react'
import { useEffect, useRef } from 'react'

type DesktopWidgetTextInputProps = {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onSubmit: () => void
  darkMode?: boolean
}

const DesktopWidgetTextInput = ({
  value,
  placeholder,
  onChange,
  onSubmit,
  darkMode = true
}: DesktopWidgetTextInputProps): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`
  }, [value])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter') {
      if (event.shiftKey) return
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      rows={1}
      className={`max-h-35 min-h-7 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-7 outline-none ring-0 focus:ring-0 focus-visible:ring-0 ${
        darkMode
          ? 'text-white placeholder:text-white/45'
          : 'text-stone-900 placeholder:text-stone-500'
      }`}
    />
  )
}

export default DesktopWidgetTextInput

import type { CSSProperties, JSX, KeyboardEvent } from 'react'

type DesktopWidgetTextInputProps = {
  value: string
  placeholder: string
  noDragRegionStyle: CSSProperties
  onChange: (value: string) => void
  onSubmit: () => void
}

const DesktopWidgetTextInput = ({
  value,
  placeholder,
  noDragRegionStyle,
  onChange,
  onSubmit
}: DesktopWidgetTextInputProps): JSX.Element => {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
      <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="min-w-0 w-full border-0 bg-transparent text-base text-white outline-none ring-0 placeholder:text-white/50 focus:ring-0 focus-visible:ring-0"
      style={noDragRegionStyle}
    />
  )
}

export default DesktopWidgetTextInput

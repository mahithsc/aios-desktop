import { forwardRef } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', type = 'text', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`w-full rounded-full border border-border bg-card px-5 py-3 text-sm text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.18)] outline-none backdrop-blur-xl transition placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
      {...props}
    />
  )
})

export default Input

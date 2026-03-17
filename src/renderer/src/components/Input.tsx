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
      className={`w-full rounded-full border border-white/60 bg-white/70 px-5 py-3 text-sm text-stone-800 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none backdrop-blur-xl transition placeholder:text-stone-400 focus:border-white focus:bg-white focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
      {...props}
    />
  )
})

export default Input

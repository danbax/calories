export function InlineSpinner({ className = '' }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white ${className}`}></span>
  )
}

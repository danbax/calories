import { InlineSpinner } from './InlineSpinner'

export function LoadingButton({ loading, className, children, ...props }) {
  return (
    <button {...props} className={className} disabled={loading || props.disabled}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <InlineSpinner />
          Working...
        </span>
      ) : (
        children
      )}
    </button>
  )
}

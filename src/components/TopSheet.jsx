import { FaXmark } from 'react-icons/fa6'

export function TopSheet({ open, title, onClose, children }) {
  if (!open) return null

  return (
    <>
      <button className="sheet-overlay" onClick={onClose} aria-label="Close"></button>
      <section className="top-sheet-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-3 flex items-center justify-between border-b border-[#dfe7de] pb-3">
          <h3 className="font-['Sora'] text-lg font-semibold text-[#163d31]">{title}</h3>
          <button className="btn-muted !rounded-full !p-2" onClick={onClose}>
            <FaXmark />
          </button>
        </div>
        {children}
      </section>
    </>
  )
}

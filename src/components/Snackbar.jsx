import { useState, useEffect, useCallback } from 'react'

let showSnackbarGlobal = null

export function showSnackbar(message, type = 'success') {
  if (typeof showSnackbarGlobal === 'function') {
    showSnackbarGlobal(message, type)
  }
}

export function Snackbar() {
  const [items, setItems] = useState([])

  useEffect(() => {
    showSnackbarGlobal = (message, type = 'success') => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { id, message, type }])

      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id))
      }, 3000)
    }

    return () => {
      showSnackbarGlobal = null
    }
  }, [])

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={`animate-slide-up rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-sm ${
            item.type === 'success'
              ? 'bg-[#163d31]/95 text-[#e2f3e8]'
              : item.type === 'error'
                ? 'bg-red-800/95 text-red-100'
                : 'bg-[#1f4739]/95 text-[#e2f3e8]'
          }`}
          onClick={() => removeItem(item.id)}
        >
          <div className="flex items-center gap-2">
            {item.type === 'success' && (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {item.type === 'error' && (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span>{item.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
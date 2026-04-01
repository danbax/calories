import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const showUpdateToast = (message) => {
  const existing = document.getElementById('pwa-update-toast')
  if (existing) {
    existing.textContent = message
    return
  }

  const toast = document.createElement('div')
  toast.id = 'pwa-update-toast'
  toast.textContent = message
  Object.assign(toast.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    zIndex: '9999',
    background: 'rgba(22, 61, 49, 0.96)',
    color: '#f3fbf4',
    border: '1px solid rgba(195, 230, 202, 0.45)',
    borderRadius: '999px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.01em',
    boxShadow: '0 8px 24px rgba(8, 20, 15, 0.25)',
    pointerEvents: 'none',
  })
  document.body.appendChild(toast)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`

    const attachUpdateHandler = (registration) => {
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing
        if (!installingWorker) return

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast('Updating app...')
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }

    navigator.serviceWorker
      .register(serviceWorkerUrl)
      .then((registration) => {
        attachUpdateHandler(registration)
        registration.update()
        setInterval(() => registration.update(), 60 * 60 * 1000)
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error)
      })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      showUpdateToast('Update ready. Reloading...')
      window.location.reload()
    })
  })
}

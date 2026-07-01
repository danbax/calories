import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

let activeRegistration = null

const publishPwaUpdateStatus = (status) => {
  window.__caloriesPwaUpdateStatus = status
  window.dispatchEvent(new CustomEvent('calories-pwa-update-status', { detail: { status } }))
}

window.__caloriesForceAppUpdate = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service worker is not supported in this browser.')
  }

  const registration = activeRegistration || (await navigator.serviceWorker.getRegistration())
  if (!registration) {
    throw new Error('App updater is not ready yet. Please try again in a moment.')
  }

  publishPwaUpdateStatus('checking')
  await registration.update()

  if (registration.waiting) {
    publishPwaUpdateStatus('applying')
    showUpdateToast('Applying update...')
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    return
  }

  publishPwaUpdateStatus('idle')
  showUpdateToast('Already up to date.')
}

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
    publishPwaUpdateStatus('idle')

    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {})
    }

    const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`

    const attachUpdateHandler = (registration) => {
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing
        if (!installingWorker) return

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            publishPwaUpdateStatus('available')
            showUpdateToast('Updating app...')
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }

    navigator.serviceWorker
      .register(serviceWorkerUrl)
      .then((registration) => {
        activeRegistration = registration
        attachUpdateHandler(registration)
        registration.update()
        setInterval(() => registration.update(), 60 * 60 * 1000)
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error)
      })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      publishPwaUpdateStatus('reloading')
      showUpdateToast('Update ready. Reloading...')
      window.location.reload()
    })
  })
}

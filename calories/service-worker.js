const CACHE_NAME = 'calories-coach-runtime'
const BASE_PATH = new URL(self.registration.scope).pathname
const toScopedPath = (path) => `${BASE_PATH}${path}`
const OFFLINE_SHELL = [toScopedPath(''), toScopedPath('index.html'), toScopedPath('manifest.json'), toScopedPath('foods.json')]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') {
    return
  }

  if (url.origin !== self.location.origin) {
    return
  }

  // Navigation requests should prefer network so users get new deployments immediately.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(toScopedPath('index.html'), responseClone))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(toScopedPath('index.html'))
          return cached || Response.error()
        }),
    )
    return
  }

  // Static files use stale-while-revalidate for speed plus fast background refresh.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
          }
          return response
        })
        .catch(() => cached)

      return cached || networkFetch
    }),
  )
})

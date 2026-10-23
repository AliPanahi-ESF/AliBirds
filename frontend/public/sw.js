// AliBirds Service Worker - PWA Offline Caching & Web Push Notifications
const CACHE_NAME = 'alibirds-cache-v4'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
]

// 1. Install Event: Pre-cache core shell & activate immediately if requested
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE)
    }).then(() => self.skipWaiting())
  )
})

// 2. Activate Event: Clean up any old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Purging outdated cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// Support SKIP_WAITING message from client update prompt
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// 3. Fetch Event: Network-First for HTML navigations to ensure latest deployment is always served;
//                 Stale-while-revalidate for static assets; bypass for API/Auth & version.json
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Bypass cache completely for Supabase REST/Auth, Netlify serverless functions, version.json, or non-GET
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/.netlify/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/version.json'
  ) {
    return
  }

  // A. Network-First for HTML navigation / document requests
  // Ensures user always gets the freshest index.html with latest bundle hashes
  const isHtml =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')

  if (isHtml) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          }
          return networkResponse
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
        })
    )
    return
  }

  // B. Stale-While-Revalidate for static assets (images, fonts, scripts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update to keep cache fresh
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse))
            }
          })
          .catch(() => {})
        return cachedResponse
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse
        }
        const responseToCache = networkResponse.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache))
        return networkResponse
      })
    })
  )
})

// 4. Web Push Event: Display instant financial and tax alerts
self.addEventListener('push', (event) => {
  let data = {
    title: 'AliBirds NL',
    body: 'Nieuwe melding in uw AliBirds administratie.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'alibirds-alert',
    url: '/',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'general-notification',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Bekijken' },
      { action: 'dismiss', title: 'Sluiten' },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// 5. Notification Click Event: Focus or open the relevant route
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

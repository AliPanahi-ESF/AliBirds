// PWA & Web Push Notification Client Manager for AliBirds NL
import toast from 'react-hot-toast'
import React from 'react'

export interface PushSubscriptionState {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission | 'unsupported'
  subscription: PushSubscription | null
}

let isRefreshing = false

/**
 * Display interactive notification when a new version of the app is available
 */
export function notifyNewVersionAvailable(registration: ServiceWorkerRegistration): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alibirds:app-update-available', { detail: { registration } }))
  }

  // Also show a liquid glass notification toast
  toast(
    (t) => (
      React.createElement('div', { className: 'flex items-center justify-between gap-3 w-full py-1' },
        React.createElement('div', { className: 'flex flex-col text-left' },
          React.createElement('span', { className: 'font-bold text-xs text-slate-100 flex items-center gap-1.5' },
            '🚀 Nieuwe AliBirds versie beschikbaar!'
          ),
          React.createElement('span', { className: 'text-[11px] text-slate-300 mt-0.5' },
            'Tik om direct bij te werken en te laden.'
          )
        ),
        React.createElement('button', {
          onClick: async () => {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' })
            }
            try {
              if (typeof caches !== 'undefined') {
                const names = await caches.keys()
                await Promise.all(names.map((n) => caches.delete(n)))
              }
            } catch {}
            toast.dismiss(t.id)
            window.location.reload()
          },
          className: 'px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl transition-all active:scale-95 shadow-lg shadow-brand-600/30 shrink-0 cursor-pointer',
        }, 'Nu Updaten')
      )
    ),
    {
      duration: 15000,
      id: 'alibirds-app-update-toast',
      style: {
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '12px 16px',
        color: '#f8fafc',
        borderRadius: '20px',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
      },
    }
  )
}

/**
 * Register the Service Worker and listen for new deployment versions
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
    console.log('[PWA] ServiceWorker registered successfully:', registration.scope)

    // 1. Detect when a new service worker is installing
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing
      if (!installingWorker) return

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[PWA] New version installed and waiting!')
          notifyNewVersionAvailable(registration)
        }
      })
    })

    // 2. If a new version is already waiting from a previous visit
    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyNewVersionAvailable(registration)
    }

    // 3. When new worker takes control, reload cleanly once
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isRefreshing) {
        isRefreshing = true
        window.location.reload()
      }
    })

    // 4. Periodically check for updates (every 5 minutes) and on window focus
    setInterval(() => {
      registration.update().catch(() => {})
    }, 5 * 60 * 1000)

    window.addEventListener('focus', () => {
      registration.update().catch(() => {})
    })

    return registration
  } catch (error) {
    console.error('[PWA] ServiceWorker registration failed:', error)
    return null
  }
}

/**
 * Convert base64 VAPID public key string to Uint8Array required by PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Check current push subscription status
 */
export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      isSupported: false,
      isSubscribed: false,
      permission: 'unsupported',
      subscription: null,
    }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    return {
      isSupported: true,
      isSubscribed: !!subscription,
      permission: Notification.permission,
      subscription,
    }
  } catch (error) {
    console.error('[PWA Push] Failed to get subscription state:', error)
    return {
      isSupported: true,
      isSubscribed: false,
      permission: Notification.permission,
      subscription: null,
    }
  }
}

/**
 * Request notification permission and subscribe to Web Push
 */
export async function subscribeToPushNotifications(
  vapidPublicKey?: string
): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'Web Push is not supported in this browser' }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied by user' }
    }

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      }

      // If a VAPID public key is provided (e.g. from environment or settings)
      if (vapidPublicKey) {
        subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as any
      }

      subscription = await registration.pushManager.subscribe(subscribeOptions)
    }

    console.log('[PWA Push] Subscribed to Web Push:', subscription.endpoint)
    return { success: true, subscription }
  } catch (error) {
    console.error('[PWA Push] Subscription error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during subscription',
    }
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      console.log('[PWA Push] Unsubscribed successfully')
      return true
    }
    return false
  } catch (error) {
    console.error('[PWA Push] Unsubscribe failed:', error)
    return false
  }
}

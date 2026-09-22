// PWA & Web Push Notification Client Manager for MoneyBirds NL

export interface PushSubscriptionState {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission | 'unsupported'
  subscription: PushSubscription | null
}

/**
 * Register the Service Worker
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
        subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
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

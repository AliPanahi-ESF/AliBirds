/**
 * AliBirds Haptic Feedback & Touch Gesture Engine
 * Provides subtle, native-feeling vibration feedback on mobile touch devices (iOS & Android).
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'

export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (typeof window === 'undefined' || !('navigator' in window)) return

  try {
    if ('vibrate' in navigator) {
      switch (style) {
        case 'selection':
        case 'light':
          navigator.vibrate(8)
          break
        case 'medium':
          navigator.vibrate(18)
          break
        case 'heavy':
          navigator.vibrate(30)
          break
        case 'success':
          navigator.vibrate([10, 40, 15])
          break
        case 'warning':
          navigator.vibrate([20, 60, 20])
          break
        case 'error':
          navigator.vibrate([30, 80, 40, 80, 50])
          break
      }
    }
  } catch {
    // Gracefully ignore if device disables vibration
  }
}

/**
 * AliBirds Haptic Feedback & Touch Gesture Engine
 * Provides subtle, native-feeling vibration feedback on mobile touch devices (iOS & Android).
 *
 * NOTE FOR iOS SAFARI:
 * Apple intentionally blocks `navigator.vibrate()`.
 * This engine uses:
 * 1. The native iOS 18+ `<input type="checkbox" switch>` label click hack to invoke the Taptic Engine.
 * 2. A 5ms sub-bass impulse via Web Audio API that causes a subtle physical speaker cone tick on iOS.
 * 3. Standard `navigator.vibrate()` on Android and WebKit browsers supporting it.
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'

const isClient = typeof window !== 'undefined' && typeof document !== 'undefined'

const isIOS = isClient && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
)

// Cached hidden iOS switch elements
let iosHapticLabel: HTMLLabelElement | null = null
let audioCtx: AudioContext | null = null

function getIosSwitchLabel(): HTMLLabelElement | null {
  if (!isClient) return null
  if (iosHapticLabel) return iosHapticLabel

  let label = document.getElementById('alibirds-ios-haptic-label') as HTMLLabelElement | null
  if (!label) {
    label = document.createElement('label')
    label.id = 'alibirds-ios-haptic-label'
    label.setAttribute('aria-hidden', 'true')
    label.style.position = 'fixed'
    label.style.top = '-9999px'
    label.style.left = '-9999px'
    label.style.opacity = '0'
    label.style.pointerEvents = 'none'

    const input = document.createElement('input')
    input.type = 'checkbox'
    // iOS 18 switch attribute activates system Taptic Engine on label click
    input.setAttribute('switch', '')
    input.id = 'alibirds-ios-haptic-switch'
    input.tabIndex = -1

    label.appendChild(input)
    document.body.appendChild(label)
  }
  iosHapticLabel = label
  return iosHapticLabel
}

function playIosAudioImpulse(style: HapticStyle): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    if (!audioCtx) {
      audioCtx = new AudioContextClass()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const now = audioCtx.currentTime

    // Low sub-bass frequency generates physical tactile speaker displacement on iPhone
    const freq = style === 'selection' ? 80 : style === 'warning' || style === 'error' ? 60 : 100
    const duration = style === 'heavy' || style === 'warning' ? 0.015 : 0.008

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)

    gain.gain.setValueAtTime(0.04, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start(now)
    osc.stop(now + duration)
  } catch {
    // Graceful fallback if audio is restricted
  }
}

export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (!isClient) return

  // 1. Android / standard browsers with navigator.vibrate
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
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
    } catch {
      // ignore
    }
  }

  // 2. iOS Taptic Engine Trigger via HTML switch element + Audio Cone Impulse
  if (isIOS) {
    try {
      const label = getIosSwitchLabel()
      if (label) {
        label.click()
        if (style === 'success' || style === 'warning') {
          setTimeout(() => label.click(), 60)
        }
      }
    } catch {
      // ignore
    }

    // Optional physical speaker vibration click for tactile feel
    playIosAudioImpulse(style)
  }
}

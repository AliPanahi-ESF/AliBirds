import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, X, ArrowUpRight } from 'lucide-react'

export default function AppUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [buildInfo, setBuildInfo] = useState<{ version?: string }>({})

  // Trigger app update cleanly
  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      }
      if (typeof caches !== 'undefined') {
        const names = await caches.keys()
        await Promise.all(names.map((n) => caches.delete(n)))
      }
    } catch {}
    // Force a fresh reload from network
    window.location.reload()
  }

  useEffect(() => {
    // 1. Listen for Service Worker updates
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return
        if (reg.waiting) {
          setUpdateAvailable(true)
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true)
            }
          })
        })
      }).catch(() => {})
    }

    // 2. Poll version.json periodically and on mobile app resume/focus
    let initialVersion: string | null = null

    const checkVersionJson = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (!initialVersion) {
            initialVersion = data.version || String(data.buildTime)
          } else if (data.version && data.version !== initialVersion) {
            setBuildInfo({ version: data.version })
            setUpdateAvailable(true)
          }
        }
      } catch {}
    }

    // Run first check after 3 seconds
    const firstTimer = setTimeout(checkVersionJson, 3000)

    // Interval every 2.5 minutes
    const interval = setInterval(checkVersionJson, 150_000)

    // Visibility / focus listener: when mobile user returns to the app
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersionJson()
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then(reg => reg?.update()).catch(() => {})
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onVisibilityChange)

    return () => {
      clearTimeout(firstTimer)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onVisibilityChange)
    }
  }, [])

  if (!updateAvailable || dismissed) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:top-6 sm:max-w-md z-50 animate-fade-in"
    >
      <div className="backdrop-blur-2xl bg-slate-900/90 border border-white/20 text-slate-100 rounded-3xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.18)] transition-all">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/30">
            <Sparkles size={18} className="animate-pulse" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">Update Beschikbaar</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Nieuw
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Er is een nieuwe versie van AliBirds uitgerold. Tik op bijwerken om direct de nieuwste functies te laden.
            </p>

            <div className="flex items-center gap-2 mt-3 pt-1">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 py-2 px-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
                <span>{isUpdating ? 'Bijwerken...' : 'Nu Bijwerken'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                Later
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            aria-label="Sluiten"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

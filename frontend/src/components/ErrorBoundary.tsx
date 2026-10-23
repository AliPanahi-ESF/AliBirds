import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AliBirds Uncaught Error Boundary:', error, errorInfo)
    // If it's a dynamic chunk failure from an update, auto-reload once cleanly
    const isChunkError =
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('Importing a module script failed')

    if (isChunkError) {
      const key = 'alibirds_chunk_auto_reload_ts'
      const last = Number(sessionStorage.getItem(key) || 0)
      if (Date.now() - last > 8000) {
        sessionStorage.setItem(key, String(Date.now()))
        try {
          if (typeof caches !== 'undefined') {
            caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).finally(() => {
              window.location.reload()
            })
            return
          }
        } catch {}
        window.location.reload()
      }
    }
  }

  private handleUpdateApp = async () => {
    try {
      if (typeof caches !== 'undefined') {
        const names = await caches.keys()
        await Promise.all(names.map((n) => caches.delete(n)))
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      }
    } catch {}
    window.location.reload()
  }

  private handleReset = () => {
    try {
      localStorage.clear()
    } catch {}
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('Failed to fetch') ||
        this.state.error?.message?.includes('Importing a module script failed')

      if (isChunkError) {
        return (
          <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full backdrop-blur-2xl bg-slate-900/80 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.12)] space-y-5 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center mx-auto text-brand-400 shadow-lg shadow-brand-500/20">
                <RefreshCw size={26} className="animate-spin text-brand-400" />
              </div>
              <div className="space-y-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  Nieuwe AliBirds Versie
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-100">Update Beschikbaar</h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Er is zojuist een update uitgerold voor uw AliBirds boekhouding. Tik op onderstaande knop om direct bij te werken naar de nieuwste versie.
                </p>
              </div>
              <button
                onClick={this.handleUpdateApp}
                className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-xl shadow-brand-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} />
                <span>Nu Bijwerken & Laden</span>
              </button>
            </div>
          </div>
        )
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full backdrop-blur-2xl bg-slate-900/80 border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Er is iets misgegaan</h2>
              <p className="text-xs text-slate-400 mt-1">
                De applicatie heeft een onverwachte fout opgevangen.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-left font-mono text-xs text-red-300 max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={this.handleUpdateApp}
                className="flex-1 btn-secondary text-xs py-2 justify-center rounded-xl"
              >
                <RefreshCw size={13} /> Herlaad pagina
              </button>
              <button
                onClick={this.handleReset}
                className="btn-danger text-xs py-2 px-3 justify-center rounded-xl"
                title="Reset lokale data en herlaad"
              >
                <Trash2 size={13} /> Reset
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

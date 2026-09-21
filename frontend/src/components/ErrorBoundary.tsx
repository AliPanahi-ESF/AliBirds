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
  }

  private handleReset = () => {
    try {
      localStorage.clear()
    } catch {}
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Er is iets misgegaan</h2>
              <p className="text-xs text-slate-400 mt-1">
                De applicatie heeft een onverwachte fout opgevangen.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-left font-mono text-xs text-red-300 max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 btn-secondary text-xs py-2 justify-center"
              >
                <RefreshCw size={13} /> Herlaad pagina
              </button>
              <button
                onClick={this.handleReset}
                className="btn-danger text-xs py-2 px-3 justify-center"
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

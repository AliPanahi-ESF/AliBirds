import React, { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Verwijderen',
  cancelLabel = 'Annuleren',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Auto-focus cancel button on open (safe default preventing accidental Enter-to-delete)
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus()
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget && !isLoading) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
          aria-label="Sluiten"
        >
          <X size={16} />
        </button>

        {/* Header with icon */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {isDanger ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div className="space-y-1 pr-4">
            <h2 id="confirm-dialog-title" className="text-base sm:text-lg font-semibold text-slate-100">
              {title}
            </h2>
            <div id="confirm-dialog-desc" className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary text-xs sm:text-sm py-2 px-4"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`text-xs sm:text-sm py-2 px-4 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20'
            }`}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            <span>{isLoading ? 'Bezig met wissen...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

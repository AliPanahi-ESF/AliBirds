import React, { useRef, useState, useEffect } from 'react'
import { X, RotateCcw, CheckCircle2, ShieldCheck, PenTool } from 'lucide-react'
import toast from 'react-hot-toast'

interface SignatureCanvasModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (signatureDataUrl: string, signerName: string) => Promise<void> | void
  quotationNumber: string
  clientName?: string
  totalAmount?: string
}

export default function SignatureCanvasModal({
  isOpen,
  onClose,
  onSave,
  quotationNumber,
  clientName = '',
  totalAmount = '',
}: SignatureCanvasModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [signerName, setSignerName] = useState(clientName)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize or clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  // Adjust canvas resolution for retina displays
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set dimensions
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * 2
        canvas.height = rect.height * 2
        ctx.scale(2, 2)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#4f46e5' // brand indigo color
        ctx.lineWidth = 2.5
        clearCanvas()
      }, 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Pointer / Mouse events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    setHasDrawn(true)

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleConfirm = async () => {
    if (!hasDrawn) {
      toast.error('Plaats uw handtekening in het vak')
      return
    }
    if (!signerName.trim()) {
      toast.error('Vul uw volledige naam in ter verificatie')
      return
    }
    if (!agreedToTerms) {
      toast.error('U dient akkoord te gaan met de offertevoorwaarden')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    try {
      setIsSubmitting(true)
      const dataUrl = canvas.toDataURL('image/png')
      await onSave(dataUrl, signerName.trim())
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij opslaan handtekening')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/15 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <PenTool size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                Offerte Digitaal Ondertekenen
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {quotationNumber} {totalAmount ? `• Totaal: ${totalAmount}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Sluit venster"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Signer Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Volledige Naam Ondertekenaar *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Bijv. Daan van Dijk"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {/* Signature Pad Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Plaats Handtekening (Touch of Muis) *</span>
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={13} />
                <span>Wissen</span>
              </button>
            </div>

            <div className="relative border-2 border-dashed border-slate-700 hover:border-brand-500/50 rounded-xl bg-slate-950/60 overflow-hidden touch-none transition-colors">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-44 cursor-crosshair"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-500">
                  <PenTool size={24} className="mb-1.5 opacity-40" />
                  <span className="text-xs">Teken hier met uw vinger of muis</span>
                </div>
              )}
              <div className="absolute bottom-4 left-6 right-6 border-b border-slate-800 pointer-events-none flex justify-between">
                <span className="text-[10px] text-slate-600 uppercase font-mono">X Handtekening</span>
                <span className="text-[10px] text-slate-600 font-mono">{new Date().toLocaleDateString('nl-NL')}</span>
              </div>
            </div>
          </div>

          {/* Terms Agreement */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500/50"
            />
            <span className="text-xs text-slate-300 leading-relaxed group-hover:text-slate-200">
              Ik verklaar bevoegd te zijn om namens de opdrachtgever akkoord te gaan met deze offerte en de daaraan verbonden voorwaarden en verplichtingen.
            </span>
          </label>

          {/* Security note */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/40 px-3 py-2 rounded-lg border border-slate-800">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>Juridisch bindende digitale ondertekening inclusief tijdstempel en IP-verificatie.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verwerken...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Akkoord & Ondertekenen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

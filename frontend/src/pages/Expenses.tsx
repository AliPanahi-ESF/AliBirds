import React, { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Trash2, Receipt, X, Calendar, UploadCloud,
  Camera, Sparkles, FileText, CheckCircle2, Eye,
  AlertCircle, ExternalLink, Paperclip
} from 'lucide-react'
import toast from 'react-hot-toast'
import { expensesApi, fmt } from '@/lib/api'
import { Expense, OCRParsedResult } from '@/lib/types'
import { clsx } from 'clsx'
import ConfirmDialog from '@/components/ConfirmDialog'
import { TableRowSkeleton, CardSkeleton } from '@/components/TableSkeleton'

const CATEGORIES = [
  'Software', 'Hardware', 'Kantoor', 'Abonnementen',
  'Reiskosten', 'Marketing', 'Professionele Diensten', 'Overig',
]

const CAT_COLORS: Record<string, string> = {
  Software: 'badge-blue', Hardware: 'badge-purple',
  Kantoor: 'badge-gray', Office: 'badge-gray',
  Abonnementen: 'badge-yellow', Subscriptions: 'badge-yellow',
  Reiskosten: 'badge-green', Travel: 'badge-green',
  Marketing: 'badge-red',
  'Professionele Diensten': 'badge-blue', 'Professional Services': 'badge-blue',
  Overig: 'badge-gray', Other: 'badge-gray',
}

const CAT_LABELS: Record<string, string> = {
  Office: 'Kantoor',
  Subscriptions: 'Abonnementen',
  Travel: 'Reiskosten',
  'Professional Services': 'Professionele Diensten',
  Other: 'Overig',
}

export function formatCategory(cat: string) {
  return CAT_LABELS[cat] || cat
}

interface ExpenseForm {
  vendor_name: string
  expense_date: string
  description: string
  category: string
  amount_excl_vat: number
  vat_rate: string
  amount_incl_vat: number
  vat_amount: number
  receipt_url?: string
  receipt_filename?: string
  ocr_status?: string
}

export default function Expenses() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null)
  const [previewReceiptModal, setPreviewReceiptModal] = useState<{ url: string; title: string } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [aiConfidence, setAiConfidence] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.list(),
  })

  const { register, handleSubmit, watch, setValue, reset } = useForm<ExpenseForm>({
    defaultValues: {
      vendor_name: '',
      expense_date: today,
      description: '',
      category: 'Software',
      amount_excl_vat: 0,
      vat_rate: '21',
      amount_incl_vat: 0,
      vat_amount: 0,
      receipt_url: '',
      receipt_filename: '',
      ocr_status: 'PENDING',
    },
  })

  const excl = watch('amount_excl_vat')
  const rate = watch('vat_rate')
  const [inputMode, setInputMode] = useState<'excl' | 'incl'>('excl')

  const recalcFromExcl = (v: number, customRate?: string) => {
    const activeRate = customRate !== undefined ? customRate : rate
    const r = activeRate === 'REVERSE_CHARGE' ? 0 : (Number(activeRate) / 100)
    const exclVal = Number(v) || 0
    const vat = r > 0 ? Math.round(exclVal * r * 100) / 100 : 0
    const incl = Math.round((exclVal + vat) * 100) / 100
    setValue('amount_excl_vat', exclVal)
    setValue('vat_amount', vat)
    setValue('amount_incl_vat', incl)
  }

  const recalcFromIncl = (v: number, customRate?: string) => {
    const activeRate = customRate !== undefined ? customRate : rate
    const r = activeRate === 'REVERSE_CHARGE' ? 0 : (Number(activeRate) / 100)
    const inclVal = Number(v) || 0
    const exclVal = r > 0 ? Math.round((inclVal / (1 + r)) * 100) / 100 : inclVal
    const vat = Math.round((inclVal - exclVal) * 100) / 100
    setValue('amount_incl_vat', inclVal)
    setValue('amount_excl_vat', exclVal)
    setValue('vat_amount', vat)
  }

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: ExpenseForm) =>
      expensesApi.create({
        ...data,
        amount_excl_vat: Number(data.amount_excl_vat),
        vat_amount: Number(data.vat_amount),
        amount_incl_vat: Number(data.amount_incl_vat),
        receipt_url: activeReceiptUrl || data.receipt_url,
      }),
    onSuccess: () => {
      toast.success('Kosten succesvol opgeslagen!')
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      reset()
      setActiveReceiptUrl(null)
      setAiConfidence(null)
      setShowForm(false)
    },
    onError: () => toast.error('Opslaan mislukt'),
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: expensesApi.delete,
    onSuccess: () => {
      toast.success('Kosten verwijderd')
      setDeletingExpense(null)
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
    onError: () => toast.error('Verwijderen mislukt'),
  })

  // Process dropped/selected receipt file through OCR
  const handleProcessFile = async (file: File) => {
    try {
      setIsScanning(true)
      const toastId = toast.loading(`AI analyseert "${file.name}"...`)

      const result: OCRParsedResult = await expensesApi.scanReceipt(file)

      toast.dismiss(toastId)
      toast.success(`Herkend: ${result.vendor_name} (${fmt.currency(result.amount_incl_vat)})`)

      // Pre-fill form fields
      setValue('vendor_name', result.vendor_name || 'Leverancier')
      setValue('expense_date', result.expense_date || today)
      setValue('description', result.description || `Inkoop bij ${result.vendor_name}`)
      setValue('category', result.category || 'Software')
      setValue('amount_excl_vat', Number(result.amount_excl_vat) || 0)
      setValue('vat_rate', String(result.vat_rate || '21'))
      setValue('vat_amount', Number(result.vat_amount) || 0)
      setValue('amount_incl_vat', Number(result.amount_incl_vat) || 0)
      setValue('receipt_filename', result.receipt_filename || file.name)
      setValue('ocr_status', 'PROCESSED')

      if (result.receipt_url) {
        setActiveReceiptUrl(result.receipt_url)
        setValue('receipt_url', result.receipt_url)
      }

      setAiConfidence(result.confidence || 0.95)
      setShowForm(true)
    } catch (err: any) {
      toast.error('Kon bon niet automatisch analyseren. Vul handmatig in.')
      setShowForm(true)
    } finally {
      setIsScanning(false)
    }
  }

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      handleProcessFile(file)
    }
  }

  const handleManualAdd = () => {
    reset({
      vendor_name: '',
      expense_date: today,
      description: '',
      category: 'Software',
      amount_excl_vat: 0,
      vat_rate: '21',
      amount_incl_vat: 0,
      vat_amount: 0,
      receipt_url: '',
      receipt_filename: '',
      ocr_status: 'PENDING',
    })
    setActiveReceiptUrl(null)
    setAiConfidence(null)
    setShowForm(true)
  }

  const totalExcl = expenses.reduce((s, e) => s + Number(e.amount_excl_vat), 0)
  const totalVat = expenses.reduce((s, e) => s + Number(e.vat_amount), 0)
  const totalIncl = expenses.reduce((s, e) => s + Number(e.amount_incl_vat), 0)

  return (
    <div className="space-y-6 w-full animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2.5">
            <span>Kosten & Uitgaven</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
              Smart Inbox
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Zakelijke uitgaven, automatische bonherkenning en aftrekbare voorbelasting (Rubriek 5b)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualAdd}
            className="btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Handmatig invoeren</span>
          </button>
        </div>
      </div>

      {/* AI Smart Inbox Drag-and-Drop Dropzone (Moneybird Inspired) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'relative card p-6 sm:p-8 border-2 border-dashed transition-all duration-200 text-center overflow-hidden',
          isDragActive
            ? 'border-purple-500 bg-purple-950/30 scale-[1.01] shadow-2xl shadow-purple-500/10'
            : 'border-slate-800 hover:border-slate-700 bg-gradient-to-b from-slate-900/90 to-slate-950/60'
        )}
      >
        {isScanning ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="relative">
              <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <Sparkles size={20} className="absolute inset-0 m-auto text-purple-400 animate-pulse" />
            </div>
            <div className="text-sm font-bold text-slate-100 animate-pulse">
              AI Vision analyseert bon & extraheert bedragen...
            </div>
            <p className="text-xs text-slate-400">
              Herkennen van leverancier, btw-tarief, datum en voorbelasting (5b)
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/15 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-600/10">
              <UploadCloud size={24} />
            </div>

            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center justify-center gap-1.5">
                <span>Sleep kassabonnen of facturen hierheen</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 font-mono px-1.5 py-0.5 rounded">
                  AI OCR
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ondersteunt JPG, PNG, WebP en PDF facturen tot 25MB
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary bg-purple-600 hover:bg-purple-500 border-purple-500 py-2 px-4 text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <UploadCloud size={14} />
                <span>Bestand selecteren</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 text-slate-300"
              >
                <Camera size={14} />
                <span>Foto maken (Mobiel)</span>
              </button>
            </div>

            {/* Hidden native inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0])
                }
              }}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0])
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5">
          <div className="text-xs text-slate-400 font-medium">Totaal Uitgaven (excl)</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-100 mt-1">
            {fmt.currency(totalExcl)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Netto bedrijfskosten</div>
        </div>

        <div className="card p-4 sm:p-5 border-emerald-500/20 bg-emerald-950/10">
          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <span>Voorbelasting (Rubriek 5b)</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
            {fmt.currency(totalVat)}
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Terug te vorderen van belastingdienst</div>
        </div>

        <div className="card p-4 sm:p-5 col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-400 font-medium">Geregistreerde Posten</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-100 mt-1">
            {expenses.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{fmt.currency(totalIncl)} incl. btw</div>
        </div>
      </div>

      {/* Side-by-Side Add Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className={clsx(
              'bg-slate-900 border border-slate-700/80 rounded-2xl w-full animate-fade-in shadow-2xl my-4 overflow-hidden flex flex-col',
              activeReceiptUrl ? 'max-w-4xl' : 'max-w-xl'
            )}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
                    <span>Kostenpost Invoeren</span>
                    {aiConfidence && (
                      <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center gap-1">
                        <Sparkles size={11} />
                        <span>AI Herkend ({Math.round(aiConfidence * 100)}%)</span>
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Controleer en bevestig de gegevens van uw uitgave
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content: Side-by-Side (Receipt Preview + Form) */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800 max-h-[80vh] overflow-y-auto">
              {/* Left Column: Receipt Document Preview */}
              {activeReceiptUrl && (
                <div className="md:col-span-5 p-4 sm:p-5 bg-slate-950/60 flex flex-col items-center justify-center space-y-3">
                  <div className="w-full flex items-center justify-between text-xs text-slate-400 pb-1">
                    <span className="font-medium flex items-center gap-1">
                      <Paperclip size={13} />
                      <span>Originele Bijlage</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewReceiptModal({ url: activeReceiptUrl, title: watch('vendor_name') })}
                      className="text-purple-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Eye size={12} />
                      <span>Vergroten</span>
                    </button>
                  </div>

                  <div className="relative w-full max-h-96 rounded-xl border border-slate-800 overflow-hidden bg-slate-900 flex items-center justify-center shadow-inner">
                    {activeReceiptUrl.startsWith('data:application/pdf') ? (
                      <div className="p-8 text-center space-y-2">
                        <FileText size={48} className="text-purple-400 mx-auto" />
                        <div className="text-xs font-semibold text-slate-200">
                          {watch('receipt_filename') || 'PDF Factuur'}
                        </div>
                        <p className="text-[10px] text-slate-400">PDF document gekoppeld</p>
                      </div>
                    ) : (
                      <img
                        src={activeReceiptUrl}
                        alt="Geüploade bon"
                        className="object-contain max-h-96 w-full cursor-zoom-in"
                        onClick={() => setPreviewReceiptModal({ url: activeReceiptUrl, title: watch('vendor_name') })}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Right Column: Pre-filled Form */}
              <form
                onSubmit={handleSubmit((d) => createMutation.mutate(d))}
                className={clsx('p-5 space-y-4', activeReceiptUrl ? 'md:col-span-7' : 'md:col-span-12')}
              >
                <div>
                  <label className="label text-xs">Leverancier / Begunstigde *</label>
                  <input
                    className="input text-xs sm:text-sm"
                    placeholder="Bijv. Shell, Apple, Adobe, NS Zakelijk..."
                    {...register('vendor_name', { required: true })}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Factuurdatum *</label>
                    <input
                      type="date"
                      className="input text-xs sm:text-sm font-mono"
                      {...register('expense_date', { required: true })}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Categorie</label>
                    <select className="select text-xs sm:text-sm" {...register('category')}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label text-xs">Omschrijving</label>
                  <input
                    className="input text-xs sm:text-sm"
                    placeholder="Bijv. Tankbeurt bedrijfswagen, Software licentie..."
                    {...register('description')}
                  />
                </div>

                {/* Calculation Mode */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400 font-medium">Invoermodus:</span>
                  <div className="flex gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setInputMode('excl')}
                      className={clsx(
                        'px-2.5 py-1 rounded transition-colors',
                        inputMode === 'excl'
                          ? 'bg-purple-600 text-white font-medium shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      )}
                    >
                      Excl. btw
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('incl')}
                      className={clsx(
                        'px-2.5 py-1 rounded transition-colors',
                        inputMode === 'incl'
                          ? 'bg-purple-600 text-white font-medium shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      )}
                    >
                      Incl. btw (Bon)
                    </button>
                  </div>
                </div>

                {/* Amount & VAT Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  {inputMode === 'excl' ? (
                    <div>
                      <label className="label text-xs">Bedrag excl. btw (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input text-xs sm:text-sm font-mono text-right"
                        {...register('amount_excl_vat', { valueAsNumber: true })}
                        onChange={(e) => recalcFromExcl(Number(e.target.value))}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="label text-xs">Totaal incl. btw (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input text-xs sm:text-sm font-mono text-right font-bold text-slate-100"
                        {...register('amount_incl_vat', { valueAsNumber: true })}
                        onChange={(e) => recalcFromIncl(Number(e.target.value))}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="label text-xs">Btw-tarief</label>
                    <select
                      className="select text-xs sm:text-sm"
                      {...register('vat_rate')}
                      onChange={(e) => {
                        const newR = e.target.value
                        setValue('vat_rate', newR)
                        if (inputMode === 'excl') {
                          recalcFromExcl(watch('amount_excl_vat'), newR)
                        } else {
                          recalcFromIncl(watch('amount_incl_vat'), newR)
                        }
                      }}
                    >
                      <option value="21">21% (hoog)</option>
                      <option value="9">9% (laag)</option>
                      <option value="0">0% (nul)</option>
                      <option value="REVERSE_CHARGE">Verlegd (0% / EU)</option>
                    </select>
                  </div>
                </div>

                {/* Live Preview Summary Widget */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Excl. btw:</span>
                    <span className="text-slate-200 font-bold">{fmt.currency(Number(watch('amount_excl_vat')) || 0)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-500 block text-[10px]">
                      Btw ({rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${rate}%`}):
                    </span>
                    <span className="text-purple-400 font-bold">{fmt.currency(Number(watch('vat_amount')) || 0)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">Totaal incl.:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {fmt.currency(Number(watch('amount_incl_vat')) || 0)}
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-secondary text-xs sm:text-sm py-2 px-3.5"
                  >
                    <span>Annuleren</span>
                  </button>
                  <button
                    type="submit"
                    className="btn-primary bg-purple-600 hover:bg-purple-500 border-purple-500 text-white text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                    disabled={createMutation.isPending}
                  >
                    <CheckCircle2 size={15} />
                    <span>{createMutation.isPending ? 'Opslaan...' : 'Kosten & Bon Opslaan'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Full Receipt Image / PDF Lightbox Modal */}
      {previewReceiptModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900">
              <span className="text-sm font-bold text-slate-100">
                Bon Bijlage: {previewReceiptModal.title}
              </span>
              <button
                onClick={() => setPreviewReceiptModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto p-4 flex items-center justify-center bg-slate-950 min-h-[400px]">
              {previewReceiptModal.url.startsWith('data:application/pdf') ? (
                <div className="text-center space-y-3 py-12">
                  <FileText size={64} className="text-purple-400 mx-auto" />
                  <p className="text-sm text-slate-300">PDF document geüpload</p>
                </div>
              ) : (
                <img
                  src={previewReceiptModal.url}
                  alt={previewReceiptModal.title}
                  className="object-contain max-h-[75vh] w-auto rounded-lg shadow-2xl"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <CardSkeleton count={4} />
        ) : expenses.length === 0 ? (
          <div className="card text-center py-10 text-xs text-slate-500">Geen kosten gevonden</div>
        ) : (
          expenses.map((exp) => (
            <div key={exp.id} className="card p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                    <span>{exp.vendor_name}</span>
                    {exp.receipt_url && (
                      <button
                        onClick={() => setPreviewReceiptModal({ url: exp.receipt_url!, title: exp.vendor_name })}
                        className="text-purple-400 hover:text-purple-300"
                        title="Bekijk bon"
                      >
                        <Paperclip size={13} />
                      </button>
                    )}
                  </div>
                  {exp.description && (
                    <div className="text-xs text-slate-400 mt-0.5">{exp.description}</div>
                  )}
                </div>
                <span className={clsx(CAT_COLORS[exp.category] ?? 'badge-gray', 'text-[10px]')}>
                  {formatCategory(exp.category)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800 text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-500" />
                  <span>{fmt.date(exp.expense_date)}</span>
                  <span className="text-slate-600">·</span>
                  <span>{exp.vat_rate}% btw</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-slate-100">
                      {fmt.currency(Number(exp.amount_incl_vat))}
                    </span>
                    <span className="text-[10px] text-emerald-400 block font-mono">
                      +{fmt.currency(Number(exp.vat_amount))} btw
                    </span>
                  </div>
                  <button
                    onClick={() => setDeletingExpense(exp)}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-1"
                    title="Uitgave verwijderen"
                    aria-label={`Uitgave van ${exp.vendor_name} verwijderen`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Expenses table (>= md) */}
      <div className="hidden md:block table-wrapper bg-slate-900">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-3.5 font-medium">Datum</th>
              <th className="p-3.5 font-medium">Leverancier</th>
              <th className="p-3.5 font-medium">Omschrijving</th>
              <th className="p-3.5 font-medium">Categorie</th>
              <th className="p-3.5 font-medium">Bijlage</th>
              <th className="p-3.5 font-medium">Btw%</th>
              <th className="p-3.5 font-medium text-right">Excl. btw</th>
              <th className="p-3.5 font-medium text-right">Btw (5b)</th>
              <th className="p-3.5 font-medium text-right">Incl. btw</th>
              <th className="p-3.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <TableRowSkeleton cols={10} rows={5} />
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-slate-500">
                  Nog geen kosten geregistreerd. Sleep een bon in de Smart Inbox hierboven!
                </td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">
                    {fmt.date(exp.expense_date)}
                  </td>
                  <td className="p-3.5 font-medium text-slate-200">
                    {exp.vendor_name}
                  </td>
                  <td className="p-3.5 text-slate-400 text-xs max-w-[160px] truncate">
                    {exp.description ?? '—'}
                  </td>
                  <td className="p-3.5">
                    <span className={CAT_COLORS[exp.category] ?? 'badge-gray'}>
                      {formatCategory(exp.category)}
                    </span>
                  </td>
                  {/* Receipt Attachment Thumbnail */}
                  <td className="p-3.5">
                    {exp.receipt_url ? (
                      <button
                        onClick={() => setPreviewReceiptModal({ url: exp.receipt_url!, title: exp.vendor_name })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 transition-colors"
                        title="Bekijk originele bon"
                      >
                        <Paperclip size={12} />
                        <span>Bon</span>
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-400 text-xs">
                    {exp.vat_rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${exp.vat_rate}%`}
                  </td>
                  <td className="p-3.5 text-right font-mono text-xs text-slate-300">
                    {fmt.currency(Number(exp.amount_excl_vat))}
                  </td>
                  <td className="p-3.5 text-right font-mono text-xs text-emerald-400">
                    {fmt.currency(Number(exp.vat_amount))}
                  </td>
                  <td className="p-3.5 text-right font-mono text-sm font-semibold text-slate-100">
                    {fmt.currency(Number(exp.amount_incl_vat))}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => setDeletingExpense(exp)}
                      className="btn-danger p-1.5 rounded-lg text-red-400 opacity-80 group-hover:opacity-100"
                      title="Uitgave verwijderen"
                      aria-label={`Uitgave van ${exp.vendor_name} verwijderen`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingExpense)}
        title="Uitgave verwijderen"
        description={
          <span>
            Weet u zeker dat u de uitgave van{' '}
            <strong className="text-slate-200">{deletingExpense?.vendor_name}</strong> ter waarde van{' '}
            <strong className="text-slate-200">
              {fmt.currency(Number(deletingExpense?.amount_incl_vat))}
            </strong>{' '}
            wilt verwijderen?
          </span>
        }
        confirmLabel="Uitgave wissen"
        cancelLabel="Annuleren"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingExpense) deleteMutation.mutate(deletingExpense.id)
        }}
        onClose={() => setDeletingExpense(null)}
      />
    </div>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import {
  Plus, Trash2, Save, Send, Download, Eye, EyeOff, ChevronDown,
  RefreshCw, ArrowLeft, Mail, Sparkles, Hash, CheckCircle, Copy, Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { invoicesApi, clientsApi, settingsApi, fmt } from '@/lib/api'
import { Client, Invoice, LineItem, BusinessSettings } from '@/lib/types'
import InvoicePrintModal from '@/components/InvoicePrintModal'
import SendInvoiceModal from '@/components/SendInvoiceModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import QuickClientModal from '@/components/QuickClientModal'
import { sendInvoiceViaResend, generateMailtoUrl, isResendConfigured } from '@/lib/email'
import { calculateLineItem } from '@/lib/vatCalculator'
import { getSmartInvoiceIdOptions, InvoiceIdOption } from '@/lib/invoiceNumbering'
import { generateRfReference, isValidRfReference } from '@/lib/paymentReference'
import { triggerHaptic } from '@/lib/haptics'

interface LineItemRow {
  description: string
  quantity: number
  unit_price: number
  vat_rate: string
  sort_order: number
}

interface FormData {
  client_id: string
  issue_date: string
  delivery_date: string
  due_date: string
  calculation_mode: 'EXCLUSIVE' | 'INCLUSIVE'
  payment_reference: string
  notes: string
  line_items: LineItemRow[]
}

const VAT_OPTIONS = [
  { value: '21', label: '21% (hoog)' },
  { value: '9',  label: '9% (laag)' },
  { value: '0',  label: '0% (nul)' },
  { value: 'REVERSE_CHARGE', label: 'Verlegd' },
]

function calcLine(row: LineItemRow, mode: string) {
  return calculateLineItem(row.quantity, row.unit_price, row.vat_rate, mode)
}

export default function InvoiceEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const isEdit = Boolean(id)
  const [showPreview, setShowPreview] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [liveCalc, setLiveCalc] = useState({ excl: 0, vat: 0, incl: 0 })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showQuickClientModal, setShowQuickClientModal] = useState(false)

  // Smart Invoice ID state: initialized immediately so it is never blank
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => `${new Date().getFullYear()}-0001`)
  const [selectedNumberMode, setSelectedNumberMode] = useState<string>('AUTO')
  const [userEditedNumber, setUserEditedNumber] = useState<boolean>(false)
  const [userEditedPaymentRef, setUserEditedPaymentRef] = useState<boolean>(false)
  const [copiedRef, setCopiedRef] = useState<boolean>(false)

  const { data: settings } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  })

  const { data: existing } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id!),
    enabled: isEdit,
  })

  const today = new Date().toISOString().slice(0, 10)
  const due14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)

  const { register, control, watch, setValue, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      client_id: '',
      issue_date: today,
      delivery_date: today,
      due_date: due14,
      calculation_mode: 'EXCLUSIVE',
      payment_reference: '',
      notes: '',
      line_items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: '21', sort_order: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })
  const watchedItems = watch('line_items')
  const mode = watch('calculation_mode')
  const selectedClientId = watch('client_id')
  const selectedClient = clients.find(c => c.id === selectedClientId)

  // Calculate smart invoice ID options dynamically
  const smartIdOptions = useMemo(() => {
    return getSmartInvoiceIdOptions({
      selectedClient,
      invoices: allInvoices,
      settings,
    })
  }, [selectedClient, allInvoices, settings])

  // Sync / Auto-suggest invoice number
  useEffect(() => {
    if (isEdit && existing?.invoice_number) {
      setInvoiceNumber(existing.invoice_number)
      setSelectedNumberMode('CUSTOM')
      return
    }

    if (!userEditedNumber && smartIdOptions.length > 0) {
      const recommended = smartIdOptions.find(o => o.isRecommended) || smartIdOptions[0]
      if (recommended) {
        setInvoiceNumber(recommended.id)
        setSelectedNumberMode(recommended.mode)
      }
    }
  }, [selectedClientId, existing, isEdit, userEditedNumber, smartIdOptions])

  // Auto-sync structured SEPA payment reference when invoice number changes
  const watchedPaymentRef = watch('payment_reference')
  useEffect(() => {
    if (isEdit && existing?.payment_reference) {
      return
    }
    if (!userEditedPaymentRef && invoiceNumber) {
      const generated = generateRfReference(invoiceNumber)
      setValue('payment_reference', generated, { shouldValidate: true })
    }
  }, [invoiceNumber, isEdit, existing, userEditedPaymentRef, setValue])

  // Pre-fill from existing invoice
  useEffect(() => {
    if (existing) {
      reset({
        client_id: existing.client_id,
        issue_date: fmt.dateInput(existing.issue_date),
        delivery_date: fmt.dateInput(existing.delivery_date ?? ''),
        due_date: fmt.dateInput(existing.due_date),
        calculation_mode: existing.calculation_mode,
        payment_reference: existing.payment_reference ?? '',
        notes: existing.notes ?? '',
        line_items: existing.line_items.map((it, idx) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
          sort_order: idx,
        })),
      })
    }
  }, [existing, reset])

  // Recalculate totals on item or mode changes
  useEffect(() => {
    let totExcl = 0
    let totVat = 0
    let totIncl = 0
    for (const row of watchedItems || []) {
      const { excl, vat, incl } = calcLine(row, mode)
      totExcl += excl
      totVat += vat
      totIncl += incl
    }
    setLiveCalc({
      excl: Math.round(totExcl * 100) / 100,
      vat: Math.round(totVat * 100) / 100,
      incl: Math.round(totIncl * 100) / 100,
    })
  }, [watchedItems, mode])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? invoicesApi.update(id!, data) : invoicesApi.create(data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      toast.success(isEdit ? 'Factuur bijgewerkt!' : 'Factuur aangemaakt!')
      if (!isEdit) nav(`/invoices/${saved.id}/edit`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail ?? 'Opslaan mislukt')
    },
  })

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: () => invoicesApi.send(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Factuur per e-mail verzonden!')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail ?? 'Verzenden mislukt')
    },
  })

  // Render PDF mutation
  const renderPdfMutation = useMutation({
    mutationFn: () => invoicesApi.renderPdf(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      toast.success('PDF gegenereerd!')
      setShowPreview(true)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => invoicesApi.delete(id!),
    onSuccess: () => {
      toast.success('Factuur succesvol verwijderd!')
      setShowDeleteConfirm(false)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      nav('/invoices')
    },
    onError: () => toast.error('Verwijderen mislukt'),
  })

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const handleSendInvoice = async () => {
    if (!existing) return
    setIsSendingEmail(true)
    try {
      if (isResendConfigured()) {
        const res = await sendInvoiceViaResend(existing, settings)
        if (res.ok) {
          toast.success(res.message)
          qc.invalidateQueries({ queryKey: ['invoice', id] })
        } else {
          toast.error(res.message)
          // Fallback to client email client so work is never blocked
          const mailto = generateMailtoUrl(existing, settings)
          window.open(mailto, '_blank')
        }
      } else {
        const mailto = generateMailtoUrl(existing, settings)
        window.open(mailto, '_blank')
        toast('Factuurconcept geopend in uw e-mailprogramma!', { icon: '✉️' })
      }
    } finally {
      setIsSendingEmail(false)
    }
  }

  // Construct a live invoice that always reflects the currently chosen customer and line items
  const currentInvoice: Invoice = {
    id: existing?.id || 'new-invoice-preview',
    invoice_number: invoiceNumber.trim() || existing?.invoice_number || `${settings?.invoice_prefix || '2026-'}${String(settings?.next_invoice_sequence || 1).padStart(4, '0')}`,
    client_id: selectedClientId,
    client: selectedClient,
    issue_date: watch('issue_date') || today,
    delivery_date: watch('delivery_date') || undefined,
    due_date: watch('due_date') || due14,
    status: existing?.status || 'DRAFT',
    calculation_mode: mode,
    subtotal_excl_vat: liveCalc.excl,
    subtotal_excl: liveCalc.excl,
    total_vat_amount: liveCalc.vat,
    total_vat: liveCalc.vat,
    total_incl_vat: liveCalc.incl,
    total_incl: liveCalc.incl,
    amount_paid: Number(existing?.amount_paid || 0),
    payment_reference: watch('payment_reference') || existing?.payment_reference || '',
    notes: watch('notes') || existing?.notes || settings?.invoice_notes_default || '',
    line_items: (watchedItems || []).map((it, idx) => {
      const { excl, vat, incl } = calcLine(it, mode)
      return {
        id: (it as any).id || `preview-item-${idx}`,
        description: it.description || `Item ${idx + 1}`,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        vat_rate: (it.vat_rate || '21') as import('@/lib/types').VATRate,
        vat_amount: vat,
        line_total_excl: excl,
        line_total_incl: incl,
        sort_order: idx + 1,
      }
    }),
    created_at: existing?.created_at || today,
    updated_at: existing?.updated_at || today,
  }

  const onSubmit = (data: FormData) => {
    const processedLineItems = (data.line_items || []).map((it, idx) => {
      const { excl, vat, incl } = calcLine(it, data.calculation_mode)
      return {
        id: (it as any).id || `item-${Date.now()}-${idx}`,
        description: it.description || `Item ${idx + 1}`,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        vat_rate: String(it.vat_rate || '21'),
        vat_amount: vat,
        line_total_excl: excl,
        line_total_incl: incl,
        sort_order: idx + 1,
      }
    })

    const invoiceNum = invoiceNumber.trim() || existing?.invoice_number || `${settings?.invoice_prefix || '2026-'}${String(settings?.next_invoice_sequence || 1).padStart(4, '0')}`
    const finalPaymentRef = (data.payment_reference && data.payment_reference.trim())
      ? data.payment_reference.trim()
      : generateRfReference(invoiceNum)

    const payload = {
      ...data,
      id: existing?.id,
      invoice_number: invoiceNum,
      payment_reference: finalPaymentRef,
      client: selectedClient,
      client_id: data.client_id || selectedClient?.id,
      subtotal_excl: liveCalc.excl,
      subtotal_excl_vat: liveCalc.excl,
      total_vat: liveCalc.vat,
      total_vat_amount: liveCalc.vat,
      total_incl: liveCalc.incl,
      total_incl_vat: liveCalc.incl,
      line_items: processedLineItems,
    }
    saveMutation.mutate(payload as any)
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => nav('/invoices')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Terug naar overzicht"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
              {isEdit ? `Factuur ${existing?.invoice_number ?? 'laden...'}` : 'Nieuwe factuur'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? `Status: ${existing?.status}` : 'Concept factuur opmaken'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 text-brand-400 border-brand-500/30 flex items-center gap-1.5"
            title="Afdrukken of opslaan als PDF"
          >
            <Download size={14} /> <span>PDF / Afdrukken</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (!isEdit) {
                await handleSubmit(async (formData) => {
                  try {
                    const saved = await invoicesApi.create(formData)
                    qc.invalidateQueries({ queryKey: ['invoices'] })
                    setShowSendModal(true)
                    nav(`/invoices/${saved.id}/edit`, { replace: true })
                  } catch (e: any) {
                    toast.error(e?.message || 'Sla de factuur eerst op.')
                  }
                })()
              } else {
                setShowSendModal(true)
              }
            }}
            className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5"
            title="Factuur verzenden per e-mail"
          >
            <Send size={14} /> <span>Verzenden</span>
          </button>

          {isEdit && existing && (
            <button
              type="button"
              onClick={handleDelete}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-1.5 px-2.5 border border-red-500/20 flex items-center gap-1.5"
              title="Factuur verwijderen"
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} /> <span>{deleteMutation.isPending ? 'Wissen...' : 'Verwijderen'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit(onSubmit, (formErrors) => {
              if (formErrors.client_id) {
                toast.error('Selecteer eerst een klant voordat u de factuur opslaat.')
              }
            })}
            className="btn-primary text-xs sm:text-sm py-1.5 px-3.5 ml-auto sm:ml-0 flex items-center gap-1.5"
            disabled={saveMutation.isPending}
          >
            <Save size={14} /> <span>{saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}</span>
          </button>
        </div>
      </div>

      <div className={`grid gap-4 sm:gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor form */}
        <div className="space-y-4">
          {/* Client + Dates */}
          <div className="liquid-glass-card p-3.5 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Klant *</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickClientModal(true)}
                    className="text-xs text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Nieuwe klant</span>
                  </button>
                </div>
                <select
                  className={clsx(
                    'select text-xs sm:text-sm',
                    errors.client_id && 'border-red-500 focus:border-red-500 ring-1 ring-red-500/30'
                  )}
                  {...register('client_id', { required: 'Selecteer een klant' })}
                >
                  <option value="">— Selecteer klant —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.client_id && (
                  <p className="text-red-400 text-[11px] mt-1 font-medium">Selecteer een klant om de factuur op te slaan.</p>
                )}
                {selectedClient && (
                  <div className="mt-2 text-xs text-slate-400 p-2 rounded bg-slate-800/40 border border-slate-800 space-y-0.5">
                    <div className="font-medium text-slate-300">{selectedClient.name}</div>
                    <div>{selectedClient.billing_address_street}</div>
                    <div>{selectedClient.billing_address_postcode} {selectedClient.billing_address_city}</div>
                    {selectedClient.vat_number && <div className="text-brand-400 font-mono text-[11px]">BTW: {selectedClient.vat_number}</div>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-2.5">
                <div>
                  <label className="label">Factuurdatum</label>
                  <input type="date" className="input text-xs sm:text-sm" {...register('issue_date')} />
                </div>
                <div>
                  <label className="label">Leveringsdatum</label>
                  <input type="date" className="input text-xs sm:text-sm" {...register('delivery_date')} />
                </div>
                <div>
                  <label className="label">Vervaldatum</label>
                  <input type="date" className="input text-xs sm:text-sm" {...register('due_date')} />
                </div>
              </div>
            </div>

            {/* Smart Factuurnummer (ID) Section */}
            <div className="p-3.5 sm:p-4 rounded-xl liquid-glass-box space-y-2.5 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
                    <Hash size={13} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      Factuurnummer (ID) *
                      {selectedNumberMode === 'CLIENT_SEQ' && (
                        <span className="badge-green text-[10px] py-0 px-1.5 flex items-center gap-1">
                          <Sparkles size={9} /> +1 van klant
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400">Opeenvolgende Belastingdienst identificatie</span>
                  </div>
                </div>

                {userEditedNumber && !isEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserEditedNumber(false)
                      const rec = smartIdOptions.find(o => o.isRecommended) || smartIdOptions[0]
                      if (rec) {
                        setInvoiceNumber(rec.id)
                        setSelectedNumberMode(rec.mode)
                      }
                    }}
                    className="text-[11px] text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>Automatische suggestie herstellen</span>
                  </button>
                )}
              </div>

              <div className="relative flex items-center">
                <input
                  id="invoice-number-input"
                  name="invoice_number"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => {
                    setInvoiceNumber(e.target.value)
                    setUserEditedNumber(true)
                    setSelectedNumberMode('CUSTOM')
                  }}
                  placeholder="bijv. 2026-0001"
                  className="w-full bg-slate-950/80 border border-white/15 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3 py-2 pl-8 pr-16 text-xs sm:text-sm font-mono font-bold text-brand-300 tracking-wide transition-all shadow-inner"
                />
                <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const rec = smartIdOptions.find(o => o.isRecommended) || smartIdOptions[0]
                      if (rec) {
                        setInvoiceNumber(rec.id)
                        setSelectedNumberMode(rec.mode)
                        setUserEditedNumber(false)
                        toast.success(`Suggestie toegepast: ${rec.id}`)
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-slate-800 transition-colors"
                    title="Herbereken volgens de hoogste reeks"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* Smart Options Pills */}
              {!isEdit && smartIdOptions.length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <span>Nummeropties:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {smartIdOptions.map((opt) => {
                      const isActive = invoiceNumber === opt.id
                      return (
                        <button
                          key={opt.mode}
                          type="button"
                          onClick={() => {
                            setInvoiceNumber(opt.id)
                            setSelectedNumberMode(opt.mode)
                            setUserEditedNumber(false)
                          }}
                          className={clsx(
                            'px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer',
                            isActive
                              ? 'bg-brand-600/30 text-brand-300 border border-brand-500/50 shadow-sm'
                              : 'bg-white/[0.04] text-slate-300 border border-white/10 hover:bg-white/[0.08]'
                          )}
                          title={opt.description}
                        >
                          {opt.isRecommended && <Sparkles size={11} className="text-amber-400 shrink-0" />}
                          <span className="text-[11px] text-slate-400">{opt.label}:</span>
                          <strong className="text-slate-100 font-bold">{opt.id}</strong>
                          {isActive && <CheckCircle size={12} className="text-emerald-400 ml-0.5" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Informative explanation banner */}
                  {selectedClient && selectedNumberMode === 'CLIENT_SEQ' && smartIdOptions.find(o => o.mode === 'CLIENT_SEQ')?.previousInvoiceNumber && (
                    <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl flex items-center gap-1.5 mt-1">
                      <Sparkles size={13} className="shrink-0 text-emerald-400" />
                      <span>
                        Vorige factuur voor <strong>{selectedClient.name}</strong> was{' '}
                        <code className="font-mono text-emerald-300 font-bold">
                          {smartIdOptions.find(o => o.mode === 'CLIENT_SEQ')?.previousInvoiceNumber}
                        </code>
                        . Volgend volgnummer automatisch ingesteld op{' '}
                        <code className="font-mono text-white font-bold">{invoiceNumber}</code> (+1).
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* VAT mode toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-800/40 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-300 font-medium">Berekeningsmodus:</span>
                <Controller
                  control={control}
                  name="calculation_mode"
                  render={({ field }) => (
                    <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                      {[
                        { value: 'EXCLUSIVE', label: 'Excl. btw' },
                        { value: 'INCLUSIVE', label: 'Incl. btw' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            field.value === opt.value
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>
              <span className="text-[11px] text-slate-500">
                {mode === 'EXCLUSIVE' ? 'Invoer is nettoprijs' : 'Invoer is brutoprijs'}
              </span>
            </div>
          </div>

          {/* Line items */}
          <div className="liquid-glass-card p-3.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">Regelitems</h2>
            </div>

            {/* Unified Responsive Line Items */}
            <div className="space-y-3">
              {/* Desktop Header row (hidden on mobile) */}
              <div className="hidden sm:grid grid-cols-[1fr_85px_115px_125px_36px] gap-2.5 px-3 text-xs text-slate-400 font-medium">
                <span>Omschrijving</span>
                <span className="text-right">Aantal</span>
                <span className="text-right">{mode === 'EXCLUSIVE' ? 'Prijs excl.' : 'Prijs incl.'}</span>
                <span>Btw-tarief</span>
                <span />
              </div>

              {fields.map((field, idx) => {
                const row = watchedItems?.[idx]
                const { excl, vat, incl } = row ? calcLine(row, mode) : { excl: 0, vat: 0, incl: 0 }
                return (
                  <div
                    key={field.id}
                    className="p-3 sm:p-2.5 bg-slate-950/50 rounded-xl sm:rounded-lg border border-slate-800/80 space-y-2.5 sm:space-y-1.5 transition-all shadow-sm"
                  >
                    {/* Mobile Card Header */}
                    <div className="flex sm:hidden items-center justify-between pb-1 border-b border-white/5">
                      <span className="text-xs font-bold text-slate-300">Regel #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                        title="Regel verwijderen"
                        aria-label="Verwijder regel"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Responsive Grid - Exactly ONE set of inputs registered with RHF */}
                    <div className="grid grid-cols-12 sm:grid-cols-[1fr_85px_115px_125px_36px] gap-2.5 items-center">
                      {/* Description */}
                      <div className="col-span-12 sm:col-auto">
                        <label className="text-[10px] text-slate-400 mb-1 block sm:hidden">Omschrijving</label>
                        <input
                          className="input text-xs w-full"
                          placeholder="Omschrijving dienst of product"
                          {...register(`line_items.${idx}.description`)}
                        />
                      </div>

                      {/* Quantity */}
                      <div className="col-span-4 sm:col-auto">
                        <label className="text-[10px] text-slate-400 mb-1 block sm:hidden">Aantal</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="input text-xs text-right font-mono w-full"
                          {...register(`line_items.${idx}.quantity`, { valueAsNumber: true })}
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-4 sm:col-auto">
                        <label className="text-[10px] text-slate-400 mb-1 block sm:hidden truncate">
                          {mode === 'EXCLUSIVE' ? 'Prijs excl.' : 'Prijs incl.'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input text-xs text-right font-mono w-full"
                          {...register(`line_items.${idx}.unit_price`, { valueAsNumber: true })}
                        />
                      </div>

                      {/* VAT Rate */}
                      <div className="col-span-4 sm:col-auto">
                        <label className="text-[10px] text-slate-400 mb-1 block sm:hidden">Btw</label>
                        <select className="select text-xs w-full" {...register(`line_items.${idx}.vat_rate`)}>
                          {VAT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Desktop Delete button */}
                      <div className="hidden sm:flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          disabled={fields.length === 1}
                          className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-30 flex items-center justify-center cursor-pointer"
                          title="Regel verwijderen"
                          aria-label="Verwijder regel"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Line totals */}
                    <div className="flex justify-between sm:justify-end items-center gap-3 text-[11px] font-mono text-slate-400 pt-1 border-t sm:border-0 border-white/5 sm:pt-0 sm:pr-8">
                      <span>Excl: {fmt.currency(excl)}</span>
                      <span>Btw: {fmt.currency(vat)}</span>
                      <span className="text-brand-400 font-semibold">Totaal: {fmt.currency(incl)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, vat_rate: '21', sort_order: fields.length })}
              className="btn-ghost btn-sm w-full border border-dashed border-slate-700 hover:border-slate-500 text-xs py-2 mt-3"
            >
              <Plus size={14} /> Regel toevoegen
            </button>

            {/* Totals summary */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <div className="space-y-1.5 w-full sm:w-72 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotaal excl. btw</span>
                  <span className="font-mono text-slate-300">{fmt.currency(liveCalc.excl)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Totaal btw</span>
                  <span className="font-mono text-slate-300">{fmt.currency(liveCalc.vat)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-100 pt-1.5 border-t border-slate-800">
                  <span>Totaal te betalen</span>
                  <span className="font-mono text-brand-400">{fmt.currency(liveCalc.incl)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Reference */}
          <div className="liquid-glass-card p-3.5 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0 text-xs font-semibold text-slate-200">
                  Betalingskenmerk (SEPA ISO 11649)
                </label>
                {isValidRfReference(watchedPaymentRef) ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium flex items-center gap-1 shadow-sm">
                    <CheckCircle size={10} /> Geldig Modulo 97 (Auto-match)
                  </span>
                ) : watchedPaymentRef ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                    Aangepast kenmerk
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30 font-medium">
                    Auto-gegenereerd
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  className="input text-xs sm:text-sm font-mono tracking-wider font-semibold pr-20 bg-slate-900/90 border-slate-700/80 focus:border-brand-500"
                  placeholder="bijv. RF18 2026 0001"
                  {...register('payment_reference', {
                    onChange: () => setUserEditedPaymentRef(true),
                  })}
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const ref = watchedPaymentRef || generateRfReference(invoiceNumber)
                      navigator.clipboard.writeText(ref)
                      setCopiedRef(true)
                      triggerHaptic('success')
                      toast.success('Betalingskenmerk gekopieerd!')
                      setTimeout(() => setCopiedRef(false), 2000)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Kopieer betalingskenmerk"
                  >
                    {copiedRef ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateRfReference(invoiceNumber)
                      setValue('payment_reference', generated, { shouldValidate: true })
                      setUserEditedPaymentRef(false)
                      triggerHaptic('selection')
                      toast.success(`Betalingskenmerk opnieuw berekend: ${generated}`)
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-slate-800 transition-colors"
                    title="Herbereken automatisch volgens ISO 11649 Modulo 97"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                SEPA-standaard voor bankafschriften (bunq, Rabobank, ING, ABN AMRO). Betalingen worden automatisch gekoppeld en op 'Betaald' gezet.
              </p>
            </div>
            <div>
              <label className="label">Notitie (op factuur)</label>
              <textarea className="textarea text-xs sm:text-sm" rows={2} placeholder="Optionele toelichting..." {...register('notes')} />
            </div>
          </div>
        </div>

        {/* PDF Preview pane */}
        {showPreview && isEdit && (
          <div className="liquid-glass-card p-0 overflow-hidden h-[550px] sm:h-[700px] border border-slate-800">
            <div className="bg-slate-850 px-4 py-2 text-xs text-slate-300 flex items-center justify-between border-b border-slate-800">
              <span className="flex items-center gap-2">
                <Eye size={13} className="text-brand-400" /> PDF Preview — {existing?.invoice_number}
              </span>
              <a
                href={invoicesApi.pdfUrl(id!)}
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <Download size={12} /> Openen
              </a>
            </div>
            <iframe
              src={invoicesApi.pdfUrl(id!)}
              className="w-full h-full border-0 bg-white"
              title="PDF Preview"
            />
          </div>
        )}
      </div>

      {/* In-browser vector PDF / Print Modal */}
      {showPrintModal && (
        <InvoicePrintModal
          invoice={currentInvoice}
          client={selectedClient}
          settings={settings}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Send Invoice by Email Modal */}
      <SendInvoiceModal
        invoice={currentInvoice}
        client={selectedClient}
        settings={settings}
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['invoices'] })
          if (id) qc.invalidateQueries({ queryKey: ['invoice', id] })
        }}
      />

      {/* Quick Add Client Modal */}
      <QuickClientModal
        isOpen={showQuickClientModal}
        onClose={() => setShowQuickClientModal(false)}
        onClientCreated={(newClient) => {
          qc.invalidateQueries({ queryKey: ['clients'] })
          setValue('client_id', newClient.id, { shouldValidate: true })
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Factuur definitief verwijderen"
        description={
          <span>
            Weet u zeker dat u factuur <strong className="text-slate-200">{existing?.invoice_number}</strong> definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
          </span>
        }
        confirmLabel="Factuur wissen"
        cancelLabel="Annuleren"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

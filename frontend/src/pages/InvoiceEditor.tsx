import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { Plus, Trash2, Save, Send, Download, Eye, EyeOff, ChevronDown, RefreshCw, ArrowLeft, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesApi, clientsApi, settingsApi, fmt } from '@/lib/api'
import { Client, Invoice, LineItem, BusinessSettings } from '@/lib/types'
import InvoicePrintModal from '@/components/InvoicePrintModal'
import { sendInvoiceViaResend, generateMailtoUrl, isResendConfigured } from '@/lib/email'

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
  const q = Number(row.quantity) || 0
  const p = Number(row.unit_price) || 0
  const r = row.vat_rate === 'REVERSE_CHARGE' ? 0 : (Number(row.vat_rate) || 0) / 100
  if (mode === 'EXCLUSIVE') {
    const excl = q * p
    const vat = excl * r
    return { excl, vat, incl: excl + vat }
  } else {
    const incl = q * p
    const excl = r === 0 ? incl : incl / (1 + r)
    const vat = incl - excl
    return { excl, vat, incl }
  }
}

export default function InvoiceEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const isEdit = Boolean(id)
  const [showPreview, setShowPreview] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [liveCalc, setLiveCalc] = useState({ excl: 0, vat: 0, incl: 0 })

  const { data: settings } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: clientsApi.list,
  })
  const { data: existing } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id!),
    enabled: isEdit,
  })

  const today = new Date().toISOString().slice(0, 10)
  const due14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)

  const { register, control, watch, setValue, handleSubmit, reset } = useForm<FormData>({
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
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      nav('/invoices')
    },
    onError: () => toast.error('Verwijderen mislukt'),
  })

  const handleDelete = () => {
    if (window.confirm(`Weet u zeker dat u factuur "${existing?.invoice_number}" definitief wilt verwijderen?`)) {
      deleteMutation.mutate()
    }
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

  const onSubmit = (data: FormData) => saveMutation.mutate(data)

  const selectedClient = clients.find(c => c.id === selectedClientId)

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl">
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
          {isEdit && existing && (
            <>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 text-brand-400 border-brand-500/30"
                title="Afdrukken of opslaan als PDF"
              >
                <Download size={14} /> <span className="hidden xs:inline">PDF / Afdrukken</span>
              </button>
              <button
                type="button"
                onClick={handleSendInvoice}
                className="btn-secondary text-xs sm:text-sm py-1.5 px-2.5 sm:px-3 text-emerald-400 border-emerald-500/30"
                disabled={isSendingEmail}
              >
                <Send size={14} /> {isSendingEmail ? 'Verzenden...' : 'Verzenden'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-1.5 px-2.5 border border-red-500/20"
                title="Factuur verwijderen"
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={14} /> <span className="hidden xs:inline">{deleteMutation.isPending ? 'Wissen...' : 'Verwijderen'}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="btn-primary text-xs sm:text-sm py-1.5 px-3.5 ml-auto sm:ml-0"
            disabled={saveMutation.isPending}
          >
            <Save size={14} /> {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      <div className={`grid gap-4 sm:gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor form */}
        <div className="space-y-4">
          {/* Client + Dates */}
          <div className="card p-3.5 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Klant *</label>
                <select className="select text-xs sm:text-sm" {...register('client_id', { required: true })}>
                  <option value="">— Selecteer klant —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
          <div className="card p-3.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-200">Regelitems</h2>
            </div>

            {/* Responsive Line Items Container */}
            <div className="overflow-x-auto -mx-3.5 sm:mx-0 px-3.5 sm:px-0">
              <div className="min-w-[580px] space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_80px_110px_120px_40px] gap-2 px-1 text-xs text-slate-400 font-medium">
                  <span>Omschrijving</span>
                  <span>Aantal</span>
                  <span>{mode === 'EXCLUSIVE' ? 'Prijs excl.' : 'Prijs incl.'}</span>
                  <span>Btw-tarief</span>
                  <span />
                </div>

                {fields.map((field, idx) => {
                  const row = watchedItems?.[idx]
                  const { excl, vat, incl } = row ? calcLine(row, mode) : { excl: 0, vat: 0, incl: 0 }
                  return (
                    <div key={field.id} className="p-2 bg-slate-950/40 rounded-lg border border-slate-800/80 space-y-1.5">
                      <div className="grid grid-cols-[1fr_80px_110px_120px_40px] gap-2 items-center">
                        <input
                          className="input text-xs"
                          placeholder="Omschrijving dienst of product"
                          {...register(`line_items.${idx}.description`)}
                        />
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="input text-xs text-right font-mono"
                          {...register(`line_items.${idx}.quantity`, { valueAsNumber: true })}
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input text-xs text-right font-mono"
                          {...register(`line_items.${idx}.unit_price`, { valueAsNumber: true })}
                        />
                        <select className="select text-xs" {...register(`line_items.${idx}.vat_rate`)}>
                          {VAT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="p-2 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                          disabled={fields.length === 1}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Line totals */}
                      <div className="flex justify-end gap-3 text-[11px] font-mono text-slate-400 pr-10">
                        <span>Excl: {fmt.currency(excl)}</span>
                        <span>Btw: {fmt.currency(vat)}</span>
                        <span className="text-brand-400 font-semibold">Totaal: {fmt.currency(incl)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
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
          <div className="card p-3.5 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="label">Betalingskenmerk</label>
              <input className="input text-xs sm:text-sm" placeholder="bijv. RF82 2026 0001" {...register('payment_reference')} />
            </div>
            <div>
              <label className="label">Notitie (op factuur)</label>
              <textarea className="textarea text-xs sm:text-sm" rows={2} placeholder="Optionele toelichting..." {...register('notes')} />
            </div>
          </div>
        </div>

        {/* PDF Preview pane */}
        {showPreview && isEdit && (
          <div className="card p-0 overflow-hidden h-[550px] sm:h-[700px] border border-slate-800">
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
      {showPrintModal && existing && (
        <InvoicePrintModal
          invoice={existing}
          settings={settings}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  )
}

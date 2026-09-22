import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import {
  Plus, Trash2, Save, Send, Eye, ArrowLeft,
  Calendar, FileCheck, CheckCircle2, Copy
} from 'lucide-react'
import toast from 'react-hot-toast'
import { quotationsApi, clientsApi, settingsApi, fmt } from '@/lib/api'
import { Client, Quotation, BusinessSettings } from '@/lib/types'
import QuotationPrintModal from '@/components/QuotationPrintModal'
import { clsx } from 'clsx'

interface LineItemRow {
  description: string
  quantity: number
  unit_price: number
  vat_rate: string
  sort_order: number
}

interface FormData {
  quotation_number: string
  client_id: string
  issue_date: string
  valid_until_date: string
  calculation_mode: 'EXCLUSIVE' | 'INCLUSIVE'
  notes: string
  disclaimer: string
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

export default function QuotationEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const isEdit = Boolean(id)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [liveCalc, setLiveCalc] = useState({ excl: 0, vat: 0, incl: 0 })

  const { data: settings } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const { data: existing } = useQuery<Quotation>({
    queryKey: ['quotation', id],
    queryFn: () => quotationsApi.get(id!),
    enabled: isEdit,
  })

  const today = new Date().toISOString().slice(0, 10)
  const valid30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)

  const { register, control, watch, setValue, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      quotation_number: `OFF-2026-${Math.floor(100 + Math.random() * 900)}`,
      client_id: '',
      issue_date: today,
      valid_until_date: valid30,
      calculation_mode: 'EXCLUSIVE',
      notes: '',
      disclaimer: 'Deze offerte is 30 dagen geldig na dagtekening. Na akkoord start het project binnen 2 weken.',
      line_items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: '21', sort_order: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })
  const watchedItems = watch('line_items')
  const watchedMode = watch('calculation_mode')
  const watchedClientId = watch('client_id')
  const selectedClient = clients.find((c) => c.id === watchedClientId)

  // Populate on edit
  useEffect(() => {
    if (existing) {
      reset({
        quotation_number: existing.quotation_number,
        client_id: existing.client_id || '',
        issue_date: existing.issue_date,
        valid_until_date: existing.valid_until_date,
        calculation_mode: existing.calculation_mode || 'EXCLUSIVE',
        notes: existing.notes || '',
        disclaimer: existing.disclaimer || '',
        line_items: existing.line_items?.length
          ? existing.line_items.map((it, idx) => ({
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
              vat_rate: String(it.vat_rate),
              sort_order: idx,
            }))
          : [{ description: '', quantity: 1, unit_price: 0, vat_rate: '21', sort_order: 0 }],
      })
    }
  }, [existing, reset])

  // Recalculate totals live
  useEffect(() => {
    let excl = 0
    let vat = 0
    watchedItems.forEach((row) => {
      const c = calcLine(row, watchedMode)
      excl += c.excl
      vat += c.vat
    })
    setLiveCalc({
      excl: Math.round(excl * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      incl: Math.round((excl + vat) * 100) / 100,
    })
  }, [watchedItems, watchedMode])

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: (data: any) => (isEdit ? quotationsApi.update(id!, data) : quotationsApi.create(data)),
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Offerte bijgewerkt!' : 'Offerte succesvol aangemaakt!')
      qc.invalidateQueries({ queryKey: ['quotations'] })
      if (!isEdit && saved?.id) {
        nav(`/quotations/${saved.id}/edit`, { replace: true })
      }
    },
    onError: (err: any) => toast.error(err.message || 'Fout bij opslaan offerte'),
  })

  const onSubmit = (formData: FormData, targetStatus?: string) => {
    if (!formData.client_id) {
      toast.error('Selecteer eerst een klant')
      return
    }

    const payload = {
      ...formData,
      status: targetStatus || (existing?.status ?? 'DRAFT'),
      subtotal_excl: liveCalc.excl,
      total_vat: liveCalc.vat,
      total_amount: liveCalc.incl,
      line_items: formData.line_items.map((it, idx) => {
        const c = calcLine(it, formData.calculation_mode)
        return {
          id: `item-${idx}`,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          vat_rate: it.vat_rate,
          vat_amount: c.vat,
          line_total_excl: c.excl,
          line_total_incl: c.incl,
          sort_order: idx,
        }
      }),
    }

    saveMutation.mutate(payload)
  }

  // Quick validity buttons
  const setValidityDays = (days: number) => {
    const d = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
    setValue('valid_until_date', d)
  }

  // Build temporary quotation object for preview
  const previewQuotation: Quotation = {
    id: id || 'preview',
    quotation_number: watch('quotation_number') || 'OFF-2026-PREVIEW',
    client_id: watchedClientId,
    client: selectedClient,
    issue_date: watch('issue_date'),
    valid_until_date: watch('valid_until_date'),
    status: existing?.status || 'DRAFT',
    calculation_mode: watchedMode,
    subtotal_excl: liveCalc.excl,
    total_vat: liveCalc.vat,
    total_amount: liveCalc.incl,
    notes: watch('notes'),
    disclaimer: watch('disclaimer'),
    signature_data_url: existing?.signature_data_url,
    signed_by_name: existing?.signed_by_name,
    signed_at: existing?.signed_at,
    line_items: watchedItems.map((it, idx) => {
      const c = calcLine(it, watchedMode)
      return {
        id: `preview-${idx}`,
        description: it.description || `Item ${idx + 1}`,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        vat_rate: it.vat_rate as any,
        vat_amount: c.vat,
        line_total_excl: c.excl,
        line_total_incl: c.incl,
        sort_order: idx,
      }
    }),
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <div className="space-y-6 w-full animate-fade-in pb-16">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => nav('/quotations')}
            className="btn-ghost p-2 rounded-xl text-slate-400 hover:text-white"
            aria-label="Terug"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <FileCheck size={22} className="text-brand-400" />
              <span>{isEdit ? `Offerte ${existing?.quotation_number}` : 'Nieuwe Offerte'}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Stel een professioneel voorstel op en stuur een directe digitale ondertekenlink
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Eye size={15} />
            <span>Voorbeeld & Print</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit((d) => onSubmit(d, 'DRAFT'))}
            disabled={saveMutation.isPending}
            className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Save size={15} />
            <span>Opslaan Concept</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit((d) => onSubmit(d, 'SENT'))}
            disabled={saveMutation.isPending}
            className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
          >
            <Send size={15} />
            <span>Verzenden & Activeer Link</span>
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit((d) => onSubmit(d))} className="space-y-6">
        {/* Top Details Card */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Client Select */}
            <div className="sm:col-span-2">
              <label className="label">Klant / Opdrachtgever *</label>
              <select
                {...register('client_id', { required: true })}
                className="select"
              >
                <option value="">-- Kies een relatie --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.contact_person ? `(${c.contact_person})` : ''}
                  </option>
                ))}
              </select>
              {selectedClient && (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-0.5">
                  <div className="font-semibold text-slate-200">{selectedClient.name}</div>
                  <div>{selectedClient.billing_address_street}, {selectedClient.billing_address_city}</div>
                  {selectedClient.vat_number && <div>Btw: {selectedClient.vat_number}</div>}
                </div>
              )}
            </div>

            {/* Quotation Number */}
            <div>
              <label className="label">Offertenummer *</label>
              <input
                type="text"
                {...register('quotation_number', { required: true })}
                className="input font-mono"
              />
            </div>

            {/* Calculation Mode */}
            <div>
              <label className="label">Prijzen Invoer</label>
              <select {...register('calculation_mode')} className="select">
                <option value="EXCLUSIVE">Exclusief btw (Standaard)</option>
                <option value="INCLUSIVE">Inclusief btw</option>
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label className="label">Offertedatum *</label>
              <input type="date" {...register('issue_date', { required: true })} className="input" />
            </div>

            {/* Valid Until Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Geldig tot *</label>
                <div className="flex gap-1 text-[10px]">
                  <button type="button" onClick={() => setValidityDays(14)} className="text-brand-400 hover:underline">
                    +14d
                  </button>
                  <span className="text-slate-600">•</span>
                  <button type="button" onClick={() => setValidityDays(30)} className="text-brand-400 hover:underline">
                    +30d
                  </button>
                </div>
              </div>
              <input type="date" {...register('valid_until_date', { required: true })} className="input" />
            </div>
          </div>
        </div>

        {/* Line Items Card */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Offerte Regels</span>
              <span className="text-xs font-normal text-slate-400">({fields.length} regels)</span>
            </h2>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => {
              const row = watchedItems[idx] || {}
              const c = calcLine(row as any, watchedMode)

              return (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 items-center"
                >
                  {/* Description */}
                  <div className="col-span-12 sm:col-span-5">
                    <label className="label text-[10px] sm:hidden">Omschrijving</label>
                    <input
                      type="text"
                      placeholder="Bijv. Webdesign & UX Concept"
                      {...register(`line_items.${idx}.description` as const, { required: true })}
                      className="input text-xs"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label text-[10px] sm:hidden">Aantal</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="1"
                      {...register(`line_items.${idx}.quantity` as const, { required: true, min: 0.01 })}
                      className="input text-xs text-right font-mono"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label text-[10px] sm:hidden">Prijs (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register(`line_items.${idx}.unit_price` as const, { required: true })}
                      className="input text-xs text-right font-mono"
                    />
                  </div>

                  {/* VAT Rate */}
                  <div className="col-span-3 sm:col-span-2">
                    <label className="label text-[10px] sm:hidden">Btw</label>
                    <select
                      {...register(`line_items.${idx}.vat_rate` as const)}
                      className="select text-xs py-2"
                    >
                      {VAT_OPTIONS.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="col-span-1 sm:col-span-1 flex items-center justify-end gap-1.5">
                    <span className="hidden lg:inline text-xs font-mono font-bold text-slate-300">
                      {fmt.currency(c.excl)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={fields.length === 1}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30"
                      aria-label="Verwijder regel"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => append({ description: '', quantity: 1, unit_price: 0, vat_rate: '21', sort_order: fields.length })}
            className="btn-ghost text-xs text-brand-400 hover:bg-brand-500/10 flex items-center gap-1.5 mt-2"
          >
            <Plus size={14} />
            <span>Regel toevoegen</span>
          </button>
        </div>

        {/* Bottom Section: Notes & Summary Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Notes & Terms */}
          <div className="lg:col-span-7 card p-5 space-y-4">
            <div>
              <label className="label">Projectomschrijving & Toelichting</label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Geef een korte toelichting op de scope, fasering of uitgangspunten van dit voorstel..."
                className="textarea text-xs"
              />
            </div>

            <div>
              <label className="label">Geldigheid & Offertevoorwaarden</label>
              <textarea
                {...register('disclaimer')}
                rows={2}
                placeholder="Bijv. Deze offerte is 30 dagen geldig na dagtekening..."
                className="textarea text-xs"
              />
            </div>
          </div>

          {/* Financial Totals Card */}
          <div className="lg:col-span-5 card p-5 flex flex-col justify-between space-y-3 bg-slate-900 border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              Financieel Overzicht
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotaal (excl. btw):</span>
                <span className="font-mono font-semibold text-slate-200">{fmt.currency(liveCalc.excl)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Btw-bedrag:</span>
                <span className="font-mono font-semibold text-slate-200">{fmt.currency(liveCalc.vat)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-100 pt-3 border-t border-slate-800">
                <span>Totaalbedrag:</span>
                <span className="font-mono text-brand-400">{fmt.currency(liveCalc.incl)}</span>
              </div>
            </div>

            {/* Public Link Generator / Quick Copy */}
            {isEdit && (
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Publieke Ondertekenlink voor Klant:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/quote/review/${id}`
                      navigator.clipboard.writeText(url)
                      toast.success('Link gekopieerd!')
                    }}
                    className="text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <Copy size={12} />
                    <span>Kopiëren</span>
                  </button>
                </div>
                <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 truncate">
                  {`${window.location.origin}/quote/review/${id}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Print / Preview Modal */}
      {showPrintModal && (
        <QuotationPrintModal
          quotation={previewQuotation}
          settings={settings}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  )
}

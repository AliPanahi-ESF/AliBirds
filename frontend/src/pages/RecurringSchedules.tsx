import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Play, RefreshCw, Calendar, X, Edit2, FileText, Check, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { useNavigate } from 'react-router-dom'
import { recurringApi, clientsApi, fmt } from '@/lib/api'
import { Client, RecurringSchedule, RecurringLineItemTemplate } from '@/lib/types'
import ConfirmDialog from '@/components/ConfirmDialog'
import { TableRowSkeleton } from '@/components/TableSkeleton'
import { triggerHaptic } from '@/lib/haptics'
import { useI18n } from '@/lib/i18n'

interface ScheduleForm {
  name: string
  client_id: string
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  next_run_date: string
  payment_term_days: number
  auto_send_email: boolean
  calculation_mode: 'EXCLUSIVE' | 'INCLUSIVE'
  notes_template: string
  line_items_template: RecurringLineItemTemplate[]
}

export default function RecurringSchedules() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { t } = useI18n()
  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<RecurringSchedule | null>(null)
  const [deletingSchedule, setDeletingSchedule] = useState<RecurringSchedule | null>(null)
  const [previewTotals, setPreviewTotals] = useState({ excl: 0, vat: 0, incl: 0 })
  const today = new Date().toISOString().slice(0, 10)

  const vatOptions = useMemo(() => [
    { value: '21', label: '21%' },
    { value: '9', label: '9%' },
    { value: '0', label: '0%' },
    { value: 'REVERSE_CHARGE', label: `${t('inv.vat_reverse', 'Btw Verlegd')} (0%)` },
  ], [t])

  const freqLabels: Record<string, string> = useMemo(() => ({
    WEEKLY: t('recurring.freq_weekly', 'Wekelijks'),
    MONTHLY: t('recurring.freq_monthly', 'Maandelijks'),
    QUARTERLY: t('recurring.freq_quarterly', 'Per kwartaal'),
    YEARLY: t('recurring.freq_yearly', 'Jaarlijks'),
  }), [t])

  const { data: schedules = [], isLoading } = useQuery<RecurringSchedule[]>({
    queryKey: ['recurring'],
    queryFn: recurringApi.list,
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const { register, control, handleSubmit, reset, watch } = useForm<ScheduleForm>({
    defaultValues: {
      name: '',
      client_id: '',
      frequency: 'MONTHLY',
      next_run_date: today,
      auto_send_email: false,
      calculation_mode: 'EXCLUSIVE',
      payment_term_days: 14,
      notes_template: '',
      line_items_template: [
        { description: 'Periodieke werkzaamheden & ondersteuning', quantity: 1, unit_price: 250, vat_rate: '21' }
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items_template',
  })

  const watchedItems = watch('line_items_template') || []
  const formSubtotal = watchedItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  )

  const openNewForm = () => {
    setEditingSchedule(null)
    reset({
      name: '',
      client_id: clients[0]?.id || '',
      frequency: 'MONTHLY',
      next_run_date: today,
      auto_send_email: false,
      calculation_mode: 'EXCLUSIVE',
      payment_term_days: 14,
      notes_template: '',
      line_items_template: [
        { description: 'Periodieke werkzaamheden & ondersteuning', quantity: 1, unit_price: 250, vat_rate: '21' }
      ],
    })
    setShowForm(true)
  }

  const openEditForm = (sched: RecurringSchedule) => {
    setEditingSchedule(sched)
    reset({
      name: sched.name,
      client_id: sched.client_id,
      frequency: sched.frequency,
      next_run_date: sched.next_run_date,
      auto_send_email: sched.auto_send_email,
      calculation_mode: sched.calculation_mode || 'EXCLUSIVE',
      payment_term_days: sched.payment_term_days,
      notes_template: sched.notes_template || '',
      line_items_template: (sched.line_items_template && sched.line_items_template.length > 0)
        ? sched.line_items_template
        : [{ description: sched.name, quantity: 1, unit_price: 250, vat_rate: '21' }],
    })
    setShowForm(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data: ScheduleForm) => {
      if (editingSchedule) {
        return recurringApi.update(editingSchedule.id, data)
      }
      return recurringApi.create(data)
    },
    onSuccess: () => {
      triggerHaptic('success')
      toast.success(editingSchedule ? t('recurring.toast_updated', 'Herhaalschema bijgewerkt') : t('recurring.toast_created', 'Herhaalschema succesvol aangemaakt'))
      qc.invalidateQueries({ queryKey: ['recurring'] })
      setShowForm(false)
      setEditingSchedule(null)
    },
    onError: () => {
      triggerHaptic('warning')
      toast.error(t('clients.toast_save_err', 'Opslaan mislukt'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: recurringApi.delete,
    onSuccess: () => {
      triggerHaptic('success')
      toast.success(t('recurring.toast_deleted', 'Herhaalschema verwijderd'))
      setDeletingSchedule(null)
      qc.invalidateQueries({ queryKey: ['recurring'] })
    },
    onError: () => {
      triggerHaptic('warning')
      toast.error(t('clients.toast_del_err', 'Verwijderen mislukt'))
    },
  })

  const triggerMutation = useMutation({
    mutationFn: recurringApi.trigger,
    onSuccess: (res: any) => {
      triggerHaptic('success')
      toast.success(`${t('inv.title', 'Factuur')} ${res.invoice_number} ${t('recurring.toast_generated', 'succesvol gegenereerd!')}`, { icon: '📄', duration: 5000 })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['recurring'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
    onError: () => {
      triggerHaptic('warning')
      toast.error(t('recurring.toast_gen_failed', 'Factuur genereren mislukt'))
    },
  })

  const calcScheduleTotal = (sched: RecurringSchedule) => {
    return (sched.line_items_template || []).reduce(
      (sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
      0
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full m3-fade-through">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">{t('recurring.title', 'Herhaalfacturen')}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {t('recurring.subtitle', 'Automatisch periodieke facturen genereren voor abonnementen & retainers')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : openNewForm())}
          className="btn-primary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5 m3-state-layer shadow-md"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          <span>{showForm ? t('recurring.btn_close', 'Sluiten') : t('recurring.btn_new', 'Nieuw herhaalschema')}</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-4 sm:p-5 m3-fade-through border-brand-600/30">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
            <h2 className="text-sm font-semibold text-slate-200">
              {editingSchedule ? `${t('recurring.form_edit', 'Schema bewerken:')} ${editingSchedule.name}` : t('recurring.form_new', 'Nieuw herhaalschema configureren')}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-xs">{t('recurring.name_label', 'Naam schema *')}</label>
                <input
                  className="input text-xs sm:text-sm"
                  placeholder={t('recurring.name_placeholder', 'bijv. Maandelijkse hosting & onderhoud')}
                  {...register('name', { required: true })}
                />
              </div>

              <div>
                <label className="label text-xs">{t('recurring.client_label', 'Klant *')}</label>
                <select className="select text-xs sm:text-sm" {...register('client_id', { required: true })}>
                  <option key="none" value="">{t('recurring.select_client', '— Selecteer klant —')}</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs">{t('recurring.freq_label', 'Frequentie')}</label>
                <select className="select text-xs sm:text-sm" {...register('frequency')}>
                  <option value="WEEKLY">{freqLabels.WEEKLY}</option>
                  <option value="MONTHLY">{freqLabels.MONTHLY}</option>
                  <option value="QUARTERLY">{freqLabels.QUARTERLY}</option>
                  <option value="YEARLY">{freqLabels.YEARLY}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-xs">{t('recurring.next_date', 'Eerstvolgende factuurdatum')}</label>
                <input type="date" className="input text-xs sm:text-sm" {...register('next_run_date')} />
              </div>

              <div>
                <label className="label text-xs">{t('recurring.term_label', 'Betaaltermijn (dagen)')}</label>
                <input
                  type="number"
                  className="input text-xs sm:text-sm"
                  {...register('payment_term_days', { valueAsNumber: true })}
                />
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-brand-500 w-4 h-4 rounded"
                    {...register('auto_send_email')}
                  />
                  <span className="text-xs text-slate-300">{t('recurring.auto_send_label', 'Factuur direct per e-mail verzenden')}</span>
                </label>
              </div>
            </div>

            {/* Line Items Template */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="label text-xs font-semibold text-slate-300">
                  {t('recurring.line_items_label', 'Factuurregels (wat wordt er periodiek gefactureerd)')}
                </label>
                <button
                  type="button"
                  onClick={() => append({ description: '', quantity: 1, unit_price: 100, vat_rate: '21' })}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium"
                >
                  <Plus size={13} /> <span>{t('recurring.add_line', 'Regel toevoegen')}</span>
                </button>
              </div>

              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                    <div className="col-span-12 sm:col-span-6">
                      <input
                        className="input text-xs"
                        placeholder={t('recurring.item_desc', 'Omschrijving dienst of product...')}
                        {...register(`line_items_template.${idx}.description` as const, { required: true })}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        step="0.1"
                        className="input text-xs text-center"
                        placeholder={t('recurring.item_qty', 'Aantal')}
                        {...register(`line_items_template.${idx}.quantity` as const, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        className="input text-xs font-mono text-right"
                        placeholder={t('recurring.item_price', 'Prijs excl.')}
                        {...register(`line_items_template.${idx}.unit_price` as const, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <select
                        className="select text-xs p-1.5"
                        {...register(`line_items_template.${idx}.vat_rate` as const)}
                      >
                        {vatOptions.map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => fields.length > 1 && remove(idx)}
                        disabled={fields.length <= 1}
                        className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-30"
                        title="Verwijder regel"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-right text-xs text-slate-400 pt-1">
                {t('recurring.total_per_period', 'Totaal excl. btw per periode:')} <strong className="text-white font-mono">{fmt.currency(formSubtotal)}</strong>
              </div>
            </div>

            <div>
              <label className="label text-xs">{t('recurring.notes_label', 'Vaste toelichting / notities op de factuur')}</label>
              <input
                className="input text-xs sm:text-sm"
                placeholder={t('recurring.notes_placeholder', 'bijv. Vaste maandelijkse SLA vergoeding...')}
                {...register('notes_template')}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary text-xs sm:text-sm py-2 px-3 m3-state-layer"
              >
                <span>{t('recurring.cancel', 'Annuleren')}</span>
              </button>
              <button
                type="submit"
                className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5 m3-state-layer shadow-md"
                disabled={saveMutation.isPending}
              >
                <Check size={14} />
                <span>{saveMutation.isPending ? t('recurring.saving', 'Opslaan...') : t('recurring.save_btn', 'Herhaalschema opslaan')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <div className="card text-center py-10 text-xs text-slate-500">{t('recurring.loading', 'Schema\'s laden...')}</div>
        ) : schedules.length === 0 ? (
          <div className="card text-center py-10 text-xs text-slate-500">{t('recurring.empty', 'Nog geen herhaalschema\'s')}</div>
        ) : (
          schedules.map((sched: RecurringSchedule) => {
            const isDue = sched.next_run_date <= today
            const total = calcScheduleTotal(sched)
            return (
              <div key={sched.id} className="card p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-slate-100">{sched.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {sched.client?.name ?? '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="badge-blue text-[10px]">{freqLabels[sched.frequency] ?? sched.frequency}</span>
                    <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
                      {fmt.currency(total)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800 text-slate-400">
                  <div className={clsx('flex items-center gap-1.5', isDue && 'text-amber-400 font-medium')}>
                    <Calendar size={13} />
                    <span>{t('recurring.th_next', 'Volgende')}: {sched.next_run_date}</span>
                    {isDue && <span className="badge-yellow text-[9px]">{t('recurring.today', 'Vandaag')}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => triggerMutation.mutate(sched.id)}
                      className="btn-secondary text-[11px] py-1 px-2 text-emerald-400 border-emerald-500/30 flex items-center gap-1 m3-state-layer"
                      title={t('recurring.generate_now', 'Nu genereren')}
                      disabled={triggerMutation.isPending}
                    >
                      <Play size={12} />
                      <span>{t('recurring.generate_now', 'Nu genereren')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(sched)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white m3-state-layer"
                      title={t('recurring.edit', 'Schema bewerken')}
                      aria-label={`${t('recurring.edit', 'Schema bewerken')} ${sched.name}`}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSchedule(sched)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 m3-state-layer"
                      title={t('recurring.delete', 'Schema verwijderen')}
                      aria-label={`${t('recurring.delete', 'Schema verwijderen')} ${sched.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Schedules table (>= md) */}
      <div className="hidden md:block table-wrapper bg-slate-900">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-3.5 font-medium">{t('recurring.th_name', 'Naam schema')}</th>
              <th className="p-3.5 font-medium">{t('recurring.th_client', 'Klant')}</th>
              <th className="p-3.5 font-medium">{t('recurring.th_freq', 'Frequentie')}</th>
              <th className="p-3.5 font-medium text-right">{t('recurring.th_amount', 'Bedrag excl.')}</th>
              <th className="p-3.5 font-medium">{t('recurring.th_next', 'Volgende datum')}</th>
              <th className="p-3.5 font-medium text-center">{t('recurring.th_autosend', 'Auto-send')}</th>
              <th className="p-3.5 text-right font-medium">{t('recurring.th_actions', 'Acties')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <TableRowSkeleton cols={7} rows={5} />
            ) : schedules.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">{t('recurring.empty', 'Nog geen herhaalschema\'s')}</td></tr>
            ) : schedules.map((sched: RecurringSchedule) => {
              const isDue = sched.next_run_date <= today
              const total = calcScheduleTotal(sched)
              return (
                <tr key={sched.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3.5 font-medium text-slate-100">
                    <div>{sched.name}</div>
                    {sched.notes_template && (
                      <div className="text-xs text-slate-500 truncate max-w-xs">{sched.notes_template}</div>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-300 font-medium">
                    {sched.client?.name ?? '—'}
                  </td>
                  <td className="p-3.5">
                    <span className="badge-blue">{freqLabels[sched.frequency] ?? sched.frequency}</span>
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                    {fmt.currency(total)}
                  </td>
                  <td className="p-3.5">
                    <div className={clsx('flex items-center gap-1.5', isDue && 'text-amber-400 font-medium')}>
                      <Calendar size={13} />
                      <span>{sched.next_run_date}</span>
                      {isDue && <span className="badge-yellow ml-1 text-[10px]">{t('recurring.today', 'Vandaag')}</span>}
                    </div>
                  </td>
                  <td className="p-3.5 text-center">
                    {sched.auto_send_email ? (
                      <span className="badge-green text-xs">E-mail</span>
                    ) : (
                      <span className="badge-gray text-xs">Concept</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex gap-1.5 justify-end items-center">
                      <button
                        type="button"
                        onClick={() => triggerMutation.mutate(sched.id)}
                        className="btn-secondary text-xs py-1 px-2.5 text-emerald-400 border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-950/30 m3-state-layer"
                        title={t('recurring.generate_now', 'Factuur direct genereren')}
                        disabled={triggerMutation.isPending}
                      >
                        <Play size={12} />
                        <span>{t('recurring.generate_now', 'Nu genereren')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(sched)}
                        className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white m3-state-layer"
                        title={t('recurring.edit', 'Schema bewerken')}
                        aria-label={`${t('recurring.edit', 'Schema bewerken')} ${sched.name}`}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingSchedule(sched)}
                        className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 m3-state-layer"
                        title={t('recurring.delete', 'Schema verwijderen')}
                        aria-label={`${t('recurring.delete', 'Schema verwijderen')} ${sched.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recurring Schedule Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingSchedule)}
        title={t('recurring.confirm_del_title', 'Herhaalschema verwijderen')}
        description={
          <span>
            {t('recurring.confirm_del_desc', 'Weet u zeker dat u het herhaalschema wilt verwijderen? Reeds gegenereerde facturen blijven behouden.')}{' '}
            <strong className="text-slate-200">{deletingSchedule?.name}</strong>
          </span>
        }
        confirmLabel={t('recurring.confirm_del_btn', 'Schema wissen')}
        cancelLabel={t('recurring.cancel', 'Annuleren')}
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingSchedule) deleteMutation.mutate(deletingSchedule.id)
        }}
        onClose={() => setDeletingSchedule(null)}
      />
    </div>
  )
}

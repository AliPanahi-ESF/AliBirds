import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Play, RefreshCw, Calendar, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { recurringApi, clientsApi } from '@/lib/api'
import { Client } from '@/lib/types'

interface ScheduleForm {
  client_id: string
  name: string
  frequency: string
  next_run_date: string
  auto_send_email: boolean
  calculation_mode: string
  payment_term_days: number
  notes_template: string
}

export default function RecurringSchedules() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: recurringApi.list,
  })
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const { register, handleSubmit, reset } = useForm<ScheduleForm>({
    defaultValues: {
      client_id: '', name: '', frequency: 'MONTHLY',
      next_run_date: today, auto_send_email: false,
      calculation_mode: 'EXCLUSIVE', payment_term_days: 14, notes_template: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: ScheduleForm) => recurringApi.create({
      ...data,
      line_items_template: [],
      payment_term_days: Number(data.payment_term_days),
    }),
    onSuccess: () => {
      toast.success('Herhaalschema aangemaakt')
      qc.invalidateQueries({ queryKey: ['recurring'] })
      reset(); setShowForm(false)
    },
    onError: () => toast.error('Aanmaken mislukt'),
  })

  const deleteMutation = useMutation({
    mutationFn: recurringApi.delete,
    onSuccess: () => {
      toast.success('Schema verwijderd')
      qc.invalidateQueries({ queryKey: ['recurring'] })
    },
  })

  const triggerMutation = useMutation({
    mutationFn: recurringApi.trigger,
    onSuccess: (r) => {
      toast.success(`Factuur ${r.invoice_number ?? ''} aangemaakt`)
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: () => toast.error('Genereren mislukt'),
  })

  const FREQ_LABELS: Record<string, string> = { MONTHLY: 'Maandelijks', QUARTERLY: 'Kwartaal' }

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Herhaalfacturen</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Automatisch gegenereerde periodieke facturen</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs sm:text-sm py-2 px-3.5">
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Sluiten' : 'Nieuw schema'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-4 sm:p-5 animate-fade-in border-brand-600/30">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Nieuw herhaalschema configureren</h2>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Naam schema *</label>
                <input className="input text-xs sm:text-sm" placeholder="bijv. Maandelijkse retainer" {...register('name', { required: true })} />
              </div>
              <div>
                <label className="label">Klant *</label>
                <select className="select text-xs sm:text-sm" {...register('client_id', { required: true })}>
                  <option value="">— Selecteer klant —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Frequentie</label>
                <select className="select text-xs sm:text-sm" {...register('frequency')}>
                  <option value="MONTHLY">Maandelijks</option>
                  <option value="QUARTERLY">Per kwartaal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Eerstvolgende factuurdatum</label>
                <input type="date" className="input text-xs sm:text-sm" {...register('next_run_date')} />
              </div>
              <div>
                <label className="label">Betaaltermijn (dagen)</label>
                <input type="number" className="input text-xs sm:text-sm" {...register('payment_term_days', { valueAsNumber: true })} />
              </div>
              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-brand-500 w-4 h-4 rounded" {...register('auto_send_email')} />
                  <span className="text-xs sm:text-sm text-slate-300">Factuur direct e-mailen</span>
                </label>
              </div>
            </div>

            <div>
              <label className="label">Vaste toelichting op factuur</label>
              <input className="input text-xs sm:text-sm" placeholder="Optionele tekst voor onderaan de factuur..." {...register('notes_template')} />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs sm:text-sm py-2 px-3">Annuleren</button>
              <button type="submit" className="btn-primary text-xs sm:text-sm py-2 px-4" disabled={createMutation.isPending}>
                <RefreshCw size={13} /> Opslaan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <div className="card text-center py-10 text-xs text-slate-500">Schema's laden...</div>
        ) : schedules.length === 0 ? (
          <div className="card text-center py-10 text-xs text-slate-500">Nog geen herhaalschema's</div>
        ) : (
          schedules.map((sched: any) => {
            const isDue = sched.next_run_date <= today
            return (
              <div key={sched.id} className="card p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-slate-100">{sched.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{sched.client?.name ?? sched.client_id}</div>
                  </div>
                  <span className="badge-blue text-[10px]">{FREQ_LABELS[sched.frequency] ?? sched.frequency}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800 text-slate-400">
                  <div className={clsx('flex items-center gap-1.5', isDue && 'text-amber-400 font-medium')}>
                    <Calendar size={13} />
                    <span>Volgende: {sched.next_run_date}</span>
                    {isDue && <span className="badge-yellow text-[9px]">Vandaag</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => triggerMutation.mutate(sched.id)}
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10"
                      title="Nu uitvoeren"
                      disabled={triggerMutation.isPending}
                    >
                      <Play size={14} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(sched.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                      title="Verwijderen"
                    >
                      <Trash2 size={14} />
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
              <th className="p-3.5 font-medium">Naam</th>
              <th className="p-3.5 font-medium">Klant</th>
              <th className="p-3.5 font-medium">Frequentie</th>
              <th className="p-3.5 font-medium">Volgende datum</th>
              <th className="p-3.5 font-medium">Auto-send</th>
              <th className="p-3.5 font-medium">Status</th>
              <th className="p-3.5 text-right font-medium">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">Laden...</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">Nog geen herhaalschema's</td></tr>
            ) : schedules.map((sched: any) => {
              const isDue = sched.next_run_date <= today
              return (
                <tr key={sched.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3.5 font-medium text-slate-100">{sched.name}</td>
                  <td className="p-3.5 text-slate-400">{sched.client?.name ?? sched.client_id}</td>
                  <td className="p-3.5"><span className="badge-blue">{FREQ_LABELS[sched.frequency] ?? sched.frequency}</span></td>
                  <td className="p-3.5">
                    <div className={clsx('flex items-center gap-1.5', isDue && 'text-amber-400 font-medium')}>
                      <Calendar size={13} />
                      <span>{sched.next_run_date}</span>
                      {isDue && <span className="badge-yellow ml-1 text-[10px]">Vandaag</span>}
                    </div>
                  </td>
                  <td className="p-3.5">
                    {sched.auto_send_email
                      ? <span className="badge-green text-xs">Ja</span>
                      : <span className="badge-gray text-xs">Nee</span>}
                  </td>
                  <td className="p-3.5">
                    {sched.is_active
                      ? <span className="badge-green text-xs">Actief</span>
                      : <span className="badge-gray text-xs">Inactief</span>}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => triggerMutation.mutate(sched.id)}
                        className="btn-ghost p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300"
                        title="Nu uitvoeren"
                        disabled={triggerMutation.isPending}
                      >
                        <Play size={13} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(sched.id)}
                        className="btn-danger p-1.5 rounded-lg text-red-400"
                        title="Verwijderen"
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
    </div>
  )
}

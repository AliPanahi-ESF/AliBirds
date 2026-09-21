import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Save, Settings, Mail, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsApi } from '@/lib/api'
import { BusinessSettings } from '@/lib/types'
import { useEffect } from 'react'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })
  const { register, handleSubmit, reset } = useForm<Partial<BusinessSettings>>()

  useEffect(() => {
    if (settings) reset(settings)
  }, [settings, reset])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<BusinessSettings>) => settingsApi.update(data),
    onSuccess: () => {
      toast.success('Instellingen opgeslagen')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => toast.error('Opslaan mislukt'),
  })

  if (isLoading) return <div className="text-slate-500 text-xs py-8">Instellingen laden...</div>

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Instellingen</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Bedrijfsprofiel en factuurlay-out</p>
        </div>
        <button
          onClick={handleSubmit(d => saveMutation.mutate(d))}
          className="btn-primary text-xs sm:text-sm py-2 px-4 self-start sm:self-auto"
          disabled={saveMutation.isPending}
        >
          <Save size={14} /> {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>

      <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4 sm:space-y-5">
        {/* Company info */}
        <div className="card p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-slate-200">Bedrijfsgegevens</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Bedrijfsnaam (juridisch) *</label>
              <input className="input text-xs sm:text-sm" {...register('company_name')} />
            </div>
            <div>
              <label className="label">Handelsnaam</label>
              <input className="input text-xs sm:text-sm" {...register('trade_name')} />
            </div>
            <div>
              <label className="label">KVK-nummer</label>
              <input className="input text-xs sm:text-sm font-mono" placeholder="12345678" {...register('kvk_number')} />
            </div>
            <div>
              <label className="label">BTW-identificatienummer</label>
              <input className="input text-xs sm:text-sm font-mono" placeholder="NL123456789B01" {...register('btw_id')} />
            </div>
            <div>
              <label className="label">IBAN</label>
              <input className="input text-xs sm:text-sm font-mono" placeholder="NL91 BUNQ 2049 1827 41" {...register('iban')} />
            </div>
            <div>
              <label className="label">BIC / SWIFT</label>
              <input className="input text-xs sm:text-sm font-mono" placeholder="BUNQNL2A" {...register('bic')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="sm:col-span-2">
              <label className="label">Straat + huisnummer</label>
              <input className="input text-xs sm:text-sm" {...register('address_street')} />
            </div>
            <div>
              <label className="label">Postcode</label>
              <input className="input text-xs sm:text-sm" {...register('address_postcode')} />
            </div>
            <div>
              <label className="label">Plaats</label>
              <input className="input text-xs sm:text-sm" {...register('address_city')} />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input type="email" className="input text-xs sm:text-sm" {...register('email')} />
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input text-xs sm:text-sm" placeholder="https://..." {...register('website')} />
            </div>
          </div>
        </div>

        {/* Invoice settings */}
        <div className="card p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-slate-200">Factuurinstellingen</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Factuurprefix</label>
              <input className="input text-xs sm:text-sm font-mono" placeholder="2026-" {...register('invoice_prefix')} />
            </div>
            <div>
              <label className="label">Betaaltermijn (dagen)</label>
              <input type="number" className="input text-xs sm:text-sm" {...register('default_payment_term_days', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Accentkleur</label>
              <div className="flex gap-2">
                <input type="color" className="h-9 w-12 rounded cursor-pointer bg-slate-800 border border-slate-700 p-0.5" {...register('accent_color')} />
                <input className="input text-xs sm:text-sm flex-1 font-mono" {...register('accent_color')} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Standaard factuurnota</label>
            <textarea className="textarea text-xs sm:text-sm" rows={2} placeholder="Tekst die standaard onderaan elke factuur verschijnt..."
              {...register('invoice_notes_default')} />
          </div>
        </div>

        {/* SMTP Info */}
        <div className="card p-3.5 sm:p-4 space-y-2 bg-amber-500/5 border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Mail size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">E-mailverzending (SMTP)</h2>
          </div>
          <p className="text-xs text-amber-300">
            SMTP-inloggegevens voor automatische factuurverzending worden beheerd via het bestand <code className="bg-slate-800 px-1.5 py-0.5 rounded text-white">.env</code>.
          </p>
        </div>
      </form>
    </div>
  )
}

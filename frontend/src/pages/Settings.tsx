import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Save, Settings as SettingsIcon, Mail, Building2,
  CheckCircle2, ExternalLink, User as UserIcon, LogOut, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsApi } from '@/lib/api'
import { BusinessSettings } from '@/lib/types'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  getResendKey, saveResendConfig, getResendSender, isResendConfigured
} from '@/lib/email'
import { useAuth } from '@/lib/auth'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'email'>('profile')

  // Resend state
  const [resendApiKey, setResendApiKey] = useState('')
  const [resendSender, setResendSender] = useState('')

  const { data: settings, isLoading } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })
  const { register, handleSubmit, reset } = useForm<Partial<BusinessSettings>>()

  useEffect(() => {
    if (settings) reset(settings)
  }, [settings, reset])

  useEffect(() => {
    const rKey = getResendKey()
    if (rKey) setResendApiKey(rKey)
    setResendSender(getResendSender())
  }, [])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<BusinessSettings>) => settingsApi.update(data),
    onSuccess: () => {
      toast.success('Bedrijfsgegevens succesvol opgeslagen!')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => toast.error('Opslaan mislukt'),
  })

  const handleSaveResend = () => {
    if (!resendApiKey.trim()) {
      toast.error('Voer een geldige Resend API sleutel in.')
      return
    }
    saveResendConfig(resendApiKey, resendSender)
    toast.success('Resend e-mailinstellingen opgeslagen!')
  }

  if (isLoading) return <div className="text-slate-500 text-xs py-8">Instellingen laden...</div>

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Instellingen</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Bedrijfsprofiel, account en e-mail</p>
        </div>
        {activeTab === 'profile' && (
          <button
            onClick={handleSubmit(d => saveMutation.mutate(d))}
            className="btn-primary text-xs sm:text-sm py-2 px-4 self-start sm:self-auto"
            disabled={saveMutation.isPending}
          >
            <Save size={14} /> {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 flex-wrap">
        <button
          onClick={() => setActiveTab('profile')}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors',
            activeTab === 'profile'
              ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          )}
        >
          <Building2 size={16} />
          <span>Bedrijfsprofiel & Factuur</span>
        </button>

        <button
          onClick={() => setActiveTab('account')}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors',
            activeTab === 'account'
              ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          )}
        >
          <UserIcon size={16} />
          <span>Account</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors',
            activeTab === 'email'
              ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          )}
        >
          <Mail size={16} />
          <span>E-mail Versturen</span>
          {isResendConfigured() && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Resend geconfigureerd" />
          )}
        </button>
      </div>

      {/* TAB 1: Profile & Invoice Settings */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4 sm:space-y-5">
          {/* Company info */}
          <div className="card p-3.5 sm:p-5 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} className="text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-200">Bedrijfsgegevens (Wettelijk vereist)</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Bedrijfsnaam (statutair) *</label>
                <input className="input text-xs sm:text-sm" {...register('company_name')} />
              </div>
              <div>
                <label className="label">Handelsnaam</label>
                <input className="input text-xs sm:text-sm" {...register('trade_name')} />
              </div>
              <div>
                <label className="label">KVK-nummer (8 cijfers)</label>
                <input className="input text-xs sm:text-sm font-mono" placeholder="12345678" {...register('kvk_number')} />
              </div>
              <div>
                <label className="label">BTW-identificatienummer</label>
                <input className="input text-xs sm:text-sm font-mono" placeholder="NL123456789B01" {...register('btw_id')} />
              </div>
              <div>
                <label className="label">Zakelijk IBAN</label>
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
              <SettingsIcon size={16} className="text-brand-400" />
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
        </form>
      )}

      {/* TAB 2: Account */}
      {activeTab === 'account' && (
        <div className="space-y-4">
          {/* User info card */}
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold text-lg">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">{user?.name || '—'}</h2>
                <p className="text-xs text-slate-400">{user?.email || '—'}</p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <span className="badge-green text-xs flex items-center gap-1.5 py-1 px-2.5">
                <CheckCircle2 size={13} /> Ingelogd
              </span>
              {isSupabaseConfigured() && (
                <span className="badge-green text-xs flex items-center gap-1.5 py-1 px-2.5">
                  <ShieldCheck size={13} /> Cloud sync actief
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Uw gegevens zijn privé en afgeschermd. Andere gebruikers kunnen uw facturen, klanten
              en uitgaven niet zien. U blijft ingelogd op al uw apparaten totdat u uitlogt.
            </p>
          </div>

          {/* Logout card */}
          <div className="card p-4 sm:p-6 space-y-3 border border-red-500/10">
            <div className="flex items-center gap-2">
              <LogOut size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold text-slate-200">Uitloggen</h3>
            </div>
            <p className="text-xs text-slate-400">
              U wordt uitgelogd op dit apparaat. Uw gegevens blijven veilig opgeslagen in de cloud.
            </p>
            <button
              onClick={() => logout()}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 hover:bg-red-500/5 px-4 py-2"
            >
              <LogOut size={14} /> Uitloggen
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Email (Resend) */}
      {activeTab === 'email' && (
        <div className="space-y-5">
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base">Resend E-mail API (Gratis 3.000 e-mails/mnd)</h3>
                  <p className="text-xs text-slate-400">
                    Verstuur facturen met 1 klik direct naar klanten via uw eigen e-mailadres.
                  </p>
                </div>
              </div>
              {isResendConfigured() ? (
                <span className="badge-green text-xs flex items-center gap-1.5 py-1 px-2.5">
                  <CheckCircle2 size={13} /> Geconfigureerd
                </span>
              ) : (
                <span className="badge-gray text-xs py-1 px-2.5">
                  Mailto fallback
                </span>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="label">Resend API Key</label>
                <input
                  type="password"
                  className="input text-xs sm:text-sm font-mono"
                  placeholder="re_123456789_abcdef..."
                  value={resendApiKey}
                  onChange={e => setResendApiKey(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Afzender E-mailadres</label>
                <input
                  type="email"
                  className="input text-xs sm:text-sm font-mono"
                  placeholder="facturen@uwstudio.nl (of onboarding@resend.dev om te testen)"
                  value={resendSender}
                  onChange={e => setResendSender(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveResend}
                  className="btn-primary text-xs sm:text-sm py-2 px-4"
                >
                  <Save size={14} />
                  <span>Resend instellingen opslaan</span>
                </button>

                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-400 hover:underline flex items-center gap-1 ml-auto"
                >
                  Gratis Resend sleutel ophalen <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


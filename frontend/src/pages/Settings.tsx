import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Save, Settings as SettingsIcon, Mail, Building2, Database,
  CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Key
} from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsApi } from '@/lib/api'
import { BusinessSettings } from '@/lib/types'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import {
  getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig,
  isSupabaseConfigured, testSupabaseConnection
} from '@/lib/supabase'
import {
  getResendKey, saveResendConfig, getResendSender, isResendConfigured
} from '@/lib/email'

export default function SettingsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'profile' | 'cloud'>('profile')

  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [supabaseTesting, setSupabaseTesting] = useState(false)
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null)

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
    const supa = getSupabaseConfig()
    if (supa) {
      setSupabaseUrl(supa.url)
      setSupabaseKey(supa.anonKey)
    }
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

  const handleTestAndSaveSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      toast.error('Vul zowel de Supabase URL als de Anon Key in.')
      return
    }
    setSupabaseTesting(true)
    setSupabaseStatus(null)
    saveSupabaseConfig(supabaseUrl, supabaseKey)

    const result = await testSupabaseConnection()
    setSupabaseTesting(false)
    if (result.ok) {
      setSupabaseStatus('CONNECTED')
      toast.success(result.message)
      qc.invalidateQueries()
    } else {
      setSupabaseStatus('ERROR')
      toast.error(result.message)
    }
  }

  const handleDisconnectSupabase = () => {
    clearSupabaseConfig()
    setSupabaseUrl('')
    setSupabaseKey('')
    setSupabaseStatus(null)
    toast('Supabase ontkoppeld. AliBirds gebruikt nu lokale browseropslag.', { icon: 'ℹ️' })
    qc.invalidateQueries()
  }

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
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Bedrijfsprofiel en gratis cloud-koppelingen</p>
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
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
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
          onClick={() => setActiveTab('cloud')}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors',
            activeTab === 'cloud'
              ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          )}
        >
          <Database size={16} />
          <span>Cloud & Integraties (100% Gratis)</span>
          {isSupabaseConfigured() && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Supabase verbonden" />
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

      {/* TAB 2: Cloud & Integrations (Supabase & Resend) */}
      {activeTab === 'cloud' && (
        <div className="space-y-5">
          {/* Supabase Section */}
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base">Supabase Cloud Database (PostgreSQL)</h3>
                  <p className="text-xs text-slate-400">
                    Koppel een gratis Supabase database voor realtime synchronisatie over al uw apparaten.
                  </p>
                </div>
              </div>
              {isSupabaseConfigured() ? (
                <span className="badge-green text-xs flex items-center gap-1.5 py-1 px-2.5">
                  <CheckCircle2 size={13} /> Actief verbonden
                </span>
              ) : (
                <span className="badge-gray text-xs py-1 px-2.5">
                  Lokale browseropslag
                </span>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="label">Supabase Project URL</label>
                <input
                  type="text"
                  className="input text-xs sm:text-sm font-mono"
                  placeholder="https://xyzabcdefg.supabase.co"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Anon Public Key</label>
                <input
                  type="password"
                  className="input text-xs sm:text-sm font-mono"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={supabaseKey}
                  onChange={e => setSupabaseKey(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleTestAndSaveSupabase}
                  disabled={supabaseTesting}
                  className="btn-primary text-xs sm:text-sm py-2 px-4"
                >
                  <RefreshCw size={14} className={supabaseTesting ? 'animate-spin' : ''} />
                  <span>{supabaseTesting ? 'Verbinding testen...' : 'Verbinding opslaan & testen'}</span>
                </button>

                {isSupabaseConfigured() && (
                  <button
                    type="button"
                    onClick={handleDisconnectSupabase}
                    className="btn-ghost text-xs text-red-400 hover:text-red-300 py-2 px-3"
                  >
                    Ontkoppelen
                  </button>
                )}

                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-400 hover:underline flex items-center gap-1 ml-auto"
                >
                  Gratis Supabase account aanmaken <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Schema instructions */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Key size={14} className="text-brand-400" /> Supabase Tabellen Aanmaken in 1 Klik:
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Open in Supabase uw <strong className="text-slate-200">SQL Editor</strong> en plak het bestand{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded text-brand-300 font-mono">supabase/schema.sql</code>{' '}
                uit uw GitHub repository. Alle tabellen, kolommen en beveiligingsregels worden dan automatisch aangemaakt.
              </p>
            </div>
          </div>

          {/* Resend Email Section */}
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

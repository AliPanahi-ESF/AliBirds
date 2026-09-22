import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Save, Settings as SettingsIcon, Mail, Building2,
  CheckCircle2, ExternalLink, User as UserIcon, LogOut, ShieldCheck, Send
} from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsApi } from '@/lib/api'
import { BusinessSettings } from '@/lib/types'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  getResendKey, saveResendConfig, getResendSender, isResendConfigured,
  getDefaultPaymentLink, saveDefaultPaymentLink, sendTestEmail
} from '@/lib/email'
import { useAuth } from '@/lib/auth'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user, updateUser, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'email'>('profile')

  // Resend state
  const [resendApiKey, setResendApiKey] = useState('')
  const [resendSender, setResendSender] = useState('')
  const [defaultPayLink, setDefaultPayLink] = useState('')
  const [isTestingEmail, setIsTestingEmail] = useState(false)
  const [testEmailTarget, setTestEmailTarget] = useState('')

  const { data: settings, isLoading } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })
  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<Partial<BusinessSettings>>()

  useEffect(() => {
    if (settings && !isDirty) {
      reset(settings)
      if (settings.payment_link) {
        setDefaultPayLink(settings.payment_link)
      }
    }
  }, [settings, reset, isDirty])

  useEffect(() => {
    const rKey = getResendKey()
    if (rKey) setResendApiKey(rKey)
    setResendSender(getResendSender())
    const localPayLink = getDefaultPaymentLink()
    if (localPayLink && !defaultPayLink) setDefaultPayLink(localPayLink)
    if (user?.email && !testEmailTarget) setTestEmailTarget(user.email)
  }, [user])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<BusinessSettings>) => settingsApi.update(data),
    onSuccess: (saved) => {
      toast.success('Bedrijfsgegevens succesvol opgeslagen!')
      if (saved) {
        reset(saved)
      }
      if (saved?.company_name) {
        updateUser({ company_name: saved.company_name })
      }
      if (saved?.payment_link) {
        setDefaultPayLink(saved.payment_link)
        saveDefaultPaymentLink(saved.payment_link)
      }
      qc.setQueryData(['settings'], saved)
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: any) => {
      console.error('Settings save error:', err)
      toast.error(err?.message || 'Opslaan mislukt. Probeer het opnieuw.')
    },
  })

  const handleSaveResend = async () => {
    saveResendConfig(resendApiKey, resendSender)
    saveDefaultPaymentLink(defaultPayLink)
    try {
      await settingsApi.update({ payment_link: defaultPayLink.trim() })
      qc.invalidateQueries({ queryKey: ['settings'] })
    } catch {
      // ignore
    }
    toast.success('E-mail- en betaalinstellingen opgeslagen!')
  }

  const handleSendTest = async () => {
    const target = testEmailTarget.trim() || user?.email || ''
    if (!target || !target.includes('@')) {
      toast.error('Vul een geldig e-mailadres in om een testmail te ontvangen.')
      return
    }

    saveResendConfig(resendApiKey, resendSender)
    saveDefaultPaymentLink(defaultPayLink)

    setIsTestingEmail(true)
    try {
      const res = await sendTestEmail(target)
      if (res.ok) {
        toast.success(res.message)
      } else {
        toast.error(res.message, { duration: 6000 })
      }
    } catch (e: any) {
      toast.error(e.message || 'Verzenden van test e-mail mislukt.')
    } finally {
      setIsTestingEmail(false)
    }
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
                <input className="input text-xs sm:text-sm" placeholder="bijv. Keizersgracht 421" {...register('address_street')} />
              </div>
              <div>
                <label className="label">Postcode</label>
                <input className="input text-xs sm:text-sm" placeholder="1016 EK" {...register('address_postcode')} />
              </div>
              <div>
                <label className="label">Plaats</label>
                <input className="input text-xs sm:text-sm" placeholder="Amsterdam" {...register('address_city')} />
              </div>
              <div>
                <label className="label">Telefoonnummer</label>
                <input type="tel" className="input text-xs sm:text-sm font-mono" placeholder="+31 6 12345678" {...register('phone')} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input type="email" className="input text-xs sm:text-sm" placeholder="info@uwbedrijf.nl" {...register('email')} />
              </div>
              <div className="sm:col-span-3">
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
            <div>
              <label className="label">Directe Betaallink (iDEAL / Bunq / Tikkie / Stripe)</label>
              <input
                className="input text-xs sm:text-sm font-mono"
                placeholder="https://bunq.me/uwbedrijf of https://tikkie.me/..."
                {...register('payment_link')}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Wordt gesynchroniseerd over al uw apparaten en automatisch toegevoegd aan factuur-e-mails.
              </p>
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
                <p className="text-[11px] text-slate-400 mt-1">
                  Uw geheime API-sleutel van Resend. Wordt veilig lokaal opgeslagen en gebruikt voor in-app verzending.
                </p>
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
                <p className="text-[11px] text-slate-400 mt-1">
                  Gebruik <code className="text-brand-300">onboarding@resend.dev</code> voor gratis tests naar uw eigen account, of voeg uw eigen domein toe in Resend om naar alle klanten te sturen.
                </p>
              </div>

              <div>
                <label className="label">Standaard Betaallink (iDEAL / Bunq / Tikkie / Mollie)</label>
                <input
                  type="url"
                  className="input text-xs sm:text-sm font-mono"
                  placeholder="bijv. https://bunq.me/uwstudio of https://tikkie.me/..."
                  value={defaultPayLink}
                  onChange={e => setDefaultPayLink(e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Wordt automatisch meegestuurd als klikbare betaalknop in elke factuurmail.
                </p>
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

            {/* Test Email Verification Box */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Verbinding testen</h4>
                <p className="text-[11px] text-slate-400">
                  Stuur direct een test e-mail om te verifiëren dat direct verzenden in de app werkt.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  className="input text-xs sm:text-sm font-mono flex-1"
                  placeholder={user?.email || 'uw-email@domein.nl'}
                  value={testEmailTarget}
                  onChange={e => setTestEmailTarget(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isTestingEmail || !resendApiKey}
                  className="btn-secondary text-xs sm:text-sm py-2 px-4 whitespace-nowrap flex items-center justify-center gap-1.5 disabled:opacity-50"
                  title={!resendApiKey ? 'Vul eerst uw Resend API Key in hierboven' : undefined}
                >
                  <Send size={13} />
                  <span>{isTestingEmail ? 'Verzenden...' : 'Stuur testmail'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step Setup Guide */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-xs">
              <h4 className="font-semibold text-slate-300">Hoe werkt direct verzenden in de app?</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-brand-400">1. Gratis account</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Meld u gratis aan op <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-brand-300 underline">resend.com</a>. U krijgt 3.000 gratis e-mails per maand.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-brand-400">2. API Key invoeren</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Kopieer uw API Key (<code className="text-brand-300 font-mono">re_...</code>) en plak deze hierboven in het veld.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-brand-400">3. Direct versturen</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    U kunt nu facturen direct vanuit AliBirds verzenden met PDF en iDEAL-betaallink, of blijven kiezen voor Gmail/Outlook.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


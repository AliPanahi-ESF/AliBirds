import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Save, Settings as SettingsIcon, Building2,
  CheckCircle2, User as UserIcon, LogOut, ShieldCheck,
  KeyRound, Lock, Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsApi } from '@/lib/api'
import { BusinessSettings } from '@/lib/types'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getDefaultPaymentLink, saveDefaultPaymentLink } from '@/lib/email'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user, updateUser, logout } = useAuth()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile')

  // Password change & GDPR state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [defaultPayLink, setDefaultPayLink] = useState('')

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
    const localPayLink = getDefaultPaymentLink()
    if (localPayLink && !defaultPayLink) setDefaultPayLink(localPayLink)
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      toast.error('Het nieuwe wachtwoord moet minimaal 6 tekens bevatten.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('De ingevoerde wachtwoorden komen niet overeen.')
      return
    }

    setIsChangingPassword(true)
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw error
      }
      toast.success('Uw wachtwoord is succesvol gewijzigd!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Wachtwoord wijzigen mislukt.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const exportObj = {
        exportedAt: new Date().toISOString(),
        user: { name: user?.name, email: user?.email },
        settings: settings || {},
      }
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `alibirds-export-${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success('Uw administratie is succesvol geëxporteerd!')
    } catch {
      toast.error('Export mislukt.')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) return <div className="text-slate-500 text-xs py-8">Instellingen laden...</div>

  return (
    <div className="w-full max-w-5xl space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Instellingen</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Bedrijfsprofiel en accountbeheer</p>
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
          <span>Account & Beveiliging</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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

          {/* Language Preference Card */}
          <div className="card p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{t('settings.language_title', 'Taal / Language')}</h3>
                <p className="text-[11px] text-slate-400">{t('settings.language_desc', 'Kies uw gewenste weergavetaal voor AliBirds.')}</p>
              </div>
              <LanguageSwitcher />
            </div>
          </div>

          {/* Change Password Card */}
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <KeyRound size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{t('settings.change_password_title', 'Wachtwoord Wijzigen')}</h3>
                <p className="text-[11px] text-slate-400">{t('settings.change_password_desc', 'Stel direct een nieuw veilig wachtwoord in voor uw account')}</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3.5 max-w-md">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t('auth.new_password', 'Nieuw wachtwoord')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t('auth.min_chars', 'Minimaal 6 tekens')}
                    className="input-field w-full text-xs py-2 pl-8 pr-3"
                    disabled={isChangingPassword}
                  />
                  <Lock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t('auth.confirm_password', 'Bevestig nieuw wachtwoord')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirm_password', 'Herhaal nieuw wachtwoord')}
                    className="input-field w-full text-xs py-2 pl-8 pr-3"
                    disabled={isChangingPassword}
                  />
                  <Lock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword || !newPassword}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50"
              >
                <KeyRound size={14} />
                <span>{isChangingPassword ? '...' : t('btn.change_password', 'Wachtwoord opslaan')}</span>
              </button>
            </form>
          </div>

          {/* Privacy & Data Export Card (AVG / GDPR Compliant) */}
          <div className="card p-4 sm:p-6 space-y-3 border border-slate-800">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{t('settings.gdpr_title', 'Privacy & Gegevensbescherming (AVG)')}</h3>
                <p className="text-[11px] text-slate-400">{t('settings.gdpr_desc', 'Uw rechten op dataportabiliteit en wettelijke bewaarplicht')}</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {t('settings.gdpr_text', 'Conform de Algemene Verordening Gegevensbescherming (AVG/GDPR) heeft u te allen tijde het recht om uw administratie en klantgegevens te exporteren. Let op: op grond van artikel 52 AWR geldt voor ondernemers een fiscale bewaarplicht van 7 jaar.')}
            </p>

            <button
              type="button"
              onClick={handleExportData}
              disabled={isExporting}
              className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-2 disabled:opacity-50"
            >
              <Download size={14} />
              <span>{isExporting ? t('btn.exporting', 'Gegevens exporteren...') : t('btn.export_data', 'Administratie exporteren (JSON)')}</span>
            </button>
          </div>

          {/* Logout card */}
          <div className="card p-4 sm:p-6 space-y-3 border border-red-500/10">
            <div className="flex items-center gap-2">
              <LogOut size={16} className="text-red-400" />
              <h3 className="text-sm font-semibold text-slate-200">{t('nav.logout', 'Uitloggen')}</h3>
            </div>
            <p className="text-xs text-slate-400">
              U wordt uitgelogd op dit apparaat. Uw gegevens blijven veilig opgeslagen in de cloud.
            </p>
            <button
              onClick={() => logout()}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 hover:bg-red-500/5 px-4 py-2"
            >
              <LogOut size={14} /> {t('nav.logout', 'Uitloggen')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}



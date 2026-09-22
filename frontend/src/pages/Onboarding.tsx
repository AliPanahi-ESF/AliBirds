import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, MapPin, CreditCard, CheckCircle, ArrowRight, ArrowLeft,
  Sparkles, ShieldCheck, FileCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth'
import { settingsApi } from '@/lib/api'
import { clsx } from 'clsx'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, completeOnboarding } = useAuth()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)

  // Onboarding Form State matching Dutch legal requirements
  const [companyName, setCompanyName] = useState(user?.company_name || '')
  const [tradeName, setTradeName] = useState('')
  const [kvkNumber, setKvkNumber] = useState('')
  const [btwId, setBtwId] = useState('')

  const [addressStreet, setAddressStreet] = useState('')
  const [addressPostcode, setAddressPostcode] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressCountry, setAddressCountry] = useState('NL')
  const [phone, setPhone] = useState('')

  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [paymentTermDays, setPaymentTermDays] = useState(14)
  const [invoicePrefix, setInvoicePrefix] = useState('2026-')
  const [accentColor, setAccentColor] = useState('#4f46e5')

  useEffect(() => {
    let active = true
    settingsApi.get().then((existing) => {
      if (!active || !existing) return
      if (existing.company_name) setCompanyName(existing.company_name)
      if (existing.trade_name) setTradeName(existing.trade_name)
      if (existing.kvk_number) setKvkNumber(existing.kvk_number)
      if (existing.btw_id) setBtwId(existing.btw_id)
      if (existing.address_street) setAddressStreet(existing.address_street)
      if (existing.address_postcode) setAddressPostcode(existing.address_postcode)
      if (existing.address_city) setAddressCity(existing.address_city)
      if (existing.address_country) setAddressCountry(existing.address_country)
      if (existing.phone) setPhone(existing.phone)
      if (existing.iban) setIban(existing.iban)
      if (existing.bic) setBic(existing.bic)
      if (existing.default_payment_term_days) setPaymentTermDays(existing.default_payment_term_days)
      if (existing.invoice_prefix) setInvoicePrefix(existing.invoice_prefix)
      if (existing.accent_color) setAccentColor(existing.accent_color)

      if (existing.company_name && (existing.kvk_number || existing.btw_id)) {
        setHasExistingProfile(true)
      }
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const handleNextStep = () => {
    if (step === 1) {
      if (!companyName.trim()) {
        toast.error('Vul alstublieft uw officiële bedrijfsnaam in.')
        return
      }
      if (!kvkNumber.trim() || kvkNumber.replace(/\D/g, '').length < 8) {
        toast.error('Een geldig KVK-nummer bestaat uit 8 cijfers.')
        return
      }
      if (!btwId.trim() || !btwId.toUpperCase().startsWith('NL')) {
        toast.error('Een Nederlands BTW-id begint met NL (bijv. NL123456789B01).')
        return
      }
    } else if (step === 2) {
      if (!addressStreet.trim() || !addressPostcode.trim() || !addressCity.trim()) {
        toast.error('Vul uw straat, postcode en vestigingsplaats in.')
        return
      }
    } else if (step === 3) {
      if (!iban.trim() || iban.replace(/\s/g, '').length < 15) {
        toast.error('Vul een geldig zakelijk IBAN-nummer in.')
        return
      }
    }
    setStep(s => Math.min(s + 1, 4))
  }

  const handleComplete = async () => {
    setSubmitting(true)
    try {
      await completeOnboarding({
        company_name: companyName,
        trade_name: tradeName || companyName,
        kvk_number: kvkNumber.trim(),
        btw_id: btwId.toUpperCase().trim(),
        address_street: addressStreet.trim(),
        address_postcode: addressPostcode.toUpperCase().trim(),
        address_city: addressCity.trim(),
        address_country: addressCountry,
        phone: phone.trim() || undefined,
        iban: iban.toUpperCase().trim(),
        bic: bic.toUpperCase().trim(),
        default_payment_term_days: Number(paymentTermDays) || 14,
        invoice_prefix: invoicePrefix.trim(),
        accent_color: accentColor,
      })

      toast.success('Bedrijfsprofiel opgeslagen! Welkom bij AliBirds.', { duration: 4000 })
      navigate('/')
    } catch (err: any) {
      toast.error(err.message || 'Kon onboarding niet afronden.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTakeOver = async () => {
    setSubmitting(true)
    try {
      await completeOnboarding({
        company_name: companyName,
        trade_name: tradeName || companyName,
        kvk_number: kvkNumber.trim(),
        btw_id: btwId.toUpperCase().trim(),
        address_street: addressStreet.trim(),
        address_postcode: addressPostcode.toUpperCase().trim(),
        address_city: addressCity.trim(),
        address_country: addressCountry,
        phone: phone.trim() || undefined,
        iban: iban.toUpperCase().trim(),
        bic: bic.toUpperCase().trim(),
        default_payment_term_days: Number(paymentTermDays) || 14,
        invoice_prefix: invoicePrefix.trim(),
        accent_color: accentColor,
      })
      toast.success('Bestaand bedrijfsprofiel geladen! Welkom op uw dashboard.')
      navigate('/')
    } catch {
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    { num: 1, title: 'Bedrijf & KvK', icon: Building2 },
    { num: 2, title: 'Vestigingsadres', icon: MapPin },
    { num: 3, title: 'Bank & Factuur', icon: CreditCard },
    { num: 4, title: 'Overzicht & Start', icon: CheckCircle },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative selection:bg-brand-500 selection:text-white">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-600/15 text-brand-400 border border-brand-500/20">
            <Sparkles size={12} />
            ZZP Bedrijfsconfiguratie
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Welkom bij AliBirds, {user?.name ?? 'Ondernemer'}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Stel in een paar stappen uw officiële Nederlandse bedrijfsgegevens in voor Belastingdienst-conforme facturatie.
          </p>
        </div>

        {/* Existing Profile Fast-Track Banner */}
        {hasExistingProfile && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-semibold text-emerald-300">
                  Bestaand bedrijfsprofiel gevonden ({companyName})
                </div>
                <div className="text-[11px] text-slate-300">
                  Uw gegevens zijn al geconfigureerd in de cloud. U hoeft dit niet opnieuw in te vullen.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTakeOver}
              disabled={submitting}
              className="btn-primary text-xs py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
            >
              <span>Naar Dashboard</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Progress Stepper */}
        <div className="grid grid-cols-4 gap-2">
          {steps.map(({ num, title, icon: Icon }) => (
            <div
              key={num}
              className={clsx(
                'flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-center',
                step === num
                  ? 'bg-brand-600/15 border-brand-500/50 text-brand-400'
                  : step > num
                  ? 'bg-slate-900/60 border-slate-800 text-emerald-400'
                  : 'bg-slate-900/30 border-slate-800/60 text-slate-500'
              )}
            >
              <div className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                step === num ? 'bg-brand-600 text-white' : step > num ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
              )}>
                {step > num ? <CheckCircle size={14} /> : <Icon size={14} />}
              </div>
              <span className="text-[11px] font-medium hidden sm:inline">{title}</span>
            </div>
          ))}
        </div>

        {/* Wizard Card */}
        <div className="card p-5 sm:p-7 shadow-2xl border-slate-800 bg-slate-900/95 backdrop-blur-xl">
          {/* STEP 1: Bedrijf & KvK */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Building2 size={18} className="text-brand-400" />
                  Stap 1: Officiële Bedrijfsgegevens
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verplichte wettelijke vermeldingen volgens de Wet op de omzetbelasting.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="label">Juridische Bedrijfsnaam *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="bijv. Ali Creative Studio B.V. of Ali Panahi"
                    className="input text-xs sm:text-sm"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Zoals ingeschreven in het Handelsregister</span>
                </div>

                <div>
                  <label className="label">Handelsnaam (optioneel)</label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={e => setTradeName(e.target.value)}
                    placeholder="bijv. AliBirds Studio"
                    className="input text-xs sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">KVK-nummer *</label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={kvkNumber}
                      onChange={e => setKvkNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="8 cijfers (bijv. 84920182)"
                      className="input text-xs sm:text-sm font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Kamer van Koophandel</span>
                  </div>

                  <div>
                    <label className="label">BTW-identificatienummer *</label>
                    <input
                      type="text"
                      required
                      maxLength={14}
                      value={btwId}
                      onChange={e => setBtwId(e.target.value.toUpperCase())}
                      placeholder="NL001234567B01"
                      className="input text-xs sm:text-sm font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Belastingdienst btw-id</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Vestigingsadres */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <MapPin size={18} className="text-brand-400" />
                  Stap 2: Zakelijk Vestigingsadres
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dit adres verschijnt als afzender op uw facturen en offertes.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="label">Straat en huisnummer *</label>
                  <input
                    type="text"
                    required
                    value={addressStreet}
                    onChange={e => setAddressStreet(e.target.value)}
                    placeholder="bijv. Keizersgracht 421"
                    className="input text-xs sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">Postcode *</label>
                    <input
                      type="text"
                      required
                      value={addressPostcode}
                      onChange={e => setAddressPostcode(e.target.value.toUpperCase())}
                      placeholder="1016 EK"
                      className="input text-xs sm:text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="label">Plaats *</label>
                    <input
                      type="text"
                      required
                      value={addressCity}
                      onChange={e => setAddressCity(e.target.value)}
                      placeholder="Amsterdam"
                      className="input text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">Telefoonnummer (optioneel)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+31 6 12345678"
                      className="input text-xs sm:text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Land</label>
                    <select
                      value={addressCountry}
                      onChange={e => setAddressCountry(e.target.value)}
                      className="select text-xs sm:text-sm"
                    >
                      <option value="NL">Nederland</option>
                      <option value="BE">België</option>
                      <option value="DE">Duitsland</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Bankrekening & Factuurinstellingen */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <CreditCard size={18} className="text-brand-400" />
                  Stap 3: Bankrekening & Factuurstandaarden
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Uw zakelijke IBAN voor betalingen en standaard betaalcondities.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="label">Zakelijk Rekeningnummer (IBAN) *</label>
                  <input
                    type="text"
                    required
                    value={iban}
                    onChange={e => setIban(e.target.value.toUpperCase())}
                    placeholder="NL91 BUNQ 2049 1827 41"
                    className="input text-xs sm:text-sm font-mono"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Ondersteunt bunq, ING, Rabobank, ABN AMRO, Knab</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">BIC / SWIFT (optioneel)</label>
                    <input
                      type="text"
                      value={bic}
                      onChange={e => setBic(e.target.value.toUpperCase())}
                      placeholder="BUNQNL2A"
                      className="input text-xs sm:text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="label">Standaard Betaaltermijn</label>
                    <select
                      value={paymentTermDays}
                      onChange={e => setPaymentTermDays(Number(e.target.value))}
                      className="select text-xs sm:text-sm"
                    >
                      <option value={14}>14 dagen (standaard)</option>
                      <option value={30}>30 dagen (B2B groot)</option>
                      <option value={7}>7 dagen</option>
                      <option value={0}>Direct bij ontvangst</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">Factuurnummering Prefix</label>
                    <input
                      type="text"
                      value={invoicePrefix}
                      onChange={e => setInvoicePrefix(e.target.value)}
                      placeholder="2026-"
                      className="input text-xs sm:text-sm font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">bijv. 2026-0001</span>
                  </div>

                  <div>
                    <label className="label">Huisstijl Accentkleur</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={e => setAccentColor(e.target.value)}
                        className="h-9 w-12 rounded cursor-pointer bg-slate-800 border border-slate-700 p-0.5"
                      />
                      <input
                        type="text"
                        value={accentColor}
                        onChange={e => setAccentColor(e.target.value)}
                        className="input text-xs sm:text-sm font-mono flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Overzicht & Start */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3 text-center sm:text-left">
                <h2 className="text-base font-bold text-slate-100 flex items-center justify-center sm:justify-start gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  Stap 4: Controle & Factuurkopie Preview
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Zo verschijnen uw gegevens wettelijk conform op de gegenereerde PDF-facturen:
                </p>
              </div>

              {/* Invoice header mockup */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-start border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="font-bold text-sm text-slate-100" style={{ color: accentColor }}>
                      {companyName}
                    </div>
                    {tradeName && <div className="text-xs text-slate-400">{tradeName}</div>}
                    <div className="text-xs text-slate-400 mt-1">
                      {addressStreet}, {addressPostcode} {addressCity}
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-mono text-slate-400 space-y-0.5">
                    <div>KVK: <span className="text-slate-200">{kvkNumber}</span></div>
                    <div>BTW-id: <span className="text-slate-200">{btwId}</span></div>
                    <div>IBAN: <span className="text-slate-200">{iban}</span></div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Factuurnummer: <strong className="text-slate-200 font-mono">{invoicePrefix}0001</strong></span>
                  <span>Betaaltermijn: <strong className="text-slate-200">{paymentTermDays} dagen</strong></span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-3 text-xs text-emerald-300">
                <FileCheck size={20} className="shrink-0 text-emerald-400" />
                <span>
                  Uw bedrijfsgegevens voldoen aan alle wettelijke eisen van de Nederlandse Belastingdienst en Kamer van Koophandel.
                </span>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="btn-secondary text-xs sm:text-sm py-2 px-3.5"
              >
                <ArrowLeft size={14} /> Vorige
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="btn-primary text-xs sm:text-sm py-2 px-4 shadow-lg shadow-brand-600/30 ml-auto"
              >
                Volgende stap <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={submitting}
                className="btn-primary text-xs sm:text-sm py-2.5 px-5 shadow-lg shadow-brand-600/40 ml-auto font-semibold bg-emerald-600 hover:bg-emerald-500"
              >
                {submitting ? 'Opslaan...' : 'Voltooien & Naar Dashboard'}
                <Sparkles size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bird, Lock, Mail, User as UserIcon, ArrowRight, Sparkles, CheckCircle2, QrCode, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth'
import { clsx } from 'clsx'

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, registerUser, loginAsDemo, syncSession } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSyncInput, setShowSyncInput] = useState(false)
  const [syncCode, setSyncCode] = useState('')

  // Handle instant pairing via URL parameter ?sync=...
  useEffect(() => {
    const syncParam = searchParams.get('sync')
    if (syncParam) {
      const performSync = async () => {
        setLoading(true)
        try {
          const jsonStr = decodeURIComponent(atob(syncParam))
          const data = JSON.parse(jsonStr)
          if (data && data.user) {
            const syncedUser = await syncSession(data)
            toast.success(`Succesvol gekoppeld! Welkom terug, ${syncedUser.name}.`, { duration: 4000 })
            if (syncedUser.is_onboarded) {
              navigate('/')
            } else {
              navigate('/onboarding')
            }
          }
        } catch (err: any) {
          console.error('Sync failed:', err)
          toast.error('Ongeldige synchronisatielink of verlopen sessie.')
        } finally {
          setLoading(false)
        }
      }
      performSync()
    }
  }, [searchParams, syncSession, navigate])

  const handleManualSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!syncCode.trim()) return
    setLoading(true)
    try {
      // Remove any full URL part if user pasted the entire link
      let rawCode = syncCode.trim()
      if (rawCode.includes('sync=')) {
        rawCode = rawCode.split('sync=')[1].split('&')[0]
      }
      const jsonStr = decodeURIComponent(atob(rawCode))
      const data = JSON.parse(jsonStr)
      if (data && data.user) {
        const syncedUser = await syncSession(data)
        toast.success(`Succesvol gekoppeld! Welkom terug, ${syncedUser.name}.`)
        if (syncedUser.is_onboarded) {
          navigate('/')
        } else {
          navigate('/onboarding')
        }
      } else {
        throw new Error('Geen geldige gebruikersgegevens in de code.')
      }
    } catch (err: any) {
      toast.error('Ongeldige koppelcode. Controleer de code vanaf uw computer.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const u = await login(email, password)
        toast.success(`Welkom terug, ${u.name}!`)
        if (!u.is_onboarded) {
          navigate('/onboarding')
        } else {
          navigate('/')
        }
      } else {
        if (!name.trim()) {
          toast.error('Vul alstublieft uw volledige naam in.')
          setLoading(false)
          return
        }
        const u = await registerUser(name, email, password)
        toast.success('Account succesvol aangemaakt!')
        navigate('/onboarding')
      }
    } catch (err: any) {
      toast.error(err.message || 'Inloggen mislukt. Controleer uw gegevens.')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    try {
      await loginAsDemo()
      toast.success('Ingelogd met demo studio account!')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 selection:bg-brand-500 selection:text-white relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center shadow-xl shadow-brand-600/30 mx-auto transform hover:scale-105 transition-transform">
            <Bird className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">AliBirds</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Zelf-gehoste facturatie & btw-aangifte voor Nederlandse ZZP'ers
          </p>
        </div>

        {/* Auth card */}
        <div className="card p-5 sm:p-7 shadow-2xl border-slate-800/80 bg-slate-900/90 backdrop-blur-xl space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={clsx(
                'py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all',
                mode === 'login'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Inloggen
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={clsx(
                'py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all',
                mode === 'register'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Account aanmaken
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div className="space-y-1">
                <label className="label">Uw volledige naam *</label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="bijv. Jan de Vries"
                    className="input pl-9 text-xs sm:text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="label">E-mailadres *</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="naam@uwstudio.nl"
                  className="input pl-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="label">Wachtwoord *</label>
                {mode === 'login' && (
                  <span className="text-[11px] text-brand-400 hover:underline cursor-pointer" onClick={() => toast('Wachtwoord vergeten? Neem contact op met uw systeembeheerder.')}>
                    Vergeten?
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-9 text-xs sm:text-sm font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-2.5 text-xs sm:text-sm font-semibold mt-2 shadow-lg shadow-brand-600/25"
            >
              {loading ? 'Verwerken...' : mode === 'login' ? 'Inloggen' : 'Registreren & Bedrijf instellen'}
              <ArrowRight size={15} />
            </button>
          </form>

          {/* Quick Demo Login Option */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-slate-900 px-2 text-slate-500">Of direct testen</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full btn-secondary justify-center py-2 text-xs sm:text-sm font-medium border-slate-700/80 hover:border-brand-500/50"
          >
            <Sparkles size={15} className="text-amber-400" />
            <span>1-Klik Demo Studio (Direct inloggen)</span>
          </button>

          {/* Phone Pairing Option */}
          <div className="pt-2 border-t border-slate-800/60">
            {!showSyncInput ? (
              <button
                type="button"
                onClick={() => setShowSyncInput(true)}
                className="w-full text-center text-xs text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1.5 py-1"
              >
                <Smartphone size={13} />
                <span>Koppelcode van computer invoeren</span>
              </button>
            ) : (
              <form onSubmit={handleManualSyncSubmit} className="space-y-2 mt-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <QrCode size={13} className="text-brand-400" />
                    Telefoon koppelen
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSyncInput(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Sluiten
                  </button>
                </div>
                <input
                  type="text"
                  value={syncCode}
                  onChange={e => setSyncCode(e.target.value)}
                  placeholder="Plak koppelcode of URL vanaf computer..."
                  className="input text-xs"
                />
                <button
                  type="submit"
                  disabled={loading || !syncCode.trim()}
                  className="btn-primary w-full justify-center py-1.5 text-xs font-semibold"
                >
                  Direct Synchroniseren
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Feature bullets */}
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400 pt-2">
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>KVK & BTW-id</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Btw-aangifte</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>MT940 Bank</span>
          </div>
        </div>
      </div>
    </div>
  )
}

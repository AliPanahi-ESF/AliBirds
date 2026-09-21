import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bird, Lock, Mail, User as UserIcon, ArrowRight, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { clsx } from 'clsx'

export default function AuthPage() {
  const navigate = useNavigate()
  const { login, registerUser, loginDemo } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Voer eerst uw e-mailadres in.')
      return
    }
    if (!isSupabaseConfigured()) {
      toast.error('Wachtwoord resetten is niet beschikbaar.')
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      toast.success('Wachtwoord reset link verstuurd naar uw e-mail!')
    } catch (err: any) {
      toast.error(err.message || 'Kan reset e-mail niet versturen.')
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
                  <span className="text-[11px] text-brand-400 hover:underline cursor-pointer" onClick={handleForgotPassword}>
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

          {/* 1-Click Demo Studio Button */}
          <div className="pt-1 space-y-2.5">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-slate-500 font-semibold bg-slate-900 px-2 w-max mx-auto">
                Of direct bekijken
              </div>
            </div>

            <button
              type="button"
              onClick={loginDemo}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-brand-300 hover:text-white bg-brand-600/15 hover:bg-brand-600/25 border border-brand-500/30 hover:border-brand-500/50 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-98"
            >
              <Sparkles size={14} className="text-brand-400" />
              <span>1-Click Demo Studio (Zonder inloggen)</span>
            </button>
          </div>

          {!isSupabaseConfigured() && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-300/90 flex items-start gap-2">
              <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong>Tip:</strong> Om accounts en cloud sync te activeren, voegt u eenmalig <code className="text-amber-200">VITE_SUPABASE_URL</code> en <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> toe in Netlify Site Settings.
              </p>
            </div>
          )}

          {/* Security note */}
          <p className="text-[11px] text-slate-500 text-center pt-1">
            Uw gegevens zijn beveiligd en privé. Elke gebruiker heeft een eigen afgeschermd account.
          </p>
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

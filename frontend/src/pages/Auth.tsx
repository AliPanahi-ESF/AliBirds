import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bird, Lock, Mail, User as UserIcon, ArrowRight, CheckCircle2,
  Sparkles, AlertCircle, KeyRound, RefreshCw, Check, ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { clsx } from 'clsx'

interface AuthPageProps {
  initialMode?: 'login' | 'register' | 'update-password' | 'verify-code'
}

export default function AuthPage({ initialMode }: AuthPageProps = {}) {
  const navigate = useNavigate()
  const {
    login, registerUser, loginDemo,
    isRecoveryMode, setIsRecoveryMode,
    authError, clearAuthError
  } = useAuth()

  const [mode, setMode] = useState<'login' | 'register' | 'update-password' | 'verify-code'>(() => {
    if (initialMode) return initialMode
    if (isRecoveryMode || (typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))) {
      return 'update-password'
    }
    return 'login'
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)

  // Sync mode if isRecoveryMode changes externally
  useEffect(() => {
    if (isRecoveryMode) {
      setMode('update-password')
    }
  }, [isRecoveryMode])

  const getAuthRedirectUrl = () => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return `${window.location.origin}/`
    }
    return 'https://alibirds.netlify.app/'
  }

  // Standard Login / Register submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const u = await login(email, password)
        toast.success(`Welkom terug, ${u.name}!`)
        clearAuthError()
        if (!u.is_onboarded) {
          navigate('/onboarding')
        } else {
          navigate('/')
        }
      } else if (mode === 'register') {
        if (!name.trim()) {
          toast.error('Vul alstublieft uw volledige naam in.')
          setLoading(false)
          return
        }
        await registerUser(name, email, password)
        if (isSupabaseConfigured()) {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            toast.success(
              'Account geregistreerd! Bevestig uw e-mail via de link in uw inbox (of vul hieronder de code in).',
              { duration: 8000 }
            )
            setMode('login')
            return
          }
        }
        toast.success('Account succesvol aangemaakt!')
        clearAuthError()
        navigate('/onboarding')
      }
    } catch (err: any) {
      const msg = err.message || 'Inloggen mislukt. Controleer uw gegevens.'
      if (msg.toLowerCase().includes('email not confirmed')) {
        toast.error(
          'Uw e-mail is nog niet bevestigd. Klik hieronder op "Bevestigingsmail opnieuw" of voer de code handmatig in.',
          { duration: 8000 }
        )
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // Update Password submit (arrived via reset email)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Het nieuwe wachtwoord moet minimaal 6 tekens bevatten.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      toast.success('Wachtwoord succesvol gewijzigd! U bent nu ingelogd.')
      setIsRecoveryMode(false)
      clearAuthError()

      // Clean URL parameters
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }

      navigate('/')
    } catch (err: any) {
      toast.error(err.message || 'Wachtwoord bijwerken mislukt. Vraag een nieuwe resetlink aan.')
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP / Token directly
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanToken = verificationCode.trim()
    if (!email.trim() || !cleanToken) {
      toast.error('Vul uw e-mailadres en de verificatiecode in.')
      return
    }

    setLoading(true)
    try {
      // First attempt: signup verification
      let result = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanToken,
        type: 'signup',
      })

      // If signup type failed, try recovery or magiclink
      if (result.error) {
        result = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: cleanToken,
          type: 'recovery',
        })
      }

      if (result.error) throw result.error

      toast.success('Verificatie geslaagd! U bent ingelogd.')
      clearAuthError()
      navigate('/')
    } catch (err: any) {
      toast.error(err.message || 'Ongeldige of verlopen verificatiecode. Vraag een nieuwe link/code aan.')
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl(),
      })
      if (error) throw error
      toast.success('Wachtwoord reset link verstuurd naar uw e-mail!')
    } catch (err: any) {
      toast.error(err.message || 'Kan reset e-mail niet versturen.')
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) {
      toast.error('Voer eerst uw e-mailadres in om de link opnieuw te sturen.')
      return
    }
    if (!isSupabaseConfigured()) return
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      })
      if (error) throw error
      toast.success('Nieuwe bevestigingslink verstuurd naar uw e-mail!')
    } catch (err: any) {
      toast.error(err.message || 'Kan bevestigingsmail niet opnieuw versturen.')
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
          
          {/* Expired OTP / Scanner Warning Banner */}
          {authError === 'otp_expired' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 animate-fade-in">
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-300">Bevestigingslink is al geopend of verlopen</div>
                  <p className="text-amber-200/80 leading-relaxed text-[11px]">
                    E-mailscanners (zoals in Outlook of Gmail) openen links automatisch voor viruscontrole, waardoor eenmalige links direct worden verbruikt.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError()
                    setMode('login')
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium text-[11px] transition-colors"
                >
                  Direct inloggen
                </button>
                <button
                  type="button"
                  onClick={() => setMode('verify-code')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] transition-colors"
                >
                  Code invoeren
                </button>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  className="text-amber-400 hover:underline text-[11px] ml-auto"
                >
                  Nieuwe link
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher (only shown for login / register) */}
          {(mode === 'login' || mode === 'register') && (
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
          )}

          {/* VIEW 1: Password Recovery (Set new password) */}
          {mode === 'update-password' ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/30">
                  <KeyRound size={20} />
                </div>
                <h2 className="text-base font-bold text-slate-100">Nieuw wachtwoord instellen</h2>
                <p className="text-xs text-slate-400">
                  Kies een nieuw veilig wachtwoord voor uw AliBirds account.
                </p>
              </div>

              <div className="space-y-1">
                <label className="label">Nieuw wachtwoord *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimaal 6 tekens"
                    className="input pl-9 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="label">Bevestig nieuw wachtwoord *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Herhaal wachtwoord"
                    className="input pl-9 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary bg-purple-600 hover:bg-purple-500 border-purple-500 justify-center py-2.5 text-xs sm:text-sm font-semibold shadow-lg shadow-purple-600/25 flex items-center gap-2"
              >
                {loading ? 'Wachtwoord opslaan...' : 'Wachtwoord opslaan & Inloggen'}
                <ArrowRight size={15} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRecoveryMode(false)
                  setMode('login')
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1"
              >
                Terug naar inloggen
              </button>
            </form>
          ) : mode === 'verify-code' ? (
            /* VIEW 2: Verify Code / Token Manually */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="w-10 h-10 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center mx-auto border border-brand-500/30">
                  <Check size={20} />
                </div>
                <h2 className="text-base font-bold text-slate-100">Verificatiecode invoeren</h2>
                <p className="text-xs text-slate-400">
                  Voer de 6-cijferige code of het token uit de e-mail hieronder handmatig in.
                </p>
              </div>

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
                <label className="label">Verificatiecode of Token *</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    placeholder="6 cijfers of token uit link"
                    className="input pl-9 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary justify-center py-2.5 text-xs sm:text-sm font-semibold shadow-lg shadow-brand-600/25 flex items-center gap-2"
              >
                {loading ? 'Verifiëren...' : 'Code verifiëren & Inloggen'}
                <ArrowRight size={15} />
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  className="text-brand-400 hover:underline"
                >
                  Nieuwe code sturen
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Terug naar inloggen
                </button>
              </div>
            </form>
          ) : (
            /* VIEW 3: Standard Login / Register Form */
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
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] text-slate-400 hover:text-brand-300 hover:underline cursor-pointer"
                        onClick={handleResendConfirmation}
                      >
                        Bevestiging opnieuw?
                      </span>
                      <span className="text-slate-600">·</span>
                      <span
                        className="text-[11px] text-brand-400 hover:underline cursor-pointer"
                        onClick={handleForgotPassword}
                      >
                        Vergeten?
                      </span>
                    </div>
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
                className="w-full btn-primary justify-center py-2.5 text-xs sm:text-sm font-semibold mt-2 shadow-lg shadow-brand-600/25 flex items-center gap-2"
              >
                {loading ? 'Verwerken...' : mode === 'login' ? 'Inloggen' : 'Registreren & Bedrijf instellen'}
                <ArrowRight size={15} />
              </button>

              {/* Helper links */}
              {mode === 'login' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setMode('verify-code')}
                    className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
                  >
                    Heeft u een verificatiecode ontvangen? <span className="text-brand-400 font-medium">Code invoeren</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {/* 1-Click Demo Studio Button */}
          {mode !== 'update-password' && (
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

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User, BusinessSettings } from './types'
import { settingsApi } from './api'
import { demoStore } from './demoData'
import { supabase, isSupabaseConfigured } from './supabase'

import toast from 'react-hot-toast'

export interface SessionInfo {
  type: 'CLOUD' | 'DEMO' | 'LOCAL'
  status: 'ACTIVE' | 'EXPIRED' | 'REFRESHING'
  lastChecked: Date | null
  expiresAt: Date | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  sessionInfo: SessionInfo
  isRecoveryMode: boolean
  setIsRecoveryMode: (val: boolean) => void
  authError: string | null
  clearAuthError: () => void
  login: (email: string, password: string) => Promise<User>
  registerUser: (name: string, email: string, password: string) => Promise<User>
  completeOnboarding: (companyData: Partial<BusinessSettings>) => Promise<void>
  updateUser: (data: Partial<User>) => void
  loginDemo: () => void
  logout: () => Promise<void>
  refreshSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const ONBOARDING_KEY = 'alibirds_onboarding_status' // tracks per-uid whether onboarding is done
const DEMO_ACTIVE_KEY = 'alibirds_demo_active'
const AUTH_SYNC_KEY = 'alibirds_auth_sync_event'

function broadcastSync(event: { type: 'LOGIN' | 'LOGOUT' | 'REFRESH'; uid?: string; timestamp: number }) {
  try {
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify(event))
  } catch {
    // ignore
  }
}

function cleanupDemoStorage() {
  try {
    localStorage.removeItem('alibirds_invoices')
    localStorage.removeItem('alibirds_clients')
    localStorage.removeItem('alibirds_expenses')
    localStorage.removeItem('alibirds_settings')
    localStorage.removeItem('alibirds_bank')
  } catch {
    // ignore
  }
}

function getOnboardingStatus(uid: string): boolean {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    if (!raw) return false
    const map = JSON.parse(raw)
    return !!map[uid]
  } catch {
    return false
  }
}

function setOnboardingStatus(uid: string, status: boolean) {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[uid] = status
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function supabaseUserToAppUser(sbUser: any, companyName?: string): User {
  const uid = sbUser.id
  const isOnboarded =
    sbUser.user_metadata?.is_onboarded === true ||
    Boolean(sbUser.user_metadata?.company_name) ||
    getOnboardingStatus(uid)
  return {
    id: uid,
    name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Gebruiker',
    email: sbUser.email || '',
    company_name: companyName || sbUser.user_metadata?.company_name || '',
    is_onboarded: isOnboarded,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    type: isSupabaseConfigured() ? 'CLOUD' : 'LOCAL',
    status: 'ACTIVE',
    lastChecked: null,
    expiresAt: null,
  })
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery') ||
        window.location.pathname === '/reset-password'
      )
    }
    return false
  })
  const [authError, setAuthError] = useState<string | null>(null)
  const clearAuthError = useCallback(() => setAuthError(null), [])

  const updateSessionInfoFromSbSession = useCallback((sbSession: any) => {
    if (!sbSession) {
      setSessionInfo({
        type: isSupabaseConfigured() ? 'CLOUD' : 'LOCAL',
        status: 'EXPIRED',
        lastChecked: new Date(),
        expiresAt: null,
      })
      return
    }
    const expiresAt = sbSession.expires_at ? new Date(sbSession.expires_at * 1000) : null
    setSessionInfo({
      type: 'CLOUD',
      status: 'ACTIVE',
      lastChecked: new Date(),
      expiresAt,
    })
  }, [])

  // Helper to ensure onboarding state is synchronized with DB
  const syncOnboardingIfCompleted = async (initialUser: User, sbUser: any): Promise<User> => {
    try {
      const settings = await settingsApi.get()
      if (settings) {
        const resolvedCompanyName = settings.company_name || initialUser.company_name
        const isOnboarded = Boolean(settings.company_name || settings.kvk_number || initialUser.is_onboarded)
        if (isOnboarded) {
          setOnboardingStatus(sbUser.id, true)
        }
        const updated = {
          ...initialUser,
          company_name: resolvedCompanyName,
          is_onboarded: isOnboarded,
        }
        if (resolvedCompanyName && resolvedCompanyName !== sbUser.user_metadata?.company_name) {
          supabase.auth.updateUser({
            data: { is_onboarded: isOnboarded, company_name: resolvedCompanyName },
          }).catch(() => {})
        }
        return updated
      }
    } catch {
      // ignore
    }
    return initialUser
  }

  // Initial load and auth state listener
  useEffect(() => {
    // Check if demo session is active
    const isDemo = localStorage.getItem(DEMO_ACTIVE_KEY) === 'true'
    if (isDemo) {
      setUser({
        id: 'demo-user-id',
        name: 'Ali Demo Studio',
        email: 'demo@alibirds.nl',
        company_name: 'Ali Creative Studio',
        is_onboarded: true,
      })
      setSessionInfo({
        type: 'DEMO',
        status: 'ACTIVE',
        lastChecked: new Date(),
        expiresAt: null,
      })
      setIsLoading(false)
      return
    }

    // Check local session
    const localSession = localStorage.getItem('alibirds_local_session')
    if (localSession && !isSupabaseConfigured()) {
      try {
        const parsed = JSON.parse(localSession)
        setUser(parsed)
        setSessionInfo({
          type: 'LOCAL',
          status: 'ACTIVE',
          lastChecked: new Date(),
          expiresAt: null,
        })
        setIsLoading(false)
        return
      } catch {
        // ignore
      }
    }

    if (!isSupabaseConfigured()) {
      setIsLoading(false)
      return
    }

    // Check for Supabase Auth hash / search parameters (errors or recovery tokens)
    if (window.location.hash || window.location.search) {
      try {
        const raw = (window.location.hash || '').replace(/^#/, '') || (window.location.search || '').replace(/^\?/, '')
        const params = new URLSearchParams(raw)
        const type = params.get('type')
        const errorCode = params.get('error_code')
        const errorDesc = params.get('error_description')

        if (type === 'recovery') {
          setIsRecoveryMode(true)
        }

        if (errorCode || errorDesc) {
          console.warn('Supabase auth URL error detected:', { errorCode, errorDesc })
          if (errorCode === 'otp_expired') {
            setAuthError('otp_expired')
            toast.error(
              'De verificatielink is al geopend of verlopen door uw e-mailscanner. U kunt direct inloggen met uw wachtwoord of een nieuwe code aanvragen.',
              { duration: 8000, id: 'otp-expired' }
            )
          } else {
            toast.error(`Aanmeldingsfout: ${decodeURIComponent(errorDesc || errorCode || '')}`, { duration: 6000 })
          }
          window.history.replaceState(null, '', window.location.pathname)
        }
      } catch {
        // ignore
      }
    }

    // Get session on first render
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        cleanupDemoStorage()
        updateSessionInfoFromSbSession(session)
        const baseUser = supabaseUserToAppUser(session.user)
        const syncedUser = await syncOnboardingIfCompleted(baseUser, session.user)
        setUser(syncedUser)
      } else {
        updateSessionInfoFromSbSession(null)
      }
      setIsLoading(false)
    }).catch(() => {
      setIsLoading(false)
    })

    // Subscribe to future auth events (login, logout, token refresh, password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsRecoveryMode(false)
        updateSessionInfoFromSbSession(null)
      } else if (session?.user) {
        cleanupDemoStorage()
        updateSessionInfoFromSbSession(session)
        const baseUser = supabaseUserToAppUser(session.user)
        const syncedUser = await syncOnboardingIfCompleted(baseUser, session.user)
        setUser(syncedUser)
      } else if (localStorage.getItem(DEMO_ACTIVE_KEY) !== 'true' && !localStorage.getItem('alibirds_local_session')) {
        setUser(null)
        updateSessionInfoFromSbSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [updateSessionInfoFromSbSession])

  // Multi-tab synchronization and active session heartbeat
  useEffect(() => {
    const performHeartbeat = async () => {
      if (localStorage.getItem(DEMO_ACTIVE_KEY) === 'true') {
        setSessionInfo({
          type: 'DEMO',
          status: 'ACTIVE',
          lastChecked: new Date(),
          expiresAt: null,
        })
        return
      }
      if (!isSupabaseConfigured()) return

      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          if (user) {
            setUser(null)
            updateSessionInfoFromSbSession(null)
            toast.error('Uw inlogsessie is verlopen. Log opnieuw in om veilig verder te gaan.', {
              id: 'session-expired-toast',
              duration: 6000,
            })
          }
        } else {
          updateSessionInfoFromSbSession(session)
        }
      } catch {
        // ignore network dropouts
      }
    }

    // Periodic heartbeat check every 4 minutes
    const interval = setInterval(performHeartbeat, 4 * 60 * 1000)

    // Visibility / focus change listener: wake up immediately when returning to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        performHeartbeat()
      }
    }
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    // Cross-tab storage synchronization
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === AUTH_SYNC_KEY && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue)
          if (payload.type === 'LOGOUT') {
            setUser(null)
            updateSessionInfoFromSbSession(null)
            toast('U bent uitgelogd in een ander tabblad', { icon: '🔒', id: 'tab-logout' })
          } else if (payload.type === 'LOGIN') {
            performHeartbeat()
          }
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [user, updateSessionInfoFromSbSession])

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (localStorage.getItem(DEMO_ACTIVE_KEY) === 'true') {
      setSessionInfo({
        type: 'DEMO',
        status: 'ACTIVE',
        lastChecked: new Date(),
        expiresAt: null,
      })
      toast.success('Demo sessie is geverifieerd.', { id: 'demo-refresh' })
      return true
    }

    if (!isSupabaseConfigured()) {
      setSessionInfo({
        type: 'LOCAL',
        status: 'ACTIVE',
        lastChecked: new Date(),
        expiresAt: null,
      })
      toast.success('Lokale sessie is actief.', { id: 'local-refresh' })
      return true
    }

    try {
      setSessionInfo(prev => ({ ...prev, status: 'REFRESHING' }))
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) {
        toast.error('Sessie kon niet worden vernieuwd. Log opnieuw in.')
        setUser(null)
        updateSessionInfoFromSbSession(null)
        broadcastSync({ type: 'LOGOUT', timestamp: Date.now() })
        return false
      }

      updateSessionInfoFromSbSession(data.session)
      const baseUser = supabaseUserToAppUser(data.session.user)
      const syncedUser = await syncOnboardingIfCompleted(baseUser, data.session.user)
      setUser(syncedUser)
      toast.success('Sessie succesvol vernieuwd en beveiligd!', { id: 'session-refreshed' })
      return true
    } catch {
      toast.error('Fout bij vernieuwen van sessie')
      return false
    }
  }, [updateSessionInfoFromSbSession])

  const loginDemo = useCallback(() => {
    localStorage.setItem(DEMO_ACTIVE_KEY, 'true')
    const demoUser: User = {
      id: 'demo-user-id',
      name: 'Ali Demo Studio',
      email: 'demo@alibirds.nl',
      company_name: 'Ali Creative Studio',
      is_onboarded: true,
    }
    setUser(demoUser)
    setSessionInfo({
      type: 'DEMO',
      status: 'ACTIVE',
      lastChecked: new Date(),
      expiresAt: null,
    })
    broadcastSync({ type: 'LOGIN', uid: demoUser.id, timestamp: Date.now() })
    toast.success('Welkom in de Demo Studio!')
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    localStorage.removeItem(DEMO_ACTIVE_KEY)
    if (isSupabaseConfigured()) {
      cleanupDemoStorage()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      if (data.session) {
        updateSessionInfoFromSbSession(data.session)
      }
      const baseUser = supabaseUserToAppUser(data.user)
      const syncedUser = await syncOnboardingIfCompleted(baseUser, data.user)
      setUser(syncedUser)
      broadcastSync({ type: 'LOGIN', uid: data.user.id, timestamp: Date.now() })
      return syncedUser
    } else {
      // Seamless zero-friction session
      const saved = localStorage.getItem('alibirds_local_session')
      let localUser: User
      if (saved) {
        try {
          localUser = JSON.parse(saved)
        } catch {
          localUser = {
            id: 'local_' + btoa(email).slice(0, 12),
            name: email.split('@')[0],
            email: email,
            company_name: 'Mijn ZZP Studio',
            is_onboarded: true,
          }
        }
      } else {
        localUser = {
          id: 'local_' + btoa(email).slice(0, 12),
          name: email.split('@')[0],
          email: email,
          company_name: 'Mijn ZZP Studio',
          is_onboarded: true,
        }
      }
      localStorage.setItem('alibirds_local_session', JSON.stringify(localUser))
      setUser(localUser)
      setSessionInfo({
        type: 'LOCAL',
        status: 'ACTIVE',
        lastChecked: new Date(),
        expiresAt: null,
      })
      broadcastSync({ type: 'LOGIN', uid: localUser.id, timestamp: Date.now() })
      return localUser
    }
  }, [updateSessionInfoFromSbSession])

  const registerUser = useCallback(async (name: string, email: string, password: string): Promise<User> => {
    localStorage.removeItem(DEMO_ACTIVE_KEY)
    cleanupDemoStorage()
    if (isSupabaseConfigured()) {
      const redirectUrl = `${window.location.origin}/`
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: redirectUrl,
        },
      })
      if (error) throw new Error(error.message)
      if (!data.user) throw new Error('Registratie mislukt. Probeer het opnieuw.')

      const appUser = supabaseUserToAppUser(data.user)
      // Only set user if session is established immediately (e.g. email confirm disabled)
      if (data.session) {
        updateSessionInfoFromSbSession(data.session)
        setUser(appUser)
        broadcastSync({ type: 'LOGIN', uid: data.user.id, timestamp: Date.now() })
      }
      return appUser
    } else {
      // Seamless zero-friction registration
      const localUser: User = {
        id: 'local_' + btoa(email).slice(0, 12),
        name: name,
        email: email,
        company_name: '',
        is_onboarded: false,
      }
      localStorage.setItem('alibirds_local_session', JSON.stringify(localUser))
      setUser(localUser)
      setSessionInfo({
        type: 'LOCAL',
        status: 'ACTIVE',
        lastChecked: new Date(),
        expiresAt: null,
      })
      broadcastSync({ type: 'LOGIN', uid: localUser.id, timestamp: Date.now() })
      return localUser
    }
  }, [updateSessionInfoFromSbSession])

  const completeOnboarding = useCallback(async (companyData: Partial<BusinessSettings>): Promise<void> => {
    if (!user) return

    // Save business profile to Supabase (or local fallback)
    await settingsApi.update(companyData)

    // Update Supabase user metadata with company name & is_onboarded flag
    if (isSupabaseConfigured()) {
      await supabase.auth.updateUser({
        data: {
          company_name: companyData.company_name,
          trade_name: companyData.trade_name,
          payment_link: companyData.payment_link,
          invoice_notes_default: companyData.invoice_notes_default,
          is_onboarded: true,
        },
      })
    }

    // Persist onboarding completion for this user
    setOnboardingStatus(user.id, true)

    const updatedUser: User = {
      ...user,
      company_name: companyData.company_name || user.company_name,
      is_onboarded: true,
    }
    setUser(updatedUser)
  }, [user])

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null
      return { ...prev, ...data }
    })
    try {
      const local = localStorage.getItem('alibirds_local_session')
      if (local) {
        const parsed = JSON.parse(local)
        localStorage.setItem('alibirds_local_session', JSON.stringify({ ...parsed, ...data }))
      }
    } catch {
      // ignore
    }
    if (isSupabaseConfigured()) {
      const metadataUpdates: Record<string, any> = {}
      if (data.company_name !== undefined) metadataUpdates.company_name = data.company_name
      if (data.name !== undefined) metadataUpdates.full_name = data.name
      if (Object.keys(metadataUpdates).length > 0) {
        supabase.auth.updateUser({ data: metadataUpdates }).catch(() => {})
      }
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    localStorage.removeItem(DEMO_ACTIVE_KEY)
    localStorage.removeItem('alibirds_local_session')
    broadcastSync({ type: 'LOGOUT', timestamp: Date.now() })
    setIsRecoveryMode(false)
    setAuthError(null)
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.warn('SignOut error:', err)
    } finally {
      setUser(null)
      updateSessionInfoFromSbSession(null)
      toast.success('U bent uitgelogd.')
    }
  }, [updateSessionInfoFromSbSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        sessionInfo,
        isRecoveryMode,
        setIsRecoveryMode,
        authError,
        clearAuthError,
        login,
        registerUser,
        completeOnboarding,
        updateUser,
        loginDemo,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

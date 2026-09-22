import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User, BusinessSettings } from './types'
import { settingsApi } from './api'
import { demoStore } from './demoData'
import { supabase, isSupabaseConfigured } from './supabase'

import toast from 'react-hot-toast'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  registerUser: (name: string, email: string, password: string) => Promise<User>
  completeOnboarding: (companyData: Partial<BusinessSettings>) => Promise<void>
  updateUser: (data: Partial<User>) => void
  loginDemo: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const ONBOARDING_KEY = 'alibirds_onboarding_status' // tracks per-uid whether onboarding is done
const DEMO_ACTIVE_KEY = 'alibirds_demo_active'

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

  // Listen to Supabase auth state changes — fires on login, logout, token refresh, and page load
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
      setIsLoading(false)
      return
    }

    // Check local session
    const localSession = localStorage.getItem('alibirds_local_session')
    if (localSession && !isSupabaseConfigured()) {
      try {
        const parsed = JSON.parse(localSession)
        setUser(parsed)
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

    // Check for Supabase Auth hash errors (e.g. #error=access_denied&error_code=otp_expired)
    if (window.location.hash) {
      try {
        const hash = window.location.hash.replace(/^#/, '')
        const params = new URLSearchParams(hash)
        const errorCode = params.get('error_code')
        const errorDesc = params.get('error_description')

        if (errorCode || errorDesc) {
          console.warn('Supabase auth URL error detected:', { errorCode, errorDesc })
          if (errorCode === 'otp_expired') {
            toast.error(
              'De bevestigingslink is verlopen of al geopend door uw e-mailfilter. U kunt direct inloggen met uw wachtwoord of een nieuwe link aanvragen.',
              { duration: 8000 }
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
        const baseUser = supabaseUserToAppUser(session.user)
        const syncedUser = await syncOnboardingIfCompleted(baseUser, session.user)
        setUser(syncedUser)
      }
      setIsLoading(false)
    }).catch(() => {
      setIsLoading(false)
    })

    // Subscribe to future auth events (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        cleanupDemoStorage()
        const baseUser = supabaseUserToAppUser(session.user)
        const syncedUser = await syncOnboardingIfCompleted(baseUser, session.user)
        setUser(syncedUser)
      } else if (localStorage.getItem(DEMO_ACTIVE_KEY) !== 'true' && !localStorage.getItem('alibirds_local_session')) {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loginDemo = useCallback(() => {
    localStorage.setItem(DEMO_ACTIVE_KEY, 'true')
    setUser({
      id: 'demo-user-id',
      name: 'Ali Demo Studio',
      email: 'demo@alibirds.nl',
      company_name: 'Ali Creative Studio',
      is_onboarded: true,
    })
    toast.success('Welkom in de Demo Studio!')
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    localStorage.removeItem(DEMO_ACTIVE_KEY)
    if (isSupabaseConfigured()) {
      cleanupDemoStorage()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      const baseUser = supabaseUserToAppUser(data.user)
      const syncedUser = await syncOnboardingIfCompleted(baseUser, data.user)
      setUser(syncedUser)
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
      return localUser
    }
  }, [])

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
        setUser(appUser)
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
      return localUser
    }
  }, [])

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
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.warn('SignOut error:', err)
    } finally {
      setUser(null)
      toast.success('U bent uitgelogd.')
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, registerUser, completeOnboarding, updateUser, loginDemo, logout }}>
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

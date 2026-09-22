import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { User, BusinessSettings } from './types'
import { settingsApi } from './api'
import { demoStore } from './demoData'
import {
  isSupabaseConfigured,
  supabaseAuth,
  setSupabaseSessionToken,
  saveSupabaseConfig,
  SupabaseConfig,
} from './supabase'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  loginAsDemo: () => Promise<User>
  registerUser: (name: string, email: string, password: string) => Promise<User>
  completeOnboarding: (companyData: Partial<BusinessSettings>) => Promise<void>
  syncSession: (syncData: { user: User; token?: string; supabaseConfig?: SupabaseConfig }) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_STORAGE_KEY = 'alibirds_session_user'
const USERS_STORAGE_KEY = 'alibirds_registered_users'

const DEFAULT_DEMO_USER: User = {
  id: 'usr_demo',
  name: 'Ali Panahi',
  email: 'ali@alibirds-studio.nl',
  company_name: 'Ali Creative Studio',
  is_onboarded: true,
}

/**
 * Checks whether the business profile already exists in the connected database
 * (Supabase, FastAPI backend, or local store). If company details already exist,
 * automatically marks the user as onboarded so they are not forced to enter
 * their details again when logging in on a new device (e.g. mobile phone).
 */
async function detectExistingOnboarding(baseUser: User): Promise<User> {
  try {
    const settings = await settingsApi.get()
    if (settings && settings.company_name && settings.company_name.trim().length > 0) {
      const hasBusinessDetails = !!(
        settings.kvk_number ||
        settings.btw_id ||
        settings.iban ||
        settings.address_street
      )
      if (hasBusinessDetails || baseUser.is_onboarded) {
        return {
          ...baseUser,
          company_name: settings.company_name || baseUser.company_name,
          is_onboarded: true,
        }
      }
    }
  } catch (err) {
    console.warn('Could not check existing business settings:', err)
  }
  return baseUser
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedSession = localStorage.getItem(AUTH_STORAGE_KEY)
        if (storedSession) {
          const parsed = JSON.parse(storedSession) as User
          const active = await detectExistingOnboarding(parsed)
          setUser(active)
          setToken('token_' + active.id)
          if (active.is_onboarded !== parsed.is_onboarded || active.company_name !== parsed.company_name) {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(active))
          }
        } else {
          setUser(null)
          setToken(null)
        }
      } catch {
        setUser(null)
        setToken(null)
      } finally {
        setIsLoading(false)
      }
    }
    initAuth()
  }, [])

  const getRegisteredUsers = (): Array<User & { password?: string }> => {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY)
      if (!raw) {
        const initial = [{ ...DEFAULT_DEMO_USER, password: 'password123' }]
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial))
        return initial
      }
      return JSON.parse(raw)
    } catch {
      return [{ ...DEFAULT_DEMO_USER, password: 'password123' }]
    }
  }

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true)
    const emailClean = email.trim().toLowerCase()

    try {
      // 1. Try Supabase Auth if Supabase is configured
      if (isSupabaseConfigured()) {
        try {
          const authRes = await supabaseAuth.signInWithPassword(emailClean, password)
          if (authRes && authRes.user) {
            const rawUser: User = {
              id: authRes.user.id,
              name: authRes.user.user_metadata?.name || authRes.user.email?.split('@')[0] || 'Ondernemer',
              email: authRes.user.email || emailClean,
              company_name: authRes.user.user_metadata?.company_name || '',
              is_onboarded: authRes.user.user_metadata?.is_onboarded || false,
            }
            const activeUser = await detectExistingOnboarding(rawUser)
            setUser(activeUser)
            setToken('supa_' + (authRes.access_token || activeUser.id))
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
            return activeUser
          }
        } catch (supaErr: any) {
          const msg = supaErr.response?.data?.error_description || supaErr.response?.data?.msg || supaErr.message
          if (msg && (msg.includes('Invalid login') || msg.includes('Email not confirmed'))) {
            throw new Error(msg.includes('Invalid login') ? 'Onjuist e-mailadres of wachtwoord.' : msg)
          }
        }
      }

      // 2. Try FastAPI Backend if available
      try {
        const backendRes = await axios.post('/api/auth/login', { email: emailClean, password }, { timeout: 3000 })
        if (backendRes.data && backendRes.data.user) {
          const bUser = backendRes.data.user
          const rawUser: User = {
            id: bUser.id,
            name: bUser.name,
            email: bUser.email,
            company_name: bUser.company_name || '',
            is_onboarded: bUser.is_onboarded ?? false,
          }
          const activeUser = await detectExistingOnboarding(rawUser)
          setUser(activeUser)
          setToken(backendRes.data.access_token || 'token_' + activeUser.id)
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
          return activeUser
        }
      } catch (backendErr: any) {
        if (backendErr.response?.status === 401 || backendErr.response?.status === 400) {
          throw new Error(backendErr.response?.data?.detail || 'Onjuist e-mailadres of wachtwoord.')
        }
      }

      // 3. Fallback: Local Storage Registry (Demo / Offline mode)
      const users = getRegisteredUsers()
      const found = users.find(u => u.email.toLowerCase() === emailClean)

      if (!found || (found.password && found.password !== password && password !== 'demo')) {
        throw new Error('Onjuist e-mailadres of wachtwoord.')
      }

      const rawUser: User = {
        id: found.id,
        name: found.name,
        email: found.email,
        company_name: found.company_name,
        is_onboarded: found.is_onboarded ?? false,
      }

      const activeUser = await detectExistingOnboarding(rawUser)
      setUser(activeUser)
      setToken('token_' + activeUser.id)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
      return activeUser
    } finally {
      setIsLoading(false)
    }
  }

  const loginAsDemo = async (): Promise<User> => {
    const active = await detectExistingOnboarding(DEFAULT_DEMO_USER)
    setUser(active)
    setToken('token_demo')
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(active))
    return active
  }

  const registerUser = async (name: string, email: string, password: string): Promise<User> => {
    setIsLoading(true)
    const emailClean = email.trim().toLowerCase()

    try {
      // 1. Try Supabase Auth if Supabase is configured
      if (isSupabaseConfigured()) {
        try {
          const authRes = await supabaseAuth.signUp(name, emailClean, password)
          if (authRes && authRes.user) {
            const rawUser: User = {
              id: authRes.user.id,
              name,
              email: emailClean,
              company_name: '',
              is_onboarded: false,
            }
            const activeUser = await detectExistingOnboarding(rawUser)
            setUser(activeUser)
            setToken('supa_' + (authRes.access_token || activeUser.id))
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
            return activeUser
          }
        } catch (supaErr: any) {
          const msg = supaErr.response?.data?.error_description || supaErr.response?.data?.msg || supaErr.message
          if (msg) throw new Error(msg)
        }
      }

      // 2. Try FastAPI Backend if available
      try {
        const backendRes = await axios.post('/api/auth/register', { name, email: emailClean, password }, { timeout: 3000 })
        if (backendRes.data && backendRes.data.user) {
          const bUser = backendRes.data.user
          const rawUser: User = {
            id: bUser.id,
            name: bUser.name,
            email: bUser.email,
            company_name: bUser.company_name || '',
            is_onboarded: bUser.is_onboarded ?? false,
          }
          const activeUser = await detectExistingOnboarding(rawUser)
          setUser(activeUser)
          setToken(backendRes.data.access_token || 'token_' + activeUser.id)
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
          return activeUser
        }
      } catch (backendErr: any) {
        if (backendErr.response?.data?.detail) {
          throw new Error(backendErr.response.data.detail)
        }
      }

      // 3. Fallback: Local Storage Registry
      const users = getRegisteredUsers()
      if (users.some(u => u.email.toLowerCase() === emailClean)) {
        throw new Error('Er bestaat al een account met dit e-mailadres.')
      }

      const rawUser = {
        id: `usr_${Date.now()}`,
        name,
        email: emailClean,
        password,
        company_name: '',
        is_onboarded: false,
      }

      users.push(rawUser)
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))

      const activeUser = await detectExistingOnboarding({
        id: rawUser.id,
        name: rawUser.name,
        email: rawUser.email,
        company_name: '',
        is_onboarded: false,
      })

      setUser(activeUser)
      setToken('token_' + activeUser.id)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
      return activeUser
    } finally {
      setIsLoading(false)
    }
  }

  const completeOnboarding = async (companyData: Partial<BusinessSettings>): Promise<void> => {
    if (!user) return

    // Save business profile
    await settingsApi.update(companyData)
    demoStore.saveSettings(companyData)

    // Update user onboarding status
    const updatedUser: User = {
      ...user,
      company_name: companyData.company_name || user.company_name,
      is_onboarded: true,
    }

    const users = getRegisteredUsers()
    const idx = users.findIndex(u => u.id === user.id)
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updatedUser }
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
    }

    setUser(updatedUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser))
  }

  const syncSession = async (syncData: {
    user: User
    token?: string
    supabaseConfig?: SupabaseConfig
  }): Promise<User> => {
    setIsLoading(true)
    try {
      if (syncData.supabaseConfig?.url && syncData.supabaseConfig?.anonKey) {
        saveSupabaseConfig(syncData.supabaseConfig.url, syncData.supabaseConfig.anonKey)
      }
      if (syncData.token) {
        setSupabaseSessionToken(syncData.token)
      }
      const activeUser = await detectExistingOnboarding(syncData.user)
      setUser(activeUser)
      setToken(syncData.token || 'token_' + activeUser.id)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
      return activeUser
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    supabaseAuth.signOut().catch(() => {})
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        loginAsDemo,
        registerUser,
        completeOnboarding,
        syncSession,
        logout,
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


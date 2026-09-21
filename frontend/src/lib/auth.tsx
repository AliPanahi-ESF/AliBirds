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
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const ONBOARDING_KEY = 'alibirds_onboarding_status' // tracks per-uid whether onboarding is done

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
  const isOnboarded = getOnboardingStatus(uid)
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

  // Listen to Supabase auth state changes — fires on login, logout, token refresh, and page load
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // No Supabase configured — app will work in local demo mode only
      setIsLoading(false)
      return
    }

    // Get session on first render
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(supabaseUserToAppUser(session.user))
      }
      setIsLoading(false)
    })

    // Subscribe to future auth events (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(supabaseUserToAppUser(session.user))
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is niet geconfigureerd. Neem contact op met de beheerder.')
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    const appUser = supabaseUserToAppUser(data.user)
    setUser(appUser)
    return appUser
  }, [])

  const registerUser = useCallback(async (name: string, email: string, password: string): Promise<User> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is niet geconfigureerd. Neem contact op met de beheerder.')
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Registratie mislukt. Probeer het opnieuw.')

    const appUser = supabaseUserToAppUser(data.user)
    setUser(appUser)
    return appUser
  }, [])

  const completeOnboarding = useCallback(async (companyData: Partial<BusinessSettings>): Promise<void> => {
    if (!user) return

    // Save business profile to Supabase (or local fallback)
    await settingsApi.update(companyData)
    demoStore.saveSettings(companyData)

    // Update Supabase user metadata with company name
    if (isSupabaseConfigured()) {
      await supabase.auth.updateUser({
        data: { company_name: companyData.company_name },
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

  const logout = useCallback(async (): Promise<void> => {
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
    <AuthContext.Provider value={{ user, isLoading, login, registerUser, completeOnboarding, logout }}>
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

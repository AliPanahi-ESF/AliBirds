import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, BusinessSettings } from './types'
import { settingsApi } from './api'
import { demoStore } from './demoData'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  loginAsDemo: () => Promise<User>
  registerUser: (name: string, email: string, password: string) => Promise<User>
  completeOnboarding: (companyData: Partial<BusinessSettings>) => Promise<void>
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const storedSession = localStorage.getItem(AUTH_STORAGE_KEY)
      if (storedSession) {
        const parsed = JSON.parse(storedSession) as User
        setUser(parsed)
        setToken('token_' + parsed.id)
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
    try {
      const users = getRegisteredUsers()
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase())

      if (!found || (found.password && found.password !== password && password !== 'demo')) {
        throw new Error('Onjuist e-mailadres of wachtwoord.')
      }

      const activeUser: User = {
        id: found.id,
        name: found.name,
        email: found.email,
        company_name: found.company_name,
        is_onboarded: found.is_onboarded ?? false,
      }

      setUser(activeUser)
      setToken('token_' + activeUser.id)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(activeUser))
      return activeUser
    } finally {
      setIsLoading(false)
    }
  }

  const loginAsDemo = async (): Promise<User> => {
    setUser(DEFAULT_DEMO_USER)
    setToken('token_demo')
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_DEMO_USER))
    return DEFAULT_DEMO_USER
  }

  const registerUser = async (name: string, email: string, password: string): Promise<User> => {
    setIsLoading(true)
    try {
      const users = getRegisteredUsers()
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('Er bestaat al een account met dit e-mailadres.')
      }

      const newUser = {
        id: `usr_${Date.now()}`,
        name,
        email,
        password,
        company_name: '',
        is_onboarded: false,
      }

      users.push(newUser)
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))

      const activeUser: User = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        company_name: '',
        is_onboarded: false,
      }

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

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
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

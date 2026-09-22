import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'
import MobileHeader from '@/components/MobileHeader'
import BottomNav from '@/components/BottomNav'

// Lazy-loaded routes for optimal bundle code-splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const InvoiceList = lazy(() => import('@/pages/InvoiceList'))
const InvoiceEditor = lazy(() => import('@/pages/InvoiceEditor'))
const Clients = lazy(() => import('@/pages/Clients'))
const BankReconciliation = lazy(() => import('@/pages/BankReconciliation'))
const TaxReturn = lazy(() => import('@/pages/TaxReturn'))
const Expenses = lazy(() => import('@/pages/Expenses'))
const RecurringSchedules = lazy(() => import('@/pages/RecurringSchedules'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const AuthPage = lazy(() => import('@/pages/Auth'))
const OnboardingPage = lazy(() => import('@/pages/Onboarding'))

function PageFallback() {
  return (
    <div className="space-y-4 animate-pulse max-w-5xl py-4" role="status" aria-label="Pagina laden...">
      <div className="h-8 w-48 bg-slate-800/80 rounded-lg" />
      <div className="h-4 w-72 bg-slate-800/50 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <div className="h-24 bg-slate-900 border border-slate-800/60 rounded-xl" />
        <div className="h-24 bg-slate-900 border border-slate-800/60 rounded-xl" />
        <div className="h-24 bg-slate-900 border border-slate-800/60 rounded-xl" />
      </div>
      <div className="h-64 bg-slate-900 border border-slate-800/60 rounded-xl mt-4" />
    </div>
  )
}

function AppContent() {
  const { user, isLoading, isRecoveryMode } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-300">AliBirds laden...</span>
        </div>
      </div>
    )
  }

  // Password Recovery Mode: Render AuthPage with update-password form
  if (isRecoveryMode) {
    return (
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <Routes>
          <Route path="*" element={<AuthPage initialMode="update-password" />} />
        </Routes>
      </Suspense>
    )
  }

  // Not logged in: route exclusively to Auth page (Login / Register / 1-Click Demo)
  if (!user) {
    return (
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Suspense>
    )
  }

  // Logged in, but company profile onboarding not yet completed:
  if (!user.is_onboarded) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </Suspense>
    )
  }

  // If already logged in & onboarded, redirect away from /auth or /onboarding to dashboard
  if (location.pathname === '/auth' || location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }

  // Main application layout with Sidebar, Mobile Header & Bottom Navigation
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 flex-col md:flex-row">
      {/* Responsive Sidebar (off-canvas drawer on mobile, fixed left on desktop) */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Mobile Sticky Header */}
      <MobileHeader onOpenMenu={() => setMobileMenuOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-[260px] min-h-[calc(100vh-3.5rem)] md:min-h-screen pb-20 md:pb-8">
        <div className="p-3.5 sm:p-5 md:p-8 max-w-[1800px] mx-auto w-full animate-fade-in">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/invoices" element={<InvoiceList />} />
              <Route path="/invoices/new" element={<InvoiceEditor />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/bank" element={<BankReconciliation />} />
              <Route path="/tax" element={<TaxReturn />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/recurring" element={<RecurringSchedules />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {/* Mobile Phone Bottom Navigation */}
      <BottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

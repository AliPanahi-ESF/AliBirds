import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'
import MobileHeader from '@/components/MobileHeader'
import BottomNav from '@/components/BottomNav'
import Dashboard from '@/pages/Dashboard'
import InvoiceList from '@/pages/InvoiceList'
import InvoiceEditor from '@/pages/InvoiceEditor'
import Clients from '@/pages/Clients'
import BankReconciliation from '@/pages/BankReconciliation'
import TaxReturn from '@/pages/TaxReturn'
import Expenses from '@/pages/Expenses'
import RecurringSchedules from '@/pages/RecurringSchedules'
import SettingsPage from '@/pages/Settings'
import AuthPage from '@/pages/Auth'
import OnboardingPage from '@/pages/Onboarding'

function AppContent() {
  const { user, isLoading } = useAuth()
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

  // Not logged in: route exclusively to Auth page (Login / Register / 1-Click Demo)
  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  // Logged in, but company profile onboarding not yet completed:
  if (!user.is_onboarded) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
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
        <div className="p-3.5 sm:p-5 md:p-8 max-w-7xl mx-auto w-full animate-fade-in">
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

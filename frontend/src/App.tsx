import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <BrowserRouter>
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
            </Routes>
          </div>
        </main>

        {/* Mobile Phone Bottom Navigation */}
        <BottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
      </div>
    </BrowserRouter>
  )
}

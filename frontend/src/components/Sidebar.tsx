import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Users, Building2,
  RefreshCw, Receipt, Settings, TrendingUp,
  Bird, ChevronRight, X, LogOut
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/lib/auth'

export const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices',    icon: FileText,        label: 'Facturen' },
  { to: '/clients',     icon: Users,           label: 'Klanten' },
  { to: '/bank',        icon: Building2,       label: 'Bankafschriften' },
  { to: '/tax',         icon: TrendingUp,      label: 'Btw-aangifte' },
  { to: '/expenses',    icon: Receipt,         label: 'Kosten' },
  { to: '/recurring',   icon: RefreshCw,       label: 'Herhaalfacturen' },
  { to: '/settings',    icon: Settings,        label: 'Instellingen' },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full w-[260px] bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        )}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
              <Bird className="w-4.5 h-4.5 text-white" size={18} />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-sm leading-none">AliBirds</div>
              <div className="text-[10px] text-slate-400 mt-0.5">ZZP Boekhouding</div>
            </div>
          </div>

          {/* Mobile close button */}
   
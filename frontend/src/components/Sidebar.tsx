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
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Sluit menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                className={clsx(
                  'nav-item group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                  active
                    ? 'bg-brand-600/15 text-brand-400 font-medium'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                )}
              >
                <Icon size={18} className={clsx('shrink-0', active ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300')} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-brand-400" />}
              </Link>
            )
          })}
        </nav>

        {/* User profile & logout footer */}
        {user ? (
          <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-brand-600/25 border border-brand-500/40 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
                {user.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-200 truncate">{user.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{user.company_name || 'ZZP Studio'}</div>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Uitloggen"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="p-3 border-t border-slate-800 bg-slate-900/50">
            <Link
              to="/auth"
              onClick={onClose}
              className="w-full btn-primary justify-center text-xs py-1.5"
            >
              Inloggen
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}

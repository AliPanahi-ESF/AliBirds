import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, FileCheck, Users, Building2,
  RefreshCw, Receipt, Settings, TrendingUp,
  Bird, ChevronRight, X, LogOut
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/lib/api'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { triggerHaptic } from '@/lib/haptics'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const { user, logout, sessionInfo } = useAuth()
  const { t } = useI18n()

  const navItems = [
    { to: '/',            icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard') },
    { to: '/invoices',    icon: FileText,        label: t('nav.invoices', 'Facturen') },
    { to: '/quotations',  icon: FileCheck,       label: t('nav.quotations', 'Offertes') },
    { to: '/clients',     icon: Users,           label: t('nav.clients', 'Klanten') },
    { to: '/bank',        icon: Building2,       label: t('nav.bank', 'Bankafschriften') },
    { to: '/tax',         icon: TrendingUp,      label: t('nav.tax', 'Btw-aangifte') },
    { to: '/expenses',    icon: Receipt,         label: t('nav.expenses', 'Kosten') },
    { to: '/recurring',   icon: RefreshCw,       label: t('nav.recurring', 'Herhaalfacturen') },
    { to: '/settings',    icon: Settings,        label: t('nav.settings', 'Instellingen') },
  ]

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    enabled: !!user,
  })

  const companyDisplayName = settings?.company_name || user?.company_name || 'ZZP Studio'
  const userInitial = user?.name ? user.name[0].toUpperCase() : (companyDisplayName ? companyDisplayName[0].toUpperCase() : 'A')

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => {
            triggerHaptic('light')
            onClose?.()
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full w-[280px] sm:w-[260px] bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        )}
      >
        {/* Header / Logo with safe-area-pt strictly clearing iOS notch / dynamic island */}
        <div className="flex flex-col border-b border-slate-800 safe-area-pt md:pt-0 bg-slate-900/95">
          <div className="flex items-center justify-between px-3.5 h-14 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-600/30 shrink-0 border border-white/20">
                <Bird className="w-4.5 h-4.5 text-white" size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-100 text-sm leading-none">AliBirds</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{t('app.tagline', 'ZZP Boekhouding')}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LanguageSwitcher variant="compact" />
              {/* Mobile close button with min 40px touch target & haptic */}
              <button
                onClick={() => {
                  triggerHaptic('light')
                  onClose?.()
                }}
                className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95 cursor-pointer"
                aria-label={t('nav.close_menu', 'Sluit menu')}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 touch-pan-y">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                onClick={() => {
                  triggerHaptic('selection')
                  onClose?.()
                }}
                className={clsx(
                  'nav-item group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all min-h-[44px]',
                  active
                    ? 'bg-brand-600/20 text-brand-300 font-semibold border border-brand-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 active:bg-slate-800'
                )}
              >
                <Icon size={18} className={clsx('shrink-0', active ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300')} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-brand-400" />}
              </Link>
            )
          })}
        </nav>

        {/* User profile & logout footer with safe-area-pb */}
        {user ? (
          <div className="p-3 border-t border-slate-800 bg-slate-900/95 space-y-2.5 safe-area-pb md:pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-brand-600/25 border border-brand-500/40 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-200 truncate">{user.name}</div>
                <div className="text-[10px] text-slate-400 truncate" title={companyDisplayName}>{companyDisplayName}</div>
              </div>
            </div>
            {/* Live session status indicator */}
            <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    sessionInfo.type === 'CLOUD'
                      ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                      : 'bg-amber-400'
                  )}
                />
                <span className="text-[10px] font-mono text-slate-300 truncate">
                  {sessionInfo.type === 'CLOUD'
                    ? t('app.cloud_session', 'Cloud Sessie Actief')
                    : sessionInfo.type === 'DEMO'
                    ? t('app.demo_session', 'Demo Sessie')
                    : t('app.local_session', 'Lokale Sessie')}
                </span>
              </div>
              <span className="text-[9px] font-mono text-slate-500 uppercase">{t('app.secured', 'Beveiligd')}</span>
            </div>
            <button
              onClick={() => {
                triggerHaptic('warning')
                onClose?.()
                logout()
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all active:scale-98 min-h-[40px] cursor-pointer"
            >
              <LogOut size={14} />
              <span>{t('nav.logout', 'Uitloggen')}</span>
            </button>
          </div>
        ) : (
          <div className="p-3 border-t border-slate-800 bg-slate-900/50 safe-area-pb md:pb-3">
            <Link
              to="/auth"
              onClick={() => {
                triggerHaptic('light')
                onClose?.()
              }}
              className="w-full btn-primary justify-center text-xs py-2 min-h-[40px]"
            >
              {t('nav.login', 'Inloggen')}
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, TrendingUp, Receipt, Menu } from 'lucide-react'
import { clsx } from 'clsx'
import { useI18n } from '@/lib/i18n'
import { triggerHaptic } from '@/lib/haptics'

interface BottomNavProps {
  onOpenMenu: () => void
}

export default function BottomNav({ onOpenMenu }: BottomNavProps) {
  const { pathname } = useLocation()
  const { t } = useI18n()

  const tabs = [
    { to: '/',         icon: LayoutDashboard, label: t('nav.overview', 'Overzicht') },
    { to: '/invoices', icon: FileText,        label: t('nav.invoices', 'Facturen') },
    { to: '/tax',      icon: TrendingUp,      label: t('nav.tax', 'Btw') },
    { to: '/expenses', icon: Receipt,         label: t('nav.expenses', 'Kosten') },
  ]

  return (
    <nav
      aria-label="Mobiele navigatie"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 liquid-glass-dock safe-area-pb select-none"
    >
      <div className="grid grid-cols-5 h-[60px] items-center px-1.5 max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => triggerHaptic('selection')}
              className={clsx(
                'relative flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation',
                active
                  ? 'text-brand-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              )}
            >
              {active && (
                <span className="absolute -top-1 w-6 h-0.5 rounded-full bg-gradient-to-r from-brand-500 to-indigo-400 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
              <div
                className={clsx(
                  'w-9 h-8 rounded-xl flex items-center justify-center transition-all duration-200',
                  active ? 'bg-brand-500/15 text-brand-400 shadow-sm' : 'text-slate-400'
                )}
              >
                <Icon size={19} className={clsx(active ? 'text-brand-400 scale-105' : 'text-slate-400')} />
              </div>
              <span className="text-[10px] tracking-tight leading-none font-medium">{label}</span>
            </Link>
          )
        })}

        {/* Menu toggle button */}
        <button
          onClick={() => {
            triggerHaptic('light')
            onOpenMenu()
          }}
          className="flex flex-col items-center justify-center gap-1 py-1 px-1 text-slate-400 hover:text-slate-200 active:scale-95 transition-all select-none touch-manipulation cursor-pointer"
          aria-label="Open menu"
        >
          <div className="w-9 h-8 rounded-xl flex items-center justify-center hover:bg-white/[0.04] transition-colors">
            <Menu size={19} />
          </div>
          <span className="text-[10px] tracking-tight leading-none font-medium">Menu</span>
        </button>
      </div>
    </nav>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, TrendingUp, Receipt, Menu } from 'lucide-react'
import { clsx } from 'clsx'

interface BottomNavProps {
  onOpenMenu: () => void
}

export default function BottomNav({ onOpenMenu }: BottomNavProps) {
  const { pathname } = useLocation()

  const tabs = [
    { to: '/',         icon: LayoutDashboard, label: 'Overzicht' },
    { to: '/invoices', icon: FileText,        label: 'Facturen' },
    { to: '/tax',      icon: TrendingUp,      label: 'Btw' },
    { to: '/expenses', icon: Receipt,         label: 'Kosten' },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 safe-area-pb">
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 py-1 px-0.5 transition-colors',
                active ? 'text-brand-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon size={20} className={active ? 'text-brand-400' : 'text-slate-400'} />
              <span className="text-[10px] tracking-tight">{label}</span>
            </Link>
          )
        })}

        {/* Menu toggle button */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-1 py-1 px-0.5 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </div>
    </div>
  )
}

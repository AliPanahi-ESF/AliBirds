import { Link } from 'react-router-dom'
import { Bird, Menu, Plus, User as UserIcon, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { triggerHaptic } from '@/lib/haptics'

interface MobileHeaderProps {
  onOpenMenu: () => void
}

export default function MobileHeader({ onOpenMenu }: MobileHeaderProps) {
  const { user, logout } = useAuth()
  const { t } = useI18n()

  return (
    <header className="md:hidden sticky top-0 z-30 w-full liquid-glass-header safe-area-pt">
      <div className="flex items-center justify-between px-3.5 h-14 w-full">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('light')
              onOpenMenu()
            }}
            className="p-2 -ml-1 rounded-xl text-slate-300 hover:text-white bg-white/[0.04] active:bg-white/[0.1] border border-white/10 transition-all active:scale-95 cursor-pointer"
            aria-label={t('nav.menu', 'Menu')}
          >
            <Menu size={20} />
          </button>

          <Link
            to="/"
            onClick={() => triggerHaptic('selection')}
            className="flex items-center gap-2 active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/25 border border-white/20">
              <Bird className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-100 text-sm tracking-tight">AliBirds</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="compact" />

          <Link
            to="/invoices/new"
            onClick={() => triggerHaptic('medium')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 border border-white/15 transition-all active:scale-95"
          >
            <Plus size={14} />
            <span className="text-xs font-bold">{t('nav.new_invoice_short', 'Factuur')}</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link
                to="/settings"
                onClick={() => triggerHaptic('selection')}
                className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-400/40 flex items-center justify-center text-xs font-bold text-brand-300 shadow-sm active:scale-95 transition-transform"
                title={user.name}
              >
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </Link>
              <button
                onClick={() => {
                  triggerHaptic('warning')
                  logout()
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 active:bg-rose-500/10 transition-colors cursor-pointer"
                title={t('nav.logout', 'Uitloggen')}
                aria-label={t('nav.logout', 'Uitloggen')}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              onClick={() => triggerHaptic('selection')}
              className="p-2 rounded-xl text-slate-400 hover:text-white"
              title={t('nav.login', 'Inloggen')}
            >
              <UserIcon size={18} />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

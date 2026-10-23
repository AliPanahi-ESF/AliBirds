import { Link } from 'react-router-dom'
import { Bird, Menu, Plus, User as UserIcon, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface MobileHeaderProps {
  onOpenMenu: () => void
}

export default function MobileHeader({ onOpenMenu }: MobileHeaderProps) {
  const { user, logout } = useAuth()
  const { t } = useI18n()

  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-3.5 h-[58px] liquid-glass-header safe-area-pt">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMenu}
          className="p-2 -ml-1 rounded-xl text-slate-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-all active:scale-95"
          aria-label={t('nav.menu', 'Menu')}
        >
          <Menu size={19} />
        </button>

        <Link to="/" className="flex items-center gap-2 active:scale-95 transition-transform">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/25 border border-white/20">
            <Bird className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-100 text-sm tracking-tight">AliBirds</span>
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        <LanguageSwitcher variant="compact" />

        <Link
          to="/invoices/new"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-600/25 border border-white/15 transition-all active:scale-95"
        >
          <Plus size={13} />
          <span className="text-[11px]">{t('nav.new_invoice_short', 'Factuur')}</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-1">
            <Link
              to="/settings"
              className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-400/40 flex items-center justify-center text-xs font-bold text-brand-300 shadow-sm"
              title={user.name}
            >
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </Link>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title={t('nav.logout', 'Uitloggen')}
              aria-label={t('nav.logout', 'Uitloggen')}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white"
            title={t('nav.login', 'Inloggen')}
          >
            <UserIcon size={18} />
          </Link>
        )}
      </div>
    </header>
  )
}

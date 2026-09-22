import { Link } from 'react-router-dom'
import { Bird, Menu, Plus, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth'

interface MobileHeaderProps {
  onOpenMenu: () => void
}

export default function MobileHeader({ onOpenMenu }: MobileHeaderProps) {
  const { user } = useAuth()

  return (
    <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-3.5 h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenMenu}
          className="p-1.5 -ml-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shadow-md shadow-brand-600/30">
            <Bird className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-100 text-sm">AliBirds</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/invoices/new"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
        >
          <Plus size={14} />
          <span>Factuur</span>
        </Link>

        {user ? (
          <Link
            to="/settings"
            className="w-7 h-7 rounded-full bg-brand-600/30 border border-brand-500/50 flex items-center justify-center text-xs font-bold text-brand-300"
            title={user.name}
          >
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </Link>
        ) : (
          <Link
            to="/auth"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            title="Inloggen"
          >
            <UserIcon size={18} />
          </Link>
        )}
      </div>
    </header>
  )
}

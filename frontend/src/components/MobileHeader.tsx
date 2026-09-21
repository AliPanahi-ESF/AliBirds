import { Link } from 'react-router-dom'
import { Bird, Menu, Plus } from 'lucide-react'

interface MobileHeaderProps {
  onOpenMenu: () => void
}

export default function MobileHeader({ onOpenMenu }: MobileHeaderProps) {
  return (
    <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="flex items-center gap-3">
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

      <Link
        to="/invoices/new"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
      >
        <Plus size={14} />
        <span>Factuur</span>
      </Link>
    </header>
  )
}

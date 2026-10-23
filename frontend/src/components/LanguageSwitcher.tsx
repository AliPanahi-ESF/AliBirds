import { useI18n } from '@/lib/i18n'
import { clsx } from 'clsx'
import { triggerHaptic } from '@/lib/haptics'
import toast from 'react-hot-toast'

interface LanguageSwitcherProps {
  className?: string
  variant?: 'pill' | 'dropdown' | 'compact'
}

export default function LanguageSwitcher({ className, variant = 'pill' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n()

  const handleSelectLocale = (nextLocale: 'nl' | 'en') => {
    if (nextLocale === locale) return
    triggerHaptic('selection')
    setLocale(nextLocale)
    toast.success(
      nextLocale === 'nl' ? 'Taal gewijzigd naar Nederlands 🇳🇱' : 'Language switched to English 🇬🇧',
      { id: 'lang-switch-toast', duration: 2200 }
    )
  }

  const handleToggle = () => {
    const next = locale === 'nl' ? 'en' : 'nl'
    handleSelectLocale(next)
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all border min-h-[36px]',
          'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-slate-200 active:scale-95 cursor-pointer m3-state-layer shadow-sm',
          className
        )}
        title={locale === 'nl' ? 'Switch language to English' : 'Schakel taal naar Nederlands'}
        aria-label="Change language / Taal wijzigen"
      >
        <span className="text-sm leading-none">{locale === 'nl' ? '🇳🇱' : '🇬🇧'}</span>
        <span className="font-mono text-[11px] font-bold uppercase text-slate-200">
          {locale.toUpperCase()}
        </span>
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium shadow-sm',
        className
      )}
      role="group"
      aria-label="Language selection / Taalkeuze"
    >
      <button
        type="button"
        onClick={() => handleSelectLocale('nl')}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer m3-state-layer',
          locale === 'nl'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        )}
        title="Nederlands (Dutch)"
      >
        <span>🇳🇱</span>
        <span>NL</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelectLocale('en')}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer m3-state-layer',
          locale === 'en'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        )}
        title="English"
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  )
}


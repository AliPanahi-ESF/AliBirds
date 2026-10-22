import { Globe } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { clsx } from 'clsx'

interface LanguageSwitcherProps {
  className?: string
  variant?: 'pill' | 'dropdown' | 'compact'
}

export default function LanguageSwitcher({ className, variant = 'pill' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n()

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => setLocale(locale === 'nl' ? 'en' : 'nl')}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all border',
          'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-slate-200 active:scale-95',
          className
        )}
        title={locale === 'nl' ? 'Switch to English' : 'Schakel naar Nederlands'}
        aria-label="Change language / Taal wijzigen"
      >
        <Globe size={13} className="text-brand-400 shrink-0" />
        <span className="font-mono text-[11px] font-bold uppercase">
          {locale === 'nl' ? '🇬🇧 EN' : '🇳🇱 NL'}
        </span>
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'inline-flex items-center p-0.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-medium',
        className
      )}
      role="group"
      aria-label="Language selection / Taalkeuze"
    >
      <button
        type="button"
        onClick={() => setLocale('nl')}
        className={clsx(
          'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all',
          locale === 'nl'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
        )}
        title="Nederlands"
      >
        <span>🇳🇱</span>
        <span>NL</span>
      </button>

      <button
        type="button"
        onClick={() => setLocale('en')}
        className={clsx(
          'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all',
          locale === 'en'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
        )}
        title="English"
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check, TrendingUp, TrendingDown } from 'lucide-react'
import { clsx } from 'clsx'
import { taxApi, fmt } from '@/lib/api'
import { BtwAangifte } from '@/lib/types'

function CopyButton({ value }: { value: number }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value.toFixed(2).replace('.', ','))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className={clsx(
        'p-1.5 rounded transition-colors',
        copied
          ? 'text-emerald-400 bg-emerald-500/10'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
      )}
      title="Kopieer naar klembord"
      aria-label="Kopieer bedrag"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

interface RubricRowProps {
  code: string
  description: string
  turnover?: number
  tax?: number
  highlight?: boolean
}

function RubricRow({ code, description, turnover, tax, highlight }: RubricRowProps) {
  return (
    <div className={clsx(
      'flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-4 sm:py-3 rounded-lg border transition-colors',
      highlight
        ? 'bg-brand-600/10 border-brand-600/25'
        : 'bg-slate-900 border-slate-800 hover:border-slate-700',
    )}>
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="font-mono text-xs font-bold text-brand-400 bg-brand-600/15 px-2 py-0.5 rounded shrink-0">
          {code}
        </span>
        <div className="text-xs sm:text-sm text-slate-200 font-medium leading-snug">{description}</div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 pt-1.5 sm:pt-0 border-t sm:border-0 border-slate-800/80 shrink-0">
        {turnover !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 sm:hidden">Omzet:</span>
            <span className="font-mono text-xs sm:text-sm text-slate-300 font-medium">{fmt.currency(turnover)}</span>
            <CopyButton value={turnover} />
          </div>
        )}
        {tax !== undefined && (
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <span className="text-[11px] text-slate-400 sm:hidden">Btw:</span>
            <span className="font-mono text-xs sm:text-sm text-brand-300 font-bold">{fmt.currency(tax)}</span>
            <CopyButton value={tax} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function TaxReturn() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [quarter, setQuarter] = useState(Math.ceil((today.getMonth() + 1) / 3))

  const { data: btw, isLoading } = useQuery<BtwAangifte>({
    queryKey: ['btw', year, quarter],
    queryFn: () => taxApi.btw(year, quarter),
  })

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Btw-aangifte</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Belastingdienst kwartaaloverzicht per rubric</p>
        </div>

        {/* Quarter selector */}
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="select w-24 sm:w-28 text-xs sm:text-sm py-1.5"
          >
            {[today.getFullYear() - 1, today.getFullYear()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={clsx(
                  'w-8 sm:w-10 h-8 sm:h-9 rounded-lg text-xs sm:text-sm font-semibold transition-colors',
                  quarter === q
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800',
                )}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form header */}
      <div className="card p-3.5 sm:p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
            <span className="text-orange-400 font-bold text-xs">BD</span>
          </div>
          <div>
            <div className="font-semibold text-slate-100 text-sm">Aangifte Omzetbelasting</div>
            <div className="text-xs text-slate-400">
              {btw ? `${btw.start_date} t/m ${btw.end_date}` : `${year} Q${quarter}`}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Klik op het kopieericoon naast elk bedrag voor 1-op-1 overname in het Belastingdienst ondernemersportaal.
        </p>
      </div>

      {isLoading ? (
        <div className="card text-center py-10 text-xs text-slate-500">Berekenen...</div>
      ) : !btw ? (
        <div className="card text-center py-10 text-xs text-slate-500">Geen data beschikbaar</div>
      ) : (
        <div className="space-y-4">
          {/* Section 1 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Sectie 1 — Binnenlandse prestaties
            </h3>
            {['1a', '1b', '1c'].map(k => {
              const r = btw.rubrics[k]
              if (!r) return null
              return (
                <RubricRow
                  key={k}
                  code={r.code}
                  description={r.description}
                  turnover={r.turnover}
                  tax={r.tax}
                />
              )
            })}
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Sectie 3 — Leveringen buiten Nederland
            </h3>
            {['3a', '3b'].map(k => {
              const r = btw.rubrics[k]
              if (!r) return null
              return (
                <RubricRow
                  key={k}
                  code={r.code}
                  description={r.description}
                  turnover={r.turnover}
                  tax={r.tax}
                />
              )
            })}
          </div>

          {/* Section 5 */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Sectie 5 — Voorbelasting (te vorderen)
            </h3>
            {(() => {
              const r = btw.rubrics['5b']
              if (!r) return null
              return (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-4 sm:py-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded shrink-0">
                      5b
                    </span>
                    <div className="text-xs sm:text-sm text-slate-200 font-medium">{r.description}</div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-0 border-slate-800">
                    <span className="text-[11px] text-slate-400 sm:hidden">Voorbelasting:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-emerald-400">{fmt.currency(r.tax)}</span>
                      <CopyButton value={r.tax} />
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Eindtotaal */}
          <div className={clsx(
            'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-xl border-2',
            btw.te_betalen > 0
              ? 'bg-red-500/5 border-red-500/30'
              : 'bg-emerald-500/5 border-emerald-500/30',
          )}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-900 shrink-0">
                {btw.te_betalen > 0
                  ? <TrendingUp size={22} className="text-red-400" />
                  : <TrendingDown size={22} className="text-emerald-400" />}
              </div>
              <div>
                <div className="font-bold text-slate-100 text-sm sm:text-base">
                  {btw.te_betalen > 0 ? 'Te betalen aan Belastingdienst' : 'Te ontvangen van Belastingdienst'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Gecollecteerde btw minus voorbelasting (5b)
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800">
              <span className="text-xs text-slate-400 sm:hidden">Totaal:</span>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'font-mono text-xl sm:text-2xl font-extrabold',
                  btw.te_betalen > 0 ? 'text-red-400' : 'text-emerald-400',
                )}>
                  {fmt.currency(Math.abs(btw.te_betalen))}
                </span>
                <CopyButton value={Math.abs(btw.te_betalen)} />
              </div>
            </div>
          </div>

          {/* Helpful reminder */}
          <div className="card p-3 sm:p-4 bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
            <strong>Herinnering:</strong> De aangifte voor Q{quarter} {year} dient vóór het einde van de eerste maand na afloop van het kwartaal ingediend te zijn bij de Belastingdienst.
          </div>
        </div>
      )}
    </div>
  )
}

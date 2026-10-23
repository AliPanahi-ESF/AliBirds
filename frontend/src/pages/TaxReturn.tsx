import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check, TrendingUp, TrendingDown, Globe, FileText, Building2, AlertCircle, Clock, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { taxApi, fmt } from '@/lib/api'
import { BtwAangifte, IcpDeclaration } from '@/lib/types'
import { getVatDeadlineInfo } from '@/lib/vatCalculator'
import { useI18n } from '@/lib/i18n'

function CopyButton({ value, wholeValue }: { value: number | string; wholeValue?: number }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    // Belastingdienst portal strictly requires whole euros
    const text = wholeValue !== undefined
      ? String(wholeValue)
      : typeof value === 'number'
        ? String(Math.floor(value))
        : String(value)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className={clsx(
        'p-1.5 rounded transition-colors flex items-center gap-1',
        copied
          ? 'text-emerald-400 bg-emerald-500/10'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
      )}
      title={wholeValue !== undefined ? `€${wholeValue} (${t('tax.whole_euros', 'Belastingdienst geheel eurobedrag')})` : t('tax.copy_bd', 'Kopieer bedrag')}
      aria-label={t('tax.copy_bd', 'Kopieer bedrag voor Belastingdienst')}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {wholeValue !== undefined && (
        <span className="text-[10px] font-mono text-slate-400">€{wholeValue}</span>
      )}
    </button>
  )
}

interface RubricRowProps {
  key?: string
  code: string
  description: string
  turnover?: number
  tax?: number
  turnoverWhole?: number
  taxWhole?: number
  highlight?: boolean
}

function RubricRow({ code, description, turnover, tax, turnoverWhole, taxWhole, highlight }: RubricRowProps) {
  const { t } = useI18n()
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
            <span className="text-[11px] text-slate-400 sm:hidden">{t('tax.turnover', 'Omzet')}:</span>
            <span className="font-mono text-xs sm:text-sm text-slate-300 font-medium">{fmt.currency(turnover)}</span>
            <CopyButton value={turnover} wholeValue={turnoverWhole} />
          </div>
        )}
        {tax !== undefined && (
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <span className="text-[11px] text-slate-400 sm:hidden">{t('tax.vat', 'Btw')}:</span>
            <span className="font-mono text-xs sm:text-sm text-brand-300 font-bold">{fmt.currency(tax)}</span>
            <CopyButton value={tax} wholeValue={taxWhole} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function TaxReturn() {
  const { t } = useI18n()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [quarter, setQuarter] = useState(Math.ceil((today.getMonth() + 1) / 3))
  const [activeTab, setActiveTab] = useState<'BTW' | 'ICP'>('BTW')

  const { data: btw, isLoading: isLoadingBtw } = useQuery<BtwAangifte>({
    queryKey: ['btw', year, quarter],
    queryFn: () => taxApi.btw(year, quarter),
  })

  const { data: icp, isLoading: isLoadingIcp } = useQuery<IcpDeclaration>({
    queryKey: ['icp', year, quarter],
    queryFn: () => taxApi.icp(year, quarter),
    enabled: activeTab === 'ICP',
  })

  const deadlineInfo = getVatDeadlineInfo(quarter, year)

  const handleCopyFullReport = () => {
    if (!btw) {
      toast.error('Geen aangiftegegevens beschikbaar om te kopiëren')
      return
    }
    const r1a = btw.rubrics['1a']
    const r1b = btw.rubrics['1b']
    const r1e = btw.rubrics['1e']
    const r3b = btw.rubrics['3b']
    const r5a = btw.rubrics['5a']
    const r5b = btw.rubrics['5b']
    const r5c = btw.rubrics['5c']
    const teBetalen = btw.te_betalen_whole ?? Math.round(btw.te_betalen)

    const reportText = [
      `==================================================`,
      `BELASTINGAANGIFTE OMZETBELASTING — OVERZICHT`,
      `AliBirds ZZP Boekhouding`,
      `Periode: Kwartaal ${quarter} ${year}`,
      `Uiterste indieningsdatum: ${deadlineInfo.deadlineLabel}`,
      `==================================================`,
      ``,
      `RUBRIEK 1: BINNENLANDSE PRESTATIES`,
      `  1a. Leveringen/diensten 21%`,
      `      Omzet: ${fmt.currency(r1a?.turnover || 0)} (Geheel: €${r1a?.turnover_whole || 0})`,
      `      Btw:   ${fmt.currency(r1a?.tax || 0)} (Geheel: €${r1a?.tax_whole || 0})`,
      `  1b. Leveringen/diensten 9%`,
      `      Omzet: ${fmt.currency(r1b?.turnover || 0)} (Geheel: €${r1b?.turnover_whole || 0})`,
      `      Btw:   ${fmt.currency(r1b?.tax || 0)} (Geheel: €${r1b?.tax_whole || 0})`,
      `  1e. Leveringen/diensten 0% of verlegd`,
      `      Omzet: ${fmt.currency(r1e?.turnover || 0)} (Geheel: €${r1e?.turnover_whole || 0})`,
      ``,
      `RUBRIEK 3: PRESTATIES NAAR HET BUITENLAND`,
      `  3b. Leveringen naar landen binnen de EU (ICP)`,
      `      Omzet: ${fmt.currency(r3b?.turnover || 0)} (Geheel: €${r3b?.turnover_whole || 0})`,
      ``,
      `RUBRIEK 5: BEREKENING OMZETBELASTING`,
      `  5a. Verschuldigde omzetbelasting:`,
      `      Totaal: ${fmt.currency(r5a?.tax || 0)} (Geheel: €${r5a?.tax_whole || 0})`,
      `  5b. Voorbelasting (aftrekbare btw):`,
      `      Totaal: ${fmt.currency(r5b?.tax || 0)} (Geheel: €${r5b?.tax_whole || 0})`,
      `  5c. Subtotaal (5a minus 5b):`,
      `      Totaal: ${fmt.currency(r5c?.tax || 0)}`,
      ``,
      `--------------------------------------------------`,
      `EINDBEDRAG RUBRIEK 5g:`,
      teBetalen >= 0
        ? `  TE BETALEN AAN BELASTINGDIENST: €${teBetalen}`
        : `  TERUG TE ONTVANGEN VAN BELASTINGDIENST: €${Math.abs(teBetalen)}`,
      `--------------------------------------------------`,
      `Aangemaakt via AliBirds ZZP Facturatie op ${new Date().toLocaleDateString('nl-NL')}`
    ].join('\n')

    navigator.clipboard.writeText(reportText)
    toast.success(t('tax.copied', 'Volledig Btw-rapport gekopieerd naar klembord!'))
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">{t('tax.title', 'Btw-aangifte')}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {t('tax.subtitle', 'Kwartaalaangifte Omzetbelasting & Opgaaf ICP voor de Belastingdienst')}
          </p>
        </div>

        {/* Quarter selector */}
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="select w-24 sm:w-28 text-xs sm:text-sm py-1.5"
            aria-label={t('tax.year', 'Jaar')}
          >
            {[today.getFullYear() - 1, today.getFullYear()].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex gap-1" role="group" aria-label={t('tax.quarter', 'Kwartaal')}>
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={clsx(
                  'w-8 sm:w-10 h-8 sm:h-9 rounded-lg text-xs sm:text-sm font-semibold transition-all m3-state-layer',
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

      {/* Deadline & Quick Export Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl liquid-glass-card border border-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className={clsx(
              'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
              deadlineInfo.urgency === 'urgent'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : deadlineInfo.urgency === 'warning'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-brand-500/15 text-brand-300 border-brand-500/25'
            )}
          >
            <Clock size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-100">
                {t('tax.deadline_title', 'Belastingdienst Indieningsdeadline')}: {deadlineInfo.deadlineLabel}
              </span>
              <span
                className={clsx(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  deadlineInfo.urgency === 'urgent'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                    : deadlineInfo.urgency === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                )}
              >
                {deadlineInfo.daysRemaining >= 0
                  ? `${deadlineInfo.daysRemaining} ${t('tax.deadline_days_left', 'dagen resterend')}`
                  : t('filter.overdue', 'Verlopen')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {t('tax.deadline_due', 'Uiterste datum:')} {deadlineInfo.deadlineLabel} ({t('tax.whole_euros', 'Afgerond op hele euro’s conform Belastingdienst regels')}).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyFullReport}
          className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer border-brand-500/30 text-brand-300 hover:text-white m3-state-layer"
          title={t('tax.copy_tooltip', 'Kopieer alle rubrieken voor uw boekhouder of administratie')}
        >
          <Copy size={13} />
          <span>{t('tax.btn_print', 'Kopieer Volledig Btw-rapport')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('BTW')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors m3-state-layer',
            activeTab === 'BTW'
              ? 'border-brand-500 text-brand-300 bg-brand-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <FileText size={16} />
          <span>{t('tax.tab_btw', 'Btw-aangifte (Omzetbelasting)')}</span>
        </button>

        <button
          onClick={() => setActiveTab('ICP')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors m3-state-layer',
            activeTab === 'ICP'
              ? 'border-brand-500 text-brand-300 bg-brand-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Globe size={16} />
          <span>{t('tax.tab_icp', 'Opgaaf ICP (EU Prestaties)')}</span>
        </button>
      </div>

      {/* ── TAB 1: BTW AANGIFTE ── */}
      {activeTab === 'BTW' && (
        <div className="space-y-4 m3-fade-through">
          {/* Form header */}
          <div className="card p-3.5 sm:p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                <span className="text-orange-400 font-bold text-xs">BD</span>
              </div>
              <div>
                <div className="font-semibold text-slate-100 text-sm">{t('tax.tab_btw', 'Aangifte Omzetbelasting')}</div>
                <div className="text-xs text-slate-400">
                  {btw ? `${btw.start_date} t/m ${btw.end_date}` : `${year} Q${quarter}`}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {t('tax.whole_euros', 'Afgerond op hele euro’s conform Belastingdienst regels')} ({t('tax.copy_tooltip', 'Klik op het kopieericoon naast elk bedrag voor overname in het Belastingdienst portaal')}).
            </p>
          </div>

          {isLoadingBtw ? (
            <div className="space-y-3 py-4">
              <div className="h-16 m3-skeleton-shimmer rounded-xl" />
              <div className="h-16 m3-skeleton-shimmer rounded-xl" />
              <div className="h-16 m3-skeleton-shimmer rounded-xl" />
            </div>
          ) : !btw ? (
            <div className="card text-center py-10 text-xs text-slate-500">{t('common.loading', 'Geen data beschikbaar')}</div>
          ) : (
            <div className="space-y-4">
              {/* Section 1 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  {t('tax.rubric_1', 'Rubriek 1: Prestaties binnenland')}
                </h3>
                {['1a', '1b', '1c', '1e'].map(k => {
                  const r = btw.rubrics[k]
                  if (!r) return null
                  const label = t(`tax.rubric_${k}`, r.description)
                  return (
                    <RubricRow
                      key={k}
                      code={r.code}
                      description={label}
                      turnover={r.turnover}
                      tax={r.tax}
                      turnoverWhole={r.turnover_whole}
                      taxWhole={r.tax_whole}
                    />
                  )
                })}
              </div>

              {/* Section 3 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  {t('tax.rubric_3', 'Rubriek 3: Prestaties naar het buitenland')}
                </h3>
                {['3a', '3b'].map(k => {
                  const r = btw.rubrics[k]
                  if (!r) return null
                  const label = t(`tax.rubric_${k}`, r.description)
                  return (
                    <RubricRow
                      key={k}
                      code={r.code}
                      description={label}
                      turnover={r.turnover}
                      tax={r.tax}
                      turnoverWhole={r.turnover_whole}
                      taxWhole={r.tax_whole}
                    />
                  )
                })}
              </div>

              {/* Section 4 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  {t('tax.rubric_4', 'Rubriek 4: Prestaties uit het buitenland aan u verleend')}
                </h3>
                {['4a', '4b'].map(k => {
                  const r = btw.rubrics[k]
                  if (!r) return null
                  const label = t(`tax.rubric_${k}`, r.description)
                  return (
                    <RubricRow
                      key={k}
                      code={r.code}
                      description={label}
                      turnover={r.turnover}
                      tax={r.tax}
                      turnoverWhole={r.turnover_whole}
                      taxWhole={r.tax_whole}
                    />
                  )
                })}
              </div>

              {/* Section 5 */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  {t('tax.rubric_5', 'Rubriek 5: Eindberekening & Voorbelasting')}
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
                        <div className="text-xs sm:text-sm text-slate-200 font-medium">
                          {t('tax.rubric_5b', r.description)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-0 border-slate-800">
                        <span className="text-[11px] text-slate-400 sm:hidden">{t('expenses.kpi_input_tax', 'Voorbelasting')}:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-emerald-400">{fmt.currency(r.tax)}</span>
                          <CopyButton value={r.tax} wholeValue={r.tax_whole ?? btw.voorbelasting_whole} />
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
                      {btw.te_betalen > 0 ? t('tax.to_pay', 'Te betalen aan Belastingdienst') : t('tax.to_receive', 'Te ontvangen van Belastingdienst')}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {t('tax.rubric_5c', 'Gecollecteerde btw minus voorbelasting (5b)')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800">
                  <span className="text-xs text-slate-400 sm:hidden">{t('inv.total', 'Totaal')}:</span>
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
                <strong>{t('common.confirm', 'Herinnering')}:</strong> {t('tax.deadline_due', 'Uiterste datum:')} {deadlineInfo.deadlineLabel} (Q{quarter} {year}).
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: OPGAAF ICP (EU PRESTATIES) ── */}
      {activeTab === 'ICP' && (
        <div className="space-y-4 m3-fade-through">
          <div className="card p-4 sm:p-5 border-blue-500/30 bg-blue-950/15">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <Globe size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-100 text-sm">{t('tax.icp_title', 'Opgaaf Intracommunautaire Prestaties (ICP)')}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('tax.icp_desc', 'Verplichte periodieke opgaaf voor leveringen en diensten aan btw-plichtige klanten in andere EU-landen.')}
                </p>
              </div>
            </div>
          </div>

          {isLoadingIcp ? (
            <div className="space-y-3 py-4">
              <div className="h-14 m3-skeleton-shimmer rounded-xl" />
              <div className="h-14 m3-skeleton-shimmer rounded-xl" />
            </div>
          ) : !icp || icp.items.length === 0 ? (
            <div className="card p-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Globe size={20} />
              </div>
              <div className="text-sm font-semibold text-slate-200">{t('tax.icp_empty', 'Geen intracommunautaire prestaties geregistreerd in dit kwartaal.')}</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {year} Q{quarter} — {t('tax.rubric_3b', 'Leveringen naar / diensten in EU-landen (ICP)')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">{t('tax.icp_country', 'Land')}</th>
                      <th className="py-3 px-4">{t('tax.icp_client_vat', 'Btw-identificatienummer')}</th>
                      <th className="py-3 px-4">{t('tax.icp_client_name', 'Klantnaam')}</th>
                      <th className="py-3 px-4">{t('common.actions', 'Type')}</th>
                      <th className="py-3 px-4 text-right">{t('tax.icp_amount', 'Totaalbedrag excl.')}</th>
                      <th className="py-3 px-3 text-center">{t('common.actions', 'Kopiëren')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200 font-medium">
                    {icp.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-brand-400 font-mono">
                          {it.country_code}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          {it.vat_number}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {it.client_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25">
                            {it.supply_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                          {fmt.currency(it.turnover)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <CopyButton value={it.turnover} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-700 bg-slate-900 text-slate-100 font-bold">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-right">
                        {t('tax.rubric_3b', 'Totaal Rubriek 3b (ICP Prestaties)')}:
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-brand-300">
                        {fmt.currency(icp.total_amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <CopyButton value={icp.total_amount} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="card p-3 sm:p-4 bg-blue-500/5 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between gap-3">
                <span>
                  <strong>Tip:</strong> {fmt.currency(icp.total_amount)} — {t('tax.whole_euros', 'Afgerond op hele euro’s')} ({t('tax.rubric_3b', 'Rubriek 3b')}).
                </span>
                <CopyButton value={icp.total_amount} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

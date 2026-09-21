import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, AlertTriangle, Clock, Receipt,
  Plus, Upload, FileText, ArrowRight,
} from 'lucide-react'
import { dashboardApi, invoicesApi, fmt } from '@/lib/api'
import { DashboardKPIs, Invoice } from '@/lib/types'
import { clsx } from 'clsx'

interface KPICardProps {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: 'blue' | 'red' | 'yellow' | 'green'
  loading?: boolean
}

function KPICard({ title, value, sub, icon: Icon, color, loading }: KPICardProps) {
  const colors = {
    blue:   'bg-brand-600/15 text-brand-400 border-brand-600/20',
    red:    'bg-red-500/15 text-red-400 border-red-500/20',
    yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }
  return (
    <div className="card p-3.5 sm:p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between mb-2">
        <div className={clsx('p-2 rounded-lg border', colors[color])}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <div className={clsx('text-lg sm:text-2xl font-bold font-mono tracking-tight text-slate-100', loading && 'animate-pulse text-slate-700')}>
          {loading ? '——' : value}
        </div>
        <div className="text-xs text-slate-400 mt-1 font-medium">{title}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'badge-gray',
    SENT: 'badge-blue',
    PAID: 'badge-green',
    OVERDUE: 'badge-red',
    CANCELLED: 'badge-gray',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Concept', SENT: 'Verzonden', PAID: 'Betaald',
    OVERDUE: 'Verlopen', CANCELLED: 'Geannuleerd',
  }
  return <span className={clsx(map[status] ?? 'badge-gray', 'text-[11px] px-2 py-0.5')}>{labels[status] ?? status}</span>
}

export default function Dashboard() {
  const nav = useNavigate()
  const { data: kpis, isLoading } = useQuery<DashboardKPIs>({
    queryKey: ['kpis'],
    queryFn: dashboardApi.kpis,
  })
  const { data: recentInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices', 'recent'],
    queryFn: () => invoicesApi.list(),
  })

  const today = new Date()
  const quarter = Math.ceil((today.getMonth() + 1) / 3)
  const year = today.getFullYear()

  return (
    <div className="space-y-5 sm:space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {today.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            &nbsp;·&nbsp; Kwartaal {quarter} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/bank')} className="btn-secondary text-xs sm:text-sm py-2 px-3">
            <Upload size={14} /> <span className="hidden xs:inline">MT940</span> Bank
          </button>
          <button onClick={() => nav('/invoices/new')} className="btn-primary text-xs sm:text-sm py-2 px-3">
            <Plus size={14} /> Nieuwe factuur
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Openstaand"
          value={kpis ? fmt.currency(kpis.outstanding_revenue) : '—'}
          icon={Clock}
          color="blue"
          loading={isLoading}
        />
        <KPICard
          title="Verlopen"
          value={kpis ? fmt.currency(kpis.overdue_amount) : '—'}
          sub="Te incasseren"
          icon={AlertTriangle}
          color="red"
          loading={isLoading}
        />
        <KPICard
          title={`Btw Q${quarter} (geschat)`}
          value={kpis ? fmt.currency(kpis.projected_vat_liability) : '—'}
          sub="Te betalen aan BD"
          icon={TrendingUp}
          color="yellow"
          loading={isLoading}
        />
        <KPICard
          title="Betaald deze maand"
          value={kpis ? fmt.currency(kpis.paid_this_month) : '—'}
          icon={Receipt}
          color="green"
          loading={isLoading}
        />
      </div>

      {/* Quick actions + Recent invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Snelle acties</h2>
          {[
            { label: 'Nieuwe factuur maken', to: '/invoices/new', icon: FileText, color: 'text-brand-400' },
            { label: 'Bankafschrift koppelen', to: '/bank', icon: Upload, color: 'text-emerald-400' },
            { label: 'Kosten invoeren', to: '/expenses', icon: Receipt, color: 'text-amber-400' },
            { label: 'Btw-aangifte rubric overzicht', to: '/tax', icon: TrendingUp, color: 'text-purple-400' },
          ].map(({ label, to, icon: Icon, color }) => (
            <button
              key={to}
              onClick={() => nav(to)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                         hover:bg-slate-800 transition-colors text-xs sm:text-sm text-slate-300
                         hover:text-slate-100 text-left group"
            >
              <Icon size={16} className={color} />
              <span className="flex-1">{label}</span>
              <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity" />
            </button>
          ))}
        </div>

        {/* Recent Invoices */}
        <div className="card col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300">Recente facturen</h2>
            <button onClick={() => nav('/invoices')} className="btn-ghost btn-sm text-xs">
              Alles zien <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-1.5">
            {recentInvoices.slice(0, 6).map((inv) => (
              <div
                key={inv.id}
                onClick={() => nav(`/invoices/${inv.id}/edit`)}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-slate-800/80
                           border border-transparent hover:border-slate-700/50
                           transition-colors cursor-pointer group"
              >
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-mono text-xs text-brand-400 font-medium shrink-0">{inv.invoice_number}</span>
                  <span className="text-xs sm:text-sm text-slate-200 truncate font-medium">
                    {inv.client?.name ?? 'Onbekende klant'}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <StatusBadge status={inv.status} />
                  <span className="font-mono text-xs sm:text-sm text-slate-100 font-semibold text-right min-w-[70px]">
                    {fmt.currency(inv.total_incl_vat)}
                  </span>
                </div>
              </div>
            ))}
            {recentInvoices.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-8">
                Nog geen facturen — maak er direct een aan!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Btw-aangifte mini widget */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-300">Btw-aangifte schatting</h2>
            <p className="text-xs text-slate-500 mt-0.5">{year} — overzicht per kwartaal</p>
          </div>
          <button onClick={() => nav('/tax')} className="btn-secondary btn-sm text-xs">
            Aangifte <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[1, 2, 3, 4].map(q => (
            <div
              key={q}
              className={clsx(
                'rounded-lg p-2.5 sm:p-3 border text-center cursor-pointer transition-colors',
                q === quarter
                  ? 'bg-brand-600/15 border-brand-600/30 text-brand-400'
                  : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:bg-slate-800',
              )}
              onClick={() => nav('/tax')}
            >
              <div className="text-xs font-semibold">Q{q} {year}</div>
              {q === quarter && kpis && (
                <div className="text-xs sm:text-sm font-bold mt-1 font-mono text-brand-300">
                  {fmt.currency(kpis.projected_vat_liability)}
                </div>
              )}
              {q !== quarter && <div className="text-xs mt-1 text-slate-600">—</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

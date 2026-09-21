import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Download, Eye, Calendar } from 'lucide-react'
import { useState } from 'react'
import { invoicesApi, fmt } from '@/lib/api'
import { Invoice, InvoiceStatus } from '@/lib/types'
import { clsx } from 'clsx'

const STATUS_MAP: Record<InvoiceStatus, { label: string; cls: string }> = {
  DRAFT:     { label: 'Concept',     cls: 'badge-gray' },
  SENT:      { label: 'Verzonden',   cls: 'badge-blue' },
  PAID:      { label: 'Betaald',     cls: 'badge-green' },
  OVERDUE:   { label: 'Verlopen',    cls: 'badge-red' },
  CANCELLED: { label: 'Geannuleerd', cls: 'badge-gray' },
}

export default function InvoiceList() {
  const nav = useNavigate()
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', filter],
    queryFn: () => invoicesApi.list(filter ? { status: filter } : {}),
  })

  const filtered = invoices.filter(inv =>
    !search ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.client?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 sm:space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Facturen</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{invoices.length} facturen geregistreerd</p>
        </div>
        <button onClick={() => nav('/invoices/new')} className="btn-primary text-xs sm:text-sm py-2 px-3.5">
          <Plus size={15} /> Nieuwe factuur
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-8 text-xs sm:text-sm py-2"
            placeholder="Zoek nummer of klant..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Tabs with horizontal touch scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {['', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                filter === s
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800',
              )}
            >
              {s === '' ? 'Alles' : STATUS_MAP[s as InvoiceStatus]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <div className="card text-center py-10 text-xs text-slate-500">Facturen laden...</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-10 text-xs text-slate-500">Geen facturen gevonden</div>
        ) : (
          filtered.map(inv => {
            const s = STATUS_MAP[inv.status] ?? { label: inv.status, cls: 'badge-gray' }
            const isOverdue = inv.status === 'SENT' && new Date(inv.due_date) < new Date()
            return (
              <div
                key={inv.id}
                onClick={() => nav(`/invoices/${inv.id}/edit`)}
                className="card p-3.5 space-y-2.5 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-semibold text-brand-400">{inv.invoice_number}</div>
                    <div className="text-sm font-medium text-slate-100 mt-0.5">{inv.client?.name ?? 'Geen klant gekoppeld'}</div>
                  </div>
                  <span className={clsx(s.cls, 'text-[11px] px-2 py-0.5')}>{s.label}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80 text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-slate-500" />
                    <span>{fmt.date(inv.issue_date)}</span>
                    <span className="text-slate-600">·</span>
                    <span className={clsx(isOverdue && 'text-red-400 font-medium')}>
                      Vervalt {fmt.date(inv.due_date)}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-100">
                    {fmt.currency(inv.total_incl_vat)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block table-wrapper bg-slate-900">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-3.5 font-medium">Nummer</th>
              <th className="p-3.5 font-medium">Klant</th>
              <th className="p-3.5 font-medium">Datum</th>
              <th className="p-3.5 font-medium">Vervaldatum</th>
              <th className="p-3.5 font-medium">Status</th>
              <th className="p-3.5 font-medium text-right">Bedrag (incl)</th>
              <th className="p-3.5 font-medium text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">Laden...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">Geen facturen gevonden</td></tr>
            ) : filtered.map((inv) => {
              const s = STATUS_MAP[inv.status] ?? { label: inv.status, cls: 'badge-gray' }
              const isOverdue = inv.status === 'SENT' && new Date(inv.due_date) < new Date()
              return (
                <tr key={inv.id} className="hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => nav(`/invoices/${inv.id}/edit`)}>
                  <td className="p-3.5 font-mono text-xs text-brand-400 font-medium">{inv.invoice_number}</td>
                  <td className="p-3.5 font-medium text-slate-200">{inv.client?.name ?? '—'}</td>
                  <td className="p-3.5 text-slate-400 text-xs">{fmt.date(inv.issue_date)}</td>
                  <td className={clsx('p-3.5 text-xs', isOverdue ? 'text-red-400 font-medium' : 'text-slate-400')}>
                    {fmt.date(inv.due_date)}
                  </td>
                  <td className="p-3.5"><span className={s.cls}>{s.label}</span></td>
                  <td className="p-3.5 text-right font-mono font-semibold text-slate-100">
                    {fmt.currency(inv.total_incl_vat)}
                  </td>
                  <td className="p-3.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => nav(`/invoices/${inv.id}/edit`)}
                        className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                        title="Bewerken"
                      >
                        <Eye size={14} />
                      </button>
                      {inv.pdf_path && (
                        <a
                          href={invoicesApi.pdfUrl(inv.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                          title="PDF downloaden"
                        >
                          <Download size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Download, Eye, Calendar, Trash2, Upload, Mail } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { invoicesApi, settingsApi, clientsApi, fmt } from '@/lib/api'
import { Invoice, InvoiceStatus, BusinessSettings, Client } from '@/lib/types'
import InvoicePrintModal from '@/components/InvoicePrintModal'
import ImportInvoicePdfModal from '@/components/ImportInvoicePdfModal'
import SendInvoiceModal from '@/components/SendInvoiceModal'
import { clsx } from 'clsx'
import ConfirmDialog from '@/components/ConfirmDialog'
import { TableRowSkeleton, CardSkeleton } from '@/components/TableSkeleton'

const STATUS_MAP: Record<InvoiceStatus, { label: string; cls: string }> = {
  DRAFT:     { label: 'Concept',     cls: 'badge-gray' },
  SENT:      { label: 'Verzonden',   cls: 'badge-blue' },
  PAID:      { label: 'Betaald',     cls: 'badge-green' },
  OVERDUE:   { label: 'Verlopen',    cls: 'badge-red' },
  CANCELLED: { label: 'Geannuleerd', cls: 'badge-yellow' },
}

export default function InvoiceList() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null)
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null)
  const [showImportPdf, setShowImportPdf] = useState(false)
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  const { data: settings } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', filter],
    queryFn: () => invoicesApi.list(filter ? { status: filter } : {}),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      toast.success('Factuur succesvol verwijderd!')
      setDeletingInvoice(null)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
    onError: () => toast.error('Verwijderen mislukt'),
  })

  const clearAllMutation = useMutation({
    mutationFn: () => invoicesApi.clearAll(),
    onSuccess: () => {
      toast.success('Alle facturen zijn gewist!')
      setConfirmClearAll(false)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
    onError: () => toast.error('Wissen mislukt'),
  })

  const handleDelete = (inv: Invoice) => {
    setDeletingInvoice(inv)
  }

  const handleClearAll = () => {
    setConfirmClearAll(true)
  }

  const filtered = invoices.filter(inv =>
    !search ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.client?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Facturen</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{invoices.length} facturen geregistreerd</p>
        </div>
        <div className="flex items-center gap-2">
          {invoices.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearAllMutation.isPending}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-2 px-3 border border-red-500/20"
              title="Alle facturen verwijderen"
            >
              <Trash2 size={14} />
              <span>Alle wissen</span>
            </button>
          )}
          <button
            onClick={() => setShowImportPdf(true)}
            className="btn-secondary text-xs sm:text-sm py-2 px-3 flex items-center gap-1.5"
            title="Eerdere facturen importeren via PDF"
          >
            <Upload size={14} />
            <span>PDF importeren</span>
          </button>
          <button onClick={() => nav('/invoices/new')} className="btn-primary text-xs sm:text-sm py-2 px-3.5">
            <Plus size={15} /> Nieuwe factuur
          </button>
        </div>
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
          <CardSkeleton count={4} />
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
              <TableRowSkeleton cols={7} rows={5} />
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
                    {fmt.currency(inv.total_incl ?? inv.total_incl_vat ?? 0)}
                  </td>
                  <td className="p-3.5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setSendInvoice(inv)}
                        className="btn-ghost p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300"
                        title="Factuur verzenden per e-mail"
                        aria-label={`Factuur ${inv.invoice_number} verzenden per e-mail`}
                      >
                        <Mail size={14} />
                      </button>
                      <button
                        onClick={() => nav(`/invoices/${inv.id}/edit`)}
                        className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                        title="Bewerken"
                        aria-label={`Factuur ${inv.invoice_number} bewerken`}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => setPrintInvoice(inv)}
                        className="btn-ghost p-1.5 rounded-lg text-brand-400 hover:text-brand-300"
                        title="Afdrukken / PDF"
                        aria-label={`Factuur ${inv.invoice_number} afdrukken als PDF`}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(inv)}
                        className="btn-ghost p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Factuur verwijderen"
                        aria-label={`Factuur ${inv.invoice_number} verwijderen`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* In-browser vector PDF / Print Modal */}
      {printInvoice && (
        <InvoicePrintModal
          invoice={printInvoice}
          settings={settings}
          onClose={() => setPrintInvoice(null)}
        />
      )}

      {/* Send Invoice by Email Modal */}
      {sendInvoice && (
        <SendInvoiceModal
          invoice={sendInvoice}
          client={sendInvoice.client}
          settings={settings}
          isOpen={Boolean(sendInvoice)}
          onClose={() => setSendInvoice(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['invoices'] })
          }}
        />
      )}

      {/* Historical PDF Import Modal */}
      {showImportPdf && (
        <ImportInvoicePdfModal
          clients={clients}
          onClose={() => setShowImportPdf(false)}
        />
      )}

      {/* Single Invoice Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingInvoice)}
        title="Factuur verwijderen"
        description={
          <span>
            Weet u zeker dat u factuur <strong className="text-slate-200">{deletingInvoice?.invoice_number}</strong> definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
          </span>
        }
        confirmLabel="Factuur wissen"
        cancelLabel="Annuleren"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingInvoice) deleteMutation.mutate(deletingInvoice.id)
        }}
        onClose={() => setDeletingInvoice(null)}
      />

      {/* Delete ALL Invoices Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmClearAll}
        title="Alle facturen wissen"
        description="Weet u zeker dat u ALLE facturen definitief wilt wissen uit uw administratie? Deze actie is onomkeerbaar."
        confirmLabel="Alles definitief wissen"
        cancelLabel="Annuleren"
        variant="danger"
        isLoading={clearAllMutation.isPending}
        onConfirm={() => clearAllMutation.mutate()}
        onClose={() => setConfirmClearAll(false)}
      />
    </div>
  )
}

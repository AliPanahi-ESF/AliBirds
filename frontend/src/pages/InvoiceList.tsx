import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Download, Eye, Calendar, Trash2, Upload, Mail, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { invoicesApi, settingsApi, clientsApi, fmt } from '@/lib/api'
import { Invoice, InvoiceStatus, BusinessSettings, Client } from '@/lib/types'
import InvoicePrintModal from '@/components/InvoicePrintModal'
import ImportInvoicePdfModal from '@/components/ImportInvoicePdfModal'
import SendInvoiceModal from '@/components/SendInvoiceModal'
import { clsx } from 'clsx'
import ConfirmDialog from '@/components/ConfirmDialog'
import { TableRowSkeleton, CardSkeleton } from '@/components/TableSkeleton'
import { triggerHaptic } from '@/lib/haptics'
import { useI18n } from '@/lib/i18n'

export default function InvoiceList() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { t } = useI18n()
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null)
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null)
  const [showImportPdf, setShowImportPdf] = useState(false)
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  const statusMap: Record<InvoiceStatus, { label: string; cls: string }> = useMemo(() => ({
    DRAFT:     { label: t('inv.status.draft', 'Concept'),     cls: 'badge-gray' },
    SENT:      { label: t('inv.status.sent', 'Verzonden'),   cls: 'badge-blue' },
    PAID:      { label: t('inv.status.paid', 'Betaald'),     cls: 'badge-green' },
    OVERDUE:   { label: t('inv.status.overdue', 'Verlopen'),    cls: 'badge-red' },
    CANCELLED: { label: t('inv.status.cancelled', 'Geannuleerd'), cls: 'badge-yellow' },
  }), [t])

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
      triggerHaptic('success')
      toast.success(t('inv.toast_deleted', 'Factuur succesvol verwijderd!'))
      setDeletingInvoice(null)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
    onError: () => {
      triggerHaptic('warning')
      toast.error(t('inv.toast_delete_failed', 'Verwijderen mislukt'))
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: () => invoicesApi.clearAll(),
    onSuccess: () => {
      triggerHaptic('success')
      toast.success(t('inv.toast_cleared_all', 'Alle facturen zijn gewist!'))
      setConfirmClearAll(false)
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
    onError: () => {
      triggerHaptic('warning')
      toast.error(t('inv.toast_clear_failed', 'Wissen mislukt'))
    },
  })

  const handleDelete = (inv: Invoice) => {
    triggerHaptic('warning')
    setDeletingInvoice(inv)
  }

  const handleClearAll = () => {
    triggerHaptic('warning')
    setConfirmClearAll(true)
  }

  const filtered = useMemo(() => {
    return invoices.filter(inv =>
      !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.client?.name?.toLowerCase().includes(search.toLowerCase())
    )
  }, [invoices, search])

  // Count helper for tabs
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      '': invoices.length,
      DRAFT: 0,
      SENT: 0,
      PAID: 0,
      OVERDUE: 0,
    }
    const now = new Date()
    invoices.forEach(inv => {
      if (inv.status === 'DRAFT') counts.DRAFT++
      else if (inv.status === 'SENT') {
        counts.SENT++
        if (new Date(inv.due_date) < now) counts.OVERDUE++
      } else if (inv.status === 'PAID') counts.PAID++
      else if (inv.status === 'OVERDUE') counts.OVERDUE++
    })
    return counts
  }, [invoices])

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Header with mobile touch ergonomics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <span>{t('inv.title', 'Facturen')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                {invoices.length}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{t('inv.subtitle', 'Overzicht en beheer van al uw verkoopfacturen')}</p>
          </div>

          {/* Mobile only icon for safe clear-all if needed */}
          {invoices.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearAllMutation.isPending}
              className="sm:hidden p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 active:scale-95 transition-all"
              title={t('inv.action_clear_all', 'Alle facturen wissen')}
              aria-label={t('inv.action_clear_all', 'Alle facturen wissen')}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Action button row: Primary CTA emphasized, secondary balanced */}
        <div className="flex items-stretch sm:items-center gap-2">
          {invoices.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearAllMutation.isPending}
              className="hidden sm:inline-flex btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-2 px-3 border border-red-500/20 active:scale-95 transition-all"
              title={t('inv.action_clear_all', 'Alle facturen verwijderen')}
            >
              <Trash2 size={14} />
              <span>{t('inv.action_clear_all', 'Alle wissen')}</span>
            </button>
          )}
          <button
            onClick={() => {
              triggerHaptic('light')
              setShowImportPdf(true)
            }}
            className="flex-1 sm:flex-none btn-secondary text-xs sm:text-sm py-2.5 sm:py-2 px-3.5 flex items-center justify-center gap-2 min-h-[44px] active:scale-[0.98] transition-all"
            title="Eerdere facturen importeren via PDF"
          >
            <Upload size={15} />
            <span>{t('inv.action_import_pdf', 'PDF import')}</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('medium')
              nav('/invoices/new')
            }}
            className="flex-1 sm:flex-none btn-primary text-xs sm:text-sm py-2.5 sm:py-2 px-4 flex items-center justify-center gap-2 min-h-[44px] shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all font-semibold"
          >
            <Plus size={16} />
            <span>{t('inv.action_new', 'Nieuwe factuur')}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="input pl-9 pr-9 text-xs sm:text-sm h-11 sm:h-9 w-full"
            placeholder={t('inv.search_placeholder', 'Zoek nummer of klant...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => {
                triggerHaptic('light')
                setSearch('')
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1.5 rounded-full active:scale-90 transition-transform"
              aria-label="Zoekopdracht wissen"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Tabs with horizontal touch scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none touch-pan-x -mx-1 px-1">
          {['', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map(s => {
            const count = tabCounts[s] ?? 0
            const active = filter === s
            return (
              <button
                key={s}
                onClick={() => {
                  triggerHaptic('selection')
                  setFilter(s)
                }}
                className={clsx(
                  'px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 min-h-[38px] active:scale-95',
                  active
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800',
                )}
              >
                <span>{s === '' ? t('inv.status.all', 'Alles') : statusMap[s as InvoiceStatus]?.label ?? s}</span>
                <span
                  className={clsx(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
                    active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Mobile Card View (< md) with direct quick actions */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <CardSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <div className="liquid-glass-card text-center py-12 px-4 text-xs text-slate-400 border border-slate-800/80">
            {t('inv.empty', 'Geen facturen gevonden voor deze selectie')}
          </div>
        ) : (
          filtered.map(inv => {
            const s = statusMap[inv.status] ?? { label: inv.status, cls: 'badge-gray' }
            const isOverdue = inv.status === 'SENT' && new Date(inv.due_date) < new Date()
            return (
              <div
                key={inv.id}
                className="liquid-glass-card p-4 space-y-3 border border-slate-800/80 active:border-slate-700 transition-all rounded-2xl"
              >
                {/* Header row: Invoice # and Status */}
                <div
                  onClick={() => {
                    triggerHaptic('light')
                    nav(`/invoices/${inv.id}/edit`)
                  }}
                  className="flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-brand-400">{inv.invoice_number}</div>
                    <div className="text-base font-semibold text-slate-100 mt-0.5">
                      {inv.client?.name ?? 'Geen klant gekoppeld'}
                    </div>
                  </div>
                  <span className={clsx(s.cls, 'text-[11px] px-2.5 py-1 rounded-full font-medium')}>
                    {s.label}
                  </span>
                </div>

                {/* Date and Amount summary */}
                <div
                  onClick={() => {
                    triggerHaptic('light')
                    nav(`/invoices/${inv.id}/edit`)
                  }}
                  className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60 text-slate-400 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-500" />
                    <span>{fmt.date(inv.issue_date)}</span>
                    <span className="text-slate-600">·</span>
                    <span className={clsx(isOverdue && 'text-red-400 font-medium')}>
                      {t('inv.due', 'Vervalt')} {fmt.date(inv.due_date)}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-base text-slate-100">
                    {fmt.currency(inv.total_incl ?? inv.total_incl_vat ?? 0)}
                  </div>
                </div>

                {/* Direct 1-tap Touch Action Buttons */}
                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        triggerHaptic('light')
                        setPrintInvoice(inv)
                      }}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-brand-300 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700/50 min-h-[40px] active:scale-95 transition-all"
                      title={t('inv.action_pdf', 'PDF bekijken of downloaden')}
                    >
                      <Download size={13} />
                      <span>{t('inv.action_pdf', 'PDF')}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        triggerHaptic('light')
                        setSendInvoice(inv)
                      }}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700/50 min-h-[40px] active:scale-95 transition-all"
                      title={t('inv.action_send', 'Factuur verzenden via e-mail')}
                    >
                      <Mail size={13} />
                      <span>{t('inv.action_send', 'Verzenden')}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        triggerHaptic('light')
                        nav(`/invoices/${inv.id}/edit`)
                      }}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-800/40 border border-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-90 transition-all"
                      title={t('inv.action_edit', 'Factuur bewerken')}
                      aria-label={t('inv.action_edit', 'Factuur bewerken')}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(inv)
                      }}
                      className="p-2.5 rounded-xl text-red-400/80 hover:text-red-300 bg-red-500/10 border border-red-500/20 min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-90 transition-all"
                      title={t('inv.action_delete', 'Factuur verwijderen')}
                      aria-label={t('inv.action_delete', 'Factuur verwijderen')}
                    >
                      <Trash2 size={15} />
                    </button>
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
              <th className="p-3.5 font-medium">{t('inv.number', 'Nummer')}</th>
              <th className="p-3.5 font-medium">{t('inv.client', 'Klant')}</th>
              <th className="p-3.5 font-medium">{t('inv.date', 'Datum')}</th>
              <th className="p-3.5 font-medium">{t('inv.due_date', 'Vervaldatum')}</th>
              <th className="p-3.5 font-medium">{t('dash.status', 'Status')}</th>
              <th className="p-3.5 font-medium text-right">{t('inv.total', 'Bedrag (incl)')}</th>
              <th className="p-3.5 font-medium text-right">{t('inv.actions', 'Acties')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <TableRowSkeleton cols={7} rows={5} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">{t('inv.empty', 'Geen facturen gevonden')}</td></tr>
            ) : filtered.map((inv) => {
              const s = statusMap[inv.status] ?? { label: inv.status, cls: 'badge-gray' }
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

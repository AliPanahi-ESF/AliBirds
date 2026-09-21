import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import {
  Upload, CheckCircle, AlertCircle, Clock, Link2, Unlink,
  TrendingUp, TrendingDown, RefreshCw, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { bankApi, invoicesApi, fmt } from '@/lib/api'
import { BankTransaction, Invoice } from '@/lib/types'

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  MATCHED:             { label: 'Gematcht',     icon: CheckCircle,  cls: 'badge-green' },
  UNMATCHED:           { label: 'Niet gematcht', icon: AlertCircle,  cls: 'badge-red' },
  PENDING_CONFIRMATION: { label: 'Bevestigen',   icon: Clock,        cls: 'badge-yellow' },
  MANUAL:              { label: 'Handmatig',    icon: Link2,         cls: 'badge-purple' },
}

function MatchModal({
  transaction,
  invoices,
  onMatch,
  onClose,
}: {
  transaction: BankTransaction
  invoices: Invoice[]
  onMatch: (invoiceId: string) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState('')
  const candidates = invoices.filter(
    inv => ['SENT', 'OVERDUE', 'DRAFT'].includes(inv.status)
  )
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg animate-fade-in shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">Handmatig koppelen</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmt.currency(transaction.amount)} van {transaction.counterpart_name ?? 'onbekend'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 sm:p-4 space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-xs sm:text-sm text-slate-500 text-center py-6">Geen openstaande facturen gevonden</p>
          ) : candidates.map(inv => (
            <label
              key={inv.id}
              className={clsx(
                'flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors',
                selected === inv.id
                  ? 'bg-brand-600/15 border-brand-600/40'
                  : 'bg-slate-800/60 border-slate-700 hover:border-slate-600',
              )}
            >
              <input
                type="radio"
                name="invoice"
                value={inv.id}
                checked={selected === inv.id}
                onChange={() => setSelected(inv.id)}
                className="accent-brand-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-medium text-slate-200 font-mono">{inv.invoice_number}</div>
                <div className="text-xs text-slate-400 truncate">{inv.client?.name}</div>
              </div>
              <div className="font-mono text-xs sm:text-sm font-semibold text-slate-100">{fmt.currency(inv.total_incl_vat)}</div>
            </label>
          ))}
        </div>
        <div className="px-4 sm:px-5 py-3 border-t border-slate-800 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-xs sm:text-sm py-1.5 px-3">Annuleren</button>
          <button
            onClick={() => { if (selected) onMatch(selected) }}
            disabled={!selected}
            className="btn-primary text-xs sm:text-sm py-1.5 px-3.5"
          >
            <Link2 size={13} /> Koppelen
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BankReconciliation() {
  const qc = useQueryClient()
  const [matchModal, setMatchModal] = useState<BankTransaction | null>(null)

  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ['bank-transactions'],
    queryFn: () => bankApi.transactions(),
  })
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  })

  const uploadMutation = useMutation({
    mutationFn: bankApi.upload,
    onSuccess: (r) => {
      toast.success(`${r.inserted ?? 3} transacties verwerkt`)
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: () => toast.error('Upload mislukt'),
  })

  const reconcileMutation = useMutation({
    mutationFn: bankApi.reconcile,
    onSuccess: (r) => {
      toast.success(`Afstemming voltooid: ${r.reconciled ?? 1} gematcht`)
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
    },
  })

  const matchMutation = useMutation({
    mutationFn: ({ txId, invoiceId }: { txId: string; invoiceId: string }) =>
      bankApi.match(txId, invoiceId),
    onSuccess: () => {
      toast.success('Transactie gekoppeld!')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setMatchModal(null)
    },
  })

  const unmatchMutation = useMutation({
    mutationFn: (txId: string) => bankApi.unmatch(txId),
    onSuccess: () => {
      toast.success('Koppeling verwijderd')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
    },
  })

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) uploadMutation.mutate(files[0])
  }, [uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.sta', '.mt940', '.txt'] },
    maxFiles: 1,
  })

  const unmatched = transactions.filter(t => t.reconciliation_status === 'UNMATCHED').length
  const matched = transactions.filter(t => ['MATCHED', 'MANUAL'].includes(t.reconciliation_status)).length
  const pending = transactions.filter(t => t.reconciliation_status === 'PENDING_CONFIRMATION').length

  return (
    <div className="space-y-4 sm:space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Bankafschriften</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">MT940 afstemming van banktransacties</p>
        </div>
        <button
          onClick={() => reconcileMutation.mutate()}
          className="btn-secondary text-xs sm:text-sm py-2 px-3 self-start sm:self-auto"
          disabled={reconcileMutation.isPending}
        >
          <RefreshCw size={14} className={reconcileMutation.isPending ? 'animate-spin' : ''} />
          Opnieuw afstemmen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          { label: 'Gematcht', value: matched, cls: 'text-emerald-400' },
          { label: 'Te bevestigen', value: pending, cls: 'text-amber-400' },
          { label: 'Onbekend', value: unmatched, cls: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card p-3 sm:p-4 text-center">
            <div className={`text-xl sm:text-2xl font-bold font-mono ${s.cls}`}>{s.value}</div>
            <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Upload dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-brand-500 bg-brand-600/10'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/50',
        )}
      >
        <input {...getInputProps()} />
        <Upload size={24} className={clsx('mx-auto mb-2', isDragActive ? 'text-brand-400' : 'text-slate-500')} />
        <p className="text-xs sm:text-sm text-slate-300 font-medium">
          {uploadMutation.isPending
            ? 'Bestand verwerken...'
            : isDragActive
            ? 'Laat los om te uploaden'
            : 'Sleep uw MT940 bankafschrift (.sta) hierheen of tik om te uploaden'}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">Ondersteunt bunq, ING, Rabobank, ABN AMRO</p>
      </div>

      {/* Mobile Transactions (< md) */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <div className="card text-center py-10 text-xs text-slate-500">Transacties laden...</div>
        ) : transactions.length === 0 ? (
          <div className="card text-center py-10 text-xs text-slate-500">Geen transacties geregistreerd</div>
        ) : (
          transactions.map(txn => {
            const si = STATUS_INFO[txn.reconciliation_status] ?? STATUS_INFO.UNMATCHED
            const matched_inv = invoices.find(i => i.id === txn.matched_invoice_id)
            return (
              <div key={txn.id} className="card p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-slate-100">{txn.counterpart_name ?? 'Onbekende partij'}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{fmt.date(txn.transaction_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className={clsx(
                      'font-mono font-bold text-sm',
                      txn.type === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {txn.type === 'DEBIT' ? '−' : '+'}{fmt.currency(txn.amount)}
                    </div>
                    <span className={clsx(si.cls, 'text-[10px] mt-0.5 inline-block')}>{si.label}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-1.5 border-t border-slate-800 flex items-center justify-between">
                  <span className="truncate max-w-[200px]">{txn.remittance_reference ?? '—'}</span>
                  {matched_inv && (
                    <span className="font-mono text-brand-400 text-xs font-semibold">{matched_inv.invoice_number}</span>
                  )}
                  {txn.reconciliation_status !== 'MATCHED' && txn.reconciliation_status !== 'MANUAL' && (
                    <button
                      onClick={() => setMatchModal(txn)}
                      className="btn-secondary btn-sm text-xs py-1 px-2.5"
                    >
                      <Link2 size={12} /> Koppelen
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Transactions table (>= md) */}
      <div className="hidden md:block table-wrapper bg-slate-900">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-3.5 font-medium">Datum</th>
              <th className="p-3.5 font-medium">Type</th>
              <th className="p-3.5 font-medium">Tegenpartij</th>
              <th className="p-3.5 font-medium">Omschrijving</th>
              <th className="p-3.5 font-medium">Status</th>
              <th className="p-3.5 font-medium text-right">Bedrag</th>
              <th className="p-3.5 font-medium text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">Laden...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">Geen transacties geregistreerd</td></tr>
            ) : transactions.map(txn => {
              const si = STATUS_INFO[txn.reconciliation_status] ?? STATUS_INFO.UNMATCHED
              const matched_inv = invoices.find(i => i.id === txn.matched_invoice_id)
              return (
                <tr key={txn.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">{fmt.date(txn.transaction_date)}</td>
                  <td className="p-3.5">
                    {txn.type === 'CREDIT' ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <TrendingUp size={12} /> Credit
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                        <TrendingDown size={12} /> Debet
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <div className="text-sm font-medium text-slate-100">{txn.counterpart_name ?? '—'}</div>
                    {txn.counterpart_iban && (
                      <div className="text-xs text-slate-500 font-mono">{txn.counterpart_iban}</div>
                    )}
                  </td>
                  <td className="p-3.5 max-w-[200px]">
                    <div className="text-xs text-slate-400 truncate">{txn.remittance_reference ?? '—'}</div>
                    {matched_inv && (
                      <div className="text-xs text-brand-400 font-mono font-medium">{matched_inv.invoice_number}</div>
                    )}
                  </td>
                  <td className="p-3.5"><span className={si.cls}>{si.label}</span></td>
                  <td className={clsx(
                    'p-3.5 text-right font-mono font-semibold',
                    txn.type === 'CREDIT' ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {txn.type === 'DEBIT' ? '−' : '+'}{fmt.currency(txn.amount)}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex gap-1 justify-end">
                      {txn.reconciliation_status !== 'MATCHED' && txn.reconciliation_status !== 'MANUAL' && (
                        <button onClick={() => setMatchModal(txn)} className="btn-ghost p-1.5 rounded-lg text-slate-400" title="Koppelen">
                          <Link2 size={13} />
                        </button>
                      )}
                      {(txn.reconciliation_status === 'MATCHED' || txn.reconciliation_status === 'MANUAL' || txn.reconciliation_status === 'PENDING_CONFIRMATION') && (
                        <button onClick={() => unmatchMutation.mutate(txn.id)} className="btn-ghost p-1.5 rounded-lg text-red-400" title="Ontkoppelen">
                          <Unlink size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {matchModal && (
        <MatchModal
          transaction={matchModal}
          invoices={invoices}
          onMatch={(invoiceId) => matchMutation.mutate({ txId: matchModal.id, invoiceId })}
          onClose={() => setMatchModal(null)}
        />
      )}
    </div>
  )
}

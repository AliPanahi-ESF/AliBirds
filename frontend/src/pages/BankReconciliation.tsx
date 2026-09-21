import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import {
  Upload, CheckCircle, AlertCircle, Clock, Link2, Unlink,
  TrendingUp, TrendingDown, RefreshCw, X, UserPlus, Receipt, Trash2, Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { bankApi, invoicesApi, clientsApi, expensesApi, fmt } from '@/lib/api'
import { BankTransaction, Invoice, Client } from '@/lib/types'

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  MATCHED:              { label: 'Gematcht',     icon: CheckCircle,  cls: 'badge-green' },
  UNMATCHED:            { label: 'Niet gematcht', icon: AlertCircle,  cls: 'badge-red' },
  PENDING_CONFIRMATION: { label: 'Bevestigen',   icon: Clock,        cls: 'badge-yellow' },
  MANUAL:               { label: 'Handmatig',    icon: Link2,         cls: 'badge-purple' },
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
    inv => ['SENT', 'OVERDUE', 'DRAFT', 'PAID'].includes(inv.status)
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
            <p className="text-xs sm:text-sm text-slate-500 text-center py-6">Geen facturen gevonden</p>
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

function AddClientFromTxnModal({
  transaction,
  onClose,
  onCreated,
}: {
  transaction: BankTransaction
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState(transaction.counterpart_name ?? '')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [iban, setIban] = useState(transaction.counterpart_iban ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await clientsApi.create({
        name: name.trim(),
        contact_person: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        country_code: iban.startsWith('BE') ? 'BE' : iban.startsWith('DE') ? 'DE' : 'NL',
        default_payment_term_days: 14,
        notes: iban ? `IBAN: ${iban}` : undefined,
      })
      toast.success(`Klant "${name}" succesvol aangemaakt!`)
      onCreated()
      onClose()
    } catch {
      toast.error('Klant toevoegen mislukt')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md animate-fade-in shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-brand-400" />
            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">Klant toevoegen uit transactie</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="label text-xs">Bedrijfsnaam / Naam *</label>
            <input
              className="input text-xs sm:text-sm"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label text-xs">IBAN (uit bankafschrift)</label>
            <input
              className="input text-xs sm:text-sm font-mono text-slate-300"
              value={iban}
              onChange={e => setIban(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Contactpersoon (optioneel)</label>
            <input
              className="input text-xs sm:text-sm"
              placeholder="bijv. Jan Jansen"
              value={contactPerson}
              onChange={e => setContactPerson(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">E-mail (optioneel)</label>
            <input
              type="email"
              className="input text-xs sm:text-sm"
              placeholder="facturatie@bedrijf.nl"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="btn-secondary text-xs sm:text-sm py-1.5 px-3">
              Annuleren
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary text-xs sm:text-sm py-1.5 px-3.5">
              <Check size={14} /> {isSubmitting ? 'Opslaan...' : 'Klant opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddExpenseFromTxnModal({
  transaction,
  onClose,
  onCreated,
}: {
  transaction: BankTransaction
  onClose: () => void
  onCreated: () => void
}) {
  const [vendor, setVendor] = useState(transaction.counterpart_name ?? 'Leverancier')
  const [date, setDate] = useState(transaction.transaction_date ?? new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState(transaction.remittance_reference ?? 'Bankafschrijving')
  const [category, setCategory] = useState('Other')
  const [amountIncl, setAmountIncl] = useState(Number(transaction.amount))
  const [vatRate, setVatRate] = useState('21')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mult = vatRate === 'REVERSE_CHARGE' ? 0 : Number(vatRate) / 100
  const amountExcl = mult > 0 ? Math.round((amountIncl / (1 + mult)) * 100) / 100 : amountIncl
  const vatAmount = Math.round((amountIncl - amountExcl) * 100) / 100

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor.trim()) return
    setIsSubmitting(true)
    try {
      await expensesApi.create({
        vendor_name: vendor.trim(),
        expense_date: date,
        description: description.trim(),
        category,
        vat_rate: vatRate,
        amount_excl_vat: amountExcl,
        vat_amount: vatAmount,
        amount_incl_vat: amountIncl,
      })
      toast.success(`Kostenpost "${vendor}" succesvol opgeslagen!`)
      onCreated()
      onClose()
    } catch {
      toast.error('Kosten opslaan mislukt')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md animate-fade-in shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-purple-400" />
            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">Als uitgave opslaan</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="label text-xs">Leverancier *</label>
            <input
              className="input text-xs sm:text-sm"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Datum</label>
              <input
                type="date"
                className="input text-xs sm:text-sm"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Categorie</label>
              <select
                className="select text-xs sm:text-sm"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="Software">Software</option>
                <option value="Subscriptions">Abonnementen</option>
                <option value="Hardware">Hardware</option>
                <option value="Office">Kantoor</option>
                <option value="Travel">Reiskosten</option>
                <option value="Marketing">Marketing</option>
                <option value="Professional Services">Diensten</option>
                <option value="Other">Overig</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Bedrag incl. btw (€)</label>
              <input
                type="number"
                step="0.01"
                className="input text-xs sm:text-sm font-mono text-right"
                value={amountIncl}
                onChange={e => setAmountIncl(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label text-xs">Btw-tarief</label>
              <select
                className="select text-xs sm:text-sm"
                value={vatRate}
                onChange={e => setVatRate(e.target.value)}
              >
                <option value="21">21% (hoog)</option>
                <option value="9">9% (laag)</option>
                <option value="0">0% (nul)</option>
                <option value="REVERSE_CHARGE">Verlegd</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-400 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 flex justify-between">
            <span>Excl. btw: <strong className="text-slate-200 font-mono">{fmt.currency(amountExcl)}</strong></span>
            <span>Btw: <strong className="text-emerald-400 font-mono">{fmt.currency(vatAmount)}</strong></span>
          </div>
          <div>
            <label className="label text-xs">Omschrijving</label>
            <input
              className="input text-xs sm:text-sm"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="btn-secondary text-xs sm:text-sm py-1.5 px-3">
              Annuleren
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary text-xs sm:text-sm py-1.5 px-3.5">
              <Check size={14} /> {isSubmitting ? 'Opslaan...' : 'Kosten opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BankReconciliation() {
  const qc = useQueryClient()
  const [matchModal, setMatchModal] = useState<BankTransaction | null>(null)
  const [clientModalTxn, setClientModalTxn] = useState<BankTransaction | null>(null)
  const [expenseModalTxn, setExpenseModalTxn] = useState<BankTransaction | null>(null)

  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ['bank-transactions'],
    queryFn: () => bankApi.transactions(),
  })
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  })
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const uploadMutation = useMutation({
    mutationFn: bankApi.upload,
    onSuccess: (r) => {
      if (r.success) {
        toast.success(r.message || `${r.count} transacties verwerkt`)
      } else {
        toast.error(r.message || 'Geen transacties gevonden')
      }
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: () => toast.error('Upload mislukt'),
  })

  const reconcileMutation = useMutation({
    mutationFn: bankApi.reconcile,
    onSuccess: (r) => {
      toast.success(`Afstemming voltooid: ${r.matched ?? 0} gematcht`)
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: bankApi.clearAll,
    onSuccess: () => {
      toast.success('Alle banktransacties gewist')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
    },
    onError: () => toast.error('Wissen mislukt'),
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
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) uploadMutation.mutate(files[0])
  }, [uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.sta', '.mt940', '.txt', '.940'] },
    maxFiles: 1,
  })

  const unmatched = transactions.filter(t => t.reconciliation_status === 'UNMATCHED').length
  const matched = transactions.filter(t => ['MATCHED', 'MANUAL'].includes(t.reconciliation_status)).length
  const pending = transactions.filter(t => t.reconciliation_status === 'PENDING_CONFIRMATION').length

  const clientNameSet = new Set(clients.map(c => c.name.toLowerCase().trim()))

  return (
    <div className="space-y-4 sm:space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Bankafschriften</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">MT940 / .STA afstemming van bunq, Rabobank, ING, ABN</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {transactions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Weet u zeker dat u alle banktransacties wilt wissen?')) {
                  clearAllMutation.mutate()
                }
              }}
              disabled={clearAllMutation.isPending}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-2 px-3 border border-red-500/20 flex items-center gap-1.5"
              title="Alle transacties verwijderen"
            >
              <Trash2 size={14} />
              <span>Wissen</span>
            </button>
          )}
          <button
            onClick={() => reconcileMutation.mutate()}
            className="btn-secondary text-xs sm:text-sm py-2 px-3 flex items-center gap-1.5"
            disabled={reconcileMutation.isPending}
          >
            <RefreshCw size={14} className={reconcileMutation.isPending ? 'animate-spin' : ''} />
            <span>Opnieuw afstemmen</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          { label: 'Gematcht', value: matched, cls: 'text-emerald-400' },
          { label: 'Te bevestigen', value: pending, cls: 'text-amber-400' },
          { label: 'Openstaand', value: unmatched, cls: 'text-red-400' },
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
            ? 'Bestand analyseren & importeren...'
            : isDragActive
            ? 'Laat los om te uploaden'
            : 'Sleep uw bunq / Rabo / ING MT940 export (.sta) hierheen of klik om te uploaden'}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Leest automatisch IBAN, tegenpartijnaam, factuurnummer in referentie, en bedragen uit
        </p>
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
            const isClientKnown = txn.counterpart_name ? clientNameSet.has(txn.counterpart_name.toLowerCase().trim()) : false

            return (
              <div key={txn.id} className="card p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span>{txn.counterpart_name ?? 'Onbekende partij'}</span>
                      {txn.type === 'CREDIT' && txn.counterpart_name && !isClientKnown && (
                        <button
                          onClick={() => setClientModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 border border-brand-500/30 flex items-center gap-1"
                        >
                          <UserPlus size={10} /> + Klant
                        </button>
                      )}
                      {txn.type === 'DEBIT' && txn.counterpart_name && (
                        <button
                          onClick={() => setExpenseModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 flex items-center gap-1"
                        >
                          <Receipt size={10} /> + Uitgave
                        </button>
                      )}
                    </div>
                    {txn.counterpart_iban && (
                      <div className="text-[11px] text-slate-500 font-mono">{txn.counterpart_iban}</div>
                    )}
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

                <div className="text-xs text-slate-400 pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="truncate max-w-[200px] text-slate-400 font-mono text-[11px]">{txn.remittance_reference ?? '—'}</span>
                  {matched_inv ? (
                    <span className="font-mono text-brand-400 text-xs font-semibold">{matched_inv.invoice_number}</span>
                  ) : (
                    txn.type === 'CREDIT' && (
                      <button
                        onClick={() => setMatchModal(txn)}
                        className="btn-secondary btn-sm text-xs py-1 px-2.5 flex items-center gap-1"
                      >
                        <Link2 size={12} /> Koppelen
                      </button>
                    )
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
              <th className="p-3.5 font-medium">Omschrijving / Referentie</th>
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
              const isClientKnown = txn.counterpart_name ? clientNameSet.has(txn.counterpart_name.toLowerCase().trim()) : false

              return (
                <tr key={txn.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">{fmt.date(txn.transaction_date)}</td>
                  <td className="p-3.5">
                    {txn.type === 'CREDIT' ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <TrendingUp size={12} /> Bijschrijving
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                        <TrendingDown size={12} /> Afschrijving
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">{txn.counterpart_name ?? '—'}</span>
                      {txn.type === 'CREDIT' && txn.counterpart_name && !isClientKnown && (
                        <button
                          onClick={() => setClientModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 border border-brand-500/30 flex items-center gap-1"
                          title="Voeg toe als geregistreerde klant"
                        >
                          <UserPlus size={10} /> + Klant
                        </button>
                      )}
                      {txn.type === 'DEBIT' && txn.counterpart_name && (
                        <button
                          onClick={() => setExpenseModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 flex items-center gap-1"
                          title="Als zakelijke uitgave registreren"
                        >
                          <Receipt size={10} /> + Uitgave
                        </button>
                      )}
                    </div>
                    {txn.counterpart_iban && (
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{txn.counterpart_iban}</div>
                    )}
                  </td>
                  <td className="p-3.5 max-w-[220px]">
                    <div className="text-xs text-slate-400 truncate font-mono" title={txn.remittance_reference ?? ''}>
                      {txn.remittance_reference ?? '—'}
                    </div>
                    {matched_inv && (
                      <div className="text-xs text-brand-400 font-mono font-medium mt-0.5 flex items-center gap-1">
                        <Check size={12} /> Factuur {matched_inv.invoice_number}
                      </div>
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
                        <button
                          onClick={() => setMatchModal(txn)}
                          className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white"
                          title="Aan factuur koppelen"
                        >
                          <Link2 size={14} />
                        </button>
                      )}
                      {(txn.reconciliation_status === 'MATCHED' || txn.reconciliation_status === 'MANUAL' || txn.reconciliation_status === 'PENDING_CONFIRMATION') && (
                        <button
                          onClick={() => unmatchMutation.mutate(txn.id)}
                          className="btn-ghost p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Koppeling ongedaan maken"
                        >
                          <Unlink size={14} />
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

      {/* Match Modal */}
      {matchModal && (
        <MatchModal
          transaction={matchModal}
          invoices={invoices}
          onMatch={(invoiceId) => matchMutation.mutate({ txId: matchModal.id, invoiceId })}
          onClose={() => setMatchModal(null)}
        />
      )}

      {/* Add Client from Transaction Modal */}
      {clientModalTxn && (
        <AddClientFromTxnModal
          transaction={clientModalTxn}
          onClose={() => setClientModalTxn(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['clients'] })}
        />
      )}

      {/* Add Expense from Transaction Modal */}
      {expenseModalTxn && (
        <AddExpenseFromTxnModal
          transaction={expenseModalTxn}
          onClose={() => setExpenseModalTxn(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['expenses'] })}
        />
      )}
    </div>
  )
}

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import {
  Upload, CheckCircle, AlertCircle, Clock, Link2, Unlink,
  TrendingUp, TrendingDown, RefreshCw, X, UserPlus, Receipt, Trash2, Check, Search, PlusCircle, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { bankApi, invoicesApi, clientsApi, expensesApi, fmt } from '@/lib/api'
import { BankTransaction, Invoice, Client, Expense } from '@/lib/types'
import ConfirmDialog from '@/components/ConfirmDialog'

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  MATCHED:              { label: 'Gematcht',     icon: CheckCircle,  cls: 'badge-green' },
  UNMATCHED:            { label: 'Niet gematcht', icon: AlertCircle,  cls: 'badge-red' },
  PENDING_CONFIRMATION: { label: 'Bevestigen',   icon: Clock,        cls: 'badge-yellow' },
  MANUAL:               { label: 'Handmatig',    icon: Link2,         cls: 'badge-purple' },
}

function MatchModal({
  transaction,
  invoices,
  expenses,
  clients,
  onMatchInvoice,
  onMatchExpense,
  onUnmatch,
  onClose,
}: {
  transaction: BankTransaction
  invoices: Invoice[]
  expenses: Expense[]
  clients: Client[]
  onMatchInvoice: (invoiceId: string) => void
  onMatchExpense: (expenseId: string) => void
  onUnmatch: () => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isDebit = transaction.type === 'DEBIT' || (transaction as any).transaction_type === 'DEBIT'
  const txDate = transaction.transaction_date || (transaction as any).value_date || new Date().toISOString().slice(0, 10)
  const counterpartName = transaction.counterpart_name || (transaction as any).contra_account_name || ''
  const remittance = transaction.remittance_reference || (transaction as any).raw_reference || (transaction as any).description || ''

  // Primary mode: 'expense' (Uitgave / Kosten) vs 'invoice' (Klantfactuur)
  const [mode, setMode] = useState<'expense' | 'invoice'>(
    transaction.matched_expense_id
      ? 'expense'
      : transaction.matched_invoice_id
      ? 'invoice'
      : isDebit
      ? 'expense'
      : 'invoice'
  )

  // Sub-tabs
  const [expenseTab, setExpenseTab] = useState<'create' | 'existing'>(
    transaction.matched_expense_id ? 'existing' : 'create'
  )
  const [invoiceTab, setInvoiceTab] = useState<'existing' | 'create'>('existing')

  // Expense form state
  const [vendor, setVendor] = useState(counterpartName || 'Leverancier')
  const [expenseDate, setExpenseDate] = useState(txDate)
  const [expenseCategory, setExpenseCategory] = useState('Software')
  const [expenseDesc, setExpenseDesc] = useState(remittance || counterpartName || 'Zakelijke kosten')
  const [expenseAmountIncl, setExpenseAmountIncl] = useState(Number(transaction.amount))
  const [expenseVatRate, setExpenseVatRate] = useState('21')
  const [isCreatingExpense, setIsCreatingExpense] = useState(false)
  const [expenseSearch, setExpenseSearch] = useState('')
  const [selectedExpenseId, setSelectedExpenseId] = useState(transaction.matched_expense_id || '')

  const expMult = expenseVatRate === 'REVERSE_CHARGE' ? 0 : Number(expenseVatRate) / 100
  const expAmountExcl = expMult > 0 ? Math.round((expenseAmountIncl / (1 + expMult)) * 100) / 100 : expenseAmountIncl
  const expVatAmount = Math.round((expenseAmountIncl - expAmountExcl) * 100) / 100

  // Invoice form state
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(transaction.matched_invoice_id || '')
  const [markAsPaid, setMarkAsPaid] = useState(true)

  // Attempt to detect invoice number in remittance
  const detectedNumMatch = remittance.match(/\b(202\d[-_]\d{3,5}|\d{4,8})\b/)
  const detectedNum = detectedNumMatch ? detectedNumMatch[1].replace('_', '-') : `FACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  const existingClient = clients.find(c => counterpartName && c.name.toLowerCase().trim() === counterpartName.toLowerCase().trim())

  const [createInvoiceNum, setCreateInvoiceNum] = useState(detectedNum)
  const [createClientId, setCreateClientId] = useState(existingClient ? existingClient.id : 'NEW')
  const [newClientName, setNewClientName] = useState(counterpartName || 'Nieuwe Klant')
  const [createVatRate, setCreateVatRate] = useState('21')
  const [createDesc, setCreateDesc] = useState(remittance || `Diensten volgens betaling ${fmt.date(txDate)}`)
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)

  // Filter & sort invoices
  const filteredInvoices = invoices.filter(inv => {
    if (!invoiceSearch) return true
    const q = invoiceSearch.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.client?.name?.toLowerCase().includes(q) ||
      String(inv.total_incl_vat).includes(q)
    )
  })
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    const aAmount = Math.abs(Number(a.total_incl_vat) - Number(transaction.amount)) < 0.05
    const bAmount = Math.abs(Number(b.total_incl_vat) - Number(transaction.amount)) < 0.05
    if (aAmount && !bAmount) return -1
    if (!aAmount && bAmount) return 1
    return 0
  })

  // Filter & sort expenses
  const filteredExpenses = expenses.filter(exp => {
    if (!expenseSearch) return true
    const q = expenseSearch.toLowerCase()
    return (
      exp.vendor_name.toLowerCase().includes(q) ||
      (exp.description && exp.description.toLowerCase().includes(q)) ||
      exp.category.toLowerCase().includes(q) ||
      String(exp.amount_incl_vat).includes(q)
    )
  })
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const aAmount = Math.abs(Number(a.amount_incl_vat) - Number(transaction.amount)) < 0.05
    const bAmount = Math.abs(Number(b.amount_incl_vat) - Number(transaction.amount)) < 0.05
    if (aAmount && !bAmount) return -1
    if (!aAmount && bAmount) return 1
    return new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
  })

  const currentMatchedInvoice = invoices.find(i => i.id === transaction.matched_invoice_id)
  const currentMatchedExpense = expenses.find(e => e.id === transaction.matched_expense_id)

  const handleCreateExpenseAndMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor.trim()) return
    setIsCreatingExpense(true)
    try {
      const newExp = await expensesApi.create({
        vendor_name: vendor.trim(),
        expense_date: expenseDate,
        description: expenseDesc.trim(),
        category: expenseCategory,
        vat_rate: expenseVatRate,
        amount_excl_vat: expAmountExcl,
        vat_amount: expVatAmount,
        amount_incl_vat: expenseAmountIncl,
      })
      if (newExp && newExp.id) {
        onMatchExpense(newExp.id)
        toast.success(`Uitgave "${vendor}" aangemaakt en direct gekoppeld!`)
        qc.invalidateQueries({ queryKey: ['expenses'] })
        qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      }
    } catch {
      toast.error('Uitgave aanmaken mislukt')
    } finally {
      setIsCreatingExpense(false)
    }
  }

  const handleCreateInvoiceAndMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingInvoice(true)
    try {
      let finalClientId = createClientId
      if (createClientId === 'NEW' && newClientName.trim()) {
        const newC = await clientsApi.create({
          name: newClientName.trim(),
          country_code: 'NL',
          default_payment_term_days: 14,
        })
        finalClientId = newC.id
        qc.invalidateQueries({ queryKey: ['clients'] })
      }

      const totalIncl = Number(transaction.amount)
      const multiplier = createVatRate === 'REVERSE_CHARGE' ? 0 : Number(createVatRate) / 100
      const totalExcl = multiplier > 0 ? Math.round((totalIncl / (1 + multiplier)) * 100) / 100 : totalIncl
      const totalVat = Math.round((totalIncl - totalExcl) * 100) / 100

      const newInv = await invoicesApi.create({
        invoice_number: createInvoiceNum.trim(),
        client_id: finalClientId !== 'NEW' ? finalClientId : undefined,
        status: markAsPaid ? 'PAID' : 'SENT',
        issue_date: txDate,
        due_date: txDate,
        paid_at: markAsPaid ? txDate : null,
        subtotal_excl_vat: totalExcl,
        total_vat: totalVat,
        total_incl_vat: totalIncl,
        notes: createDesc,
        line_items: [
          {
            description: createDesc || `Diensten ${createInvoiceNum}`,
            quantity: 1,
            unit_price: totalExcl,
            vat_rate: createVatRate,
            total_excl_vat: totalExcl,
            total_vat: totalVat,
            total_incl_vat: totalIncl,
          }
        ]
      })

      if (newInv && newInv.id) {
        onMatchInvoice(newInv.id)
        toast.success(`Factuur ${createInvoiceNum} aangemaakt en gekoppeld!`)
        qc.invalidateQueries({ queryKey: ['invoices'] })
        qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      }
    } catch {
      toast.error('Factuur aanmaken mislukt')
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg animate-fade-in shadow-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">Transactie afstemmen & koppelen</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className={isDebit ? 'text-red-400 font-mono font-bold' : 'text-emerald-400 font-mono font-bold'}>
                {isDebit ? '−' : '+'}{fmt.currency(transaction.amount)}
              </span>
              {' · '}
              <span>{counterpartName || 'Onbekende partij'}</span>
              {' · '}
              <span className="font-mono">{fmt.date(txDate)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Current status if matched to invoice */}
        {currentMatchedInvoice && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-brand-950/40 border border-brand-500/30 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-400 block">Momenteel gekoppeld aan verkoopfactuur:</span>
              <strong className="text-brand-300 font-mono text-sm">{currentMatchedInvoice.invoice_number}</strong>
              <span className="text-slate-400 ml-2">({currentMatchedInvoice.client?.name || 'Onbekende klant'} · {fmt.currency(currentMatchedInvoice.total_incl_vat)})</span>
            </div>
            <button
              onClick={() => { onUnmatch(); onClose(); }}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-1 px-2 border border-red-500/20 flex items-center gap-1"
            >
              <Unlink size={12} /> Ontkoppelen
            </button>
          </div>
        )}

        {/* Current status if matched to expense */}
        {currentMatchedExpense && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-purple-950/40 border border-purple-500/30 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-400 block">Momenteel gekoppeld aan uitgave / kosten:</span>
              <strong className="text-purple-300 font-medium text-sm">{currentMatchedExpense.vendor_name}</strong>
              <span className="text-slate-400 ml-2 font-mono">({fmt.currency(currentMatchedExpense.amount_incl_vat)} · {currentMatchedExpense.category})</span>
            </div>
            <button
              onClick={() => { onUnmatch(); onClose(); }}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-1 px-2 border border-red-500/20 flex items-center gap-1"
            >
              <Unlink size={12} /> Ontkoppelen
            </button>
          </div>
        )}

        {/* Primary Type Selection Tabs (Uitgave vs Verkoopfactuur) */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('expense')}
              className={clsx(
                'py-2 rounded-lg transition-all flex items-center justify-center gap-1.5',
                mode === 'expense'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Receipt size={14} />
              <span>Uitgave (Kosten)</span>
              {isDebit && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 font-normal">
                  Aanbevolen
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode('invoice')}
              className={clsx(
                'py-2 rounded-lg transition-all flex items-center justify-center gap-1.5',
                mode === 'invoice'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <FileText size={14} />
              <span>Verkoopfactuur (Omzet)</span>
              {!isDebit && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-900/60 text-brand-200 font-normal">
                  Aanbevolen
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ======================= MODE: EXPENSE ======================= */}
        {mode === 'expense' && (
          <div className="pt-3">
            {/* Subtabs for expense */}
            <div className="px-5">
              <div className="grid grid-cols-2 p-0.5 bg-slate-800/60 rounded-lg border border-slate-700/50 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setExpenseTab('create')}
                  className={clsx(
                    'py-1.5 rounded-md transition-all flex items-center justify-center gap-1',
                    expenseTab === 'create'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <PlusCircle size={12} />
                  <span>Kostenpost aanmaken o.b.v. transactie</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseTab('existing')}
                  className={clsx(
                    'py-1.5 rounded-md transition-all flex items-center justify-center gap-1',
                    expenseTab === 'existing'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <Link2 size={12} />
                  <span>Bestaande uitgave</span>
                </button>
              </div>
            </div>

            {/* Subtab 1: Create expense and match */}
            {expenseTab === 'create' && (
              <form onSubmit={handleCreateExpenseAndMatch} className="p-5 space-y-3">
                <div>
                  <label className="label text-xs">Leverancier / Begunstigde *</label>
                  <input
                    className="input text-xs sm:text-sm"
                    value={vendor}
                    onChange={e => setVendor(e.target.value)}
                    placeholder="bijv. Google Workspace, NS Zakelijk, Bol.com..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Datum</label>
                    <input
                      type="date"
                      className="input text-xs sm:text-sm font-mono"
                      value={expenseDate}
                      onChange={e => setExpenseDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Categorie</label>
                    <select
                      className="select text-xs sm:text-sm"
                      value={expenseCategory}
                      onChange={e => setExpenseCategory(e.target.value)}
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
                      value={expenseAmountIncl}
                      onChange={e => setExpenseAmountIncl(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Btw-tarief</label>
                    <select
                      className="select text-xs sm:text-sm"
                      value={expenseVatRate}
                      onChange={e => setExpenseVatRate(e.target.value)}
                    >
                      <option value="21">21% (hoog)</option>
                      <option value="9">9% (laag)</option>
                      <option value="0">0% (nul)</option>
                      <option value="REVERSE_CHARGE">Verlegd</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-slate-400 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 flex justify-between font-mono">
                  <span>Excl. btw: <strong className="text-slate-200">{fmt.currency(expAmountExcl)}</strong></span>
                  <span>Btw: <strong className="text-purple-400">{fmt.currency(expVatAmount)}</strong></span>
                </div>

                <div>
                  <label className="label text-xs">Omschrijving</label>
                  <input
                    className="input text-xs sm:text-sm"
                    value={expenseDesc}
                    onChange={e => setExpenseDesc(e.target.value)}
                    placeholder="Omschrijving van de aankoop of dienst..."
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button type="button" onClick={onClose} className="btn-secondary text-xs sm:text-sm py-1.5 px-3">
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingExpense}
                    className="btn-primary bg-purple-600 hover:bg-purple-500 border-purple-500 text-white text-xs sm:text-sm py-1.5 px-3.5 flex items-center gap-1.5"
                  >
                    <Check size={14} /> {isCreatingExpense ? 'Maken...' : 'Uitgave opslaan & direct koppelen'}
                  </button>
                </div>
              </form>
            )}

            {/* Subtab 2: Link existing expense */}
            {expenseTab === 'existing' && (
              <div className="p-5 space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-8 text-xs sm:text-sm py-2"
                    placeholder="Zoek leverancier, categorie of bedrag..."
                    value={expenseSearch}
                    onChange={e => setExpenseSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {sortedExpenses.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      Geen uitgaven gevonden. Gebruik het tabblad "Kostenpost aanmaken o.b.v. transactie".
                    </div>
                  ) : (
                    sortedExpenses.map(exp => {
                      const isExactAmount = Math.abs(Number(exp.amount_incl_vat) - Number(transaction.amount)) < 0.05
                      const isSelected = selectedExpenseId === exp.id

                      return (
                        <label
                          key={exp.id}
                          className={clsx(
                            'flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-purple-600/20 border-purple-500'
                              : isExactAmount
                              ? 'bg-slate-800/80 border-purple-500/40 hover:border-purple-500/60'
                              : 'bg-slate-800/40 border-slate-800 hover:border-slate-700',
                          )}
                        >
                          <input
                            type="radio"
                            name="expense"
                            value={exp.id}
                            checked={isSelected}
                            onChange={() => setSelectedExpenseId(exp.id)}
                            className="accent-purple-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-semibold text-slate-200">{exp.vendor_name}</span>
                              {isExactAmount && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-medium">
                                  Exact bedrag
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 rounded bg-slate-700/60 text-slate-400">{exp.category}</span>
                            </div>
                            <div className="text-xs text-slate-400 truncate mt-0.5">
                              {exp.description || 'Geen omschrijving'} · {fmt.date(exp.expense_date)}
                            </div>
                          </div>
                          <div className="font-mono text-xs sm:text-sm font-bold text-slate-100">
                            {fmt.currency(exp.amount_incl_vat)}
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                  <button type="button" onClick={onClose} className="btn-secondary text-xs sm:text-sm py-1.5 px-3">
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (selectedExpenseId) onMatchExpense(selectedExpenseId); }}
                    disabled={!selectedExpenseId}
                    className="btn-primary bg-purple-600 hover:bg-purple-500 border-purple-500 text-white text-xs sm:text-sm py-1.5 px-3.5 flex items-center gap-1.5"
                  >
                    <Link2 size={13} /> Koppeling opslaan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= MODE: INVOICE ======================= */}
        {mode === 'invoice' && (
          <div className="pt-3">
            {/* Subtabs for invoice */}
            <div className="px-5">
              <div className="grid grid-cols-2 p-0.5 bg-slate-800/60 rounded-lg border border-slate-700/50 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setInvoiceTab('existing')}
                  className={clsx(
                    'py-1.5 rounded-md transition-all flex items-center justify-center gap-1',
                    invoiceTab === 'existing'
                      ? 'bg-brand-600/30 text-brand-200 border border-brand-500/40 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <Link2 size={12} />
                  <span>Bestaande factuur</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceTab('create')}
                  className={clsx(
                    'py-1.5 rounded-md transition-all flex items-center justify-center gap-1',
                    invoiceTab === 'create'
                      ? 'bg-brand-600/30 text-brand-200 border border-brand-500/40 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <PlusCircle size={12} />
                  <span>Nieuwe factuur maken</span>
                </button>
              </div>
            </div>

            {/* Subtab 1: Existing Invoices */}
            {invoiceTab === 'existing' && (
              <div className="p-5 space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-8 text-xs sm:text-sm py-2"
                    placeholder="Zoek factuurnummer, klant of bedrag..."
                    value={invoiceSearch}
                    onChange={e => setInvoiceSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {sortedInvoices.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      Geen facturen gevonden. Gebruik het tabblad "Nieuwe factuur maken".
                    </div>
                  ) : (
                    sortedInvoices.map(inv => {
                      const isExactAmount = Math.abs(Number(inv.total_incl_vat) - Number(transaction.amount)) < 0.05
                      const isSelected = selectedInvoiceId === inv.id

                      return (
                        <label
                          key={inv.id}
                          className={clsx(
                            'flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-brand-600/20 border-brand-500'
                              : isExactAmount
                              ? 'bg-slate-800/80 border-emerald-500/40 hover:border-emerald-500/60'
                              : 'bg-slate-800/40 border-slate-800 hover:border-slate-700',
                          )}
                        >
                          <input
                            type="radio"
                            name="invoice"
                            value={inv.id}
                            checked={isSelected}
                            onChange={() => setSelectedInvoiceId(inv.id)}
                            className="accent-brand-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-semibold text-slate-200 font-mono">{inv.invoice_number}</span>
                              {isExactAmount && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                                  Exact bedrag
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 rounded bg-slate-700/60 text-slate-400">{inv.status}</span>
                            </div>
                            <div className="text-xs text-slate-400 truncate mt-0.5">
                              {inv.client?.name || 'Onbekende klant'} · {fmt.date(inv.issue_date)}
                            </div>
                          </div>
                          <div className="font-mono text-xs sm:text-sm font-bold text-slate-100">
                            {fmt.currency(inv.total_incl_vat)}
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markAsPaid}
                      onChange={e => setMarkAsPaid(e.target.checked)}
                      className="accent-brand-500 rounded"
                    />
                    <span>Markeer factuur direct als 'Betaald'</span>
                  </label>

                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary text-xs sm:text-sm py-1.5 px-3">
                      Annuleren
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (selectedInvoiceId) onMatchInvoice(selectedInvoiceId); }}
                      disabled={!selectedInvoiceId}
                      className="btn-primary text-xs sm:text-sm py-1.5 px-3.5"
                    >
                      <Link2 size={13} /> Koppeling opslaan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subtab 2: Create New Invoice & Match */}
            {invoiceTab === 'create' && (
              <form onSubmit={handleCreateInvoiceAndMatch} className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Factuurnummer *</label>
                    <input
                      className="input text-xs sm:text-sm font-mono"
                      value={createInvoiceNum}
                      onChange={e => setCreateInvoiceNum(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Btw-tarief</label>
                    <select
                      className="select text-xs sm:text-sm"
                      value={createVatRate}
                      onChange={e => setCreateVatRate(e.target.value)}
                    >
                      <option value="21">21% hoog</option>
                      <option value="9">9% laag</option>
                      <option value="0">0% nul</option>
                      <option value="REVERSE_CHARGE">Verlegd</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label text-xs">Opdrachtgever / Klant</label>
                  <select
                    className="select text-xs sm:text-sm"
                    value={createClientId}
                    onChange={e => setCreateClientId(e.target.value)}
                  >
                    <option value="NEW">+ Nieuwe klant: {newClientName || counterpartName || 'Invoeren...'}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {createClientId === 'NEW' && (
                    <input
                      className="input text-xs sm:text-sm mt-1.5"
                      placeholder="Bedrijfsnaam klant..."
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label className="label text-xs">Omschrijving op factuur</label>
                  <input
                    className="input text-xs sm:text-sm"
                    value={createDesc}
                    onChange={e => setCreateDesc(e.target.value)}
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 text-xs text-slate-300 flex justify-between items-center font-mono">
                  <span>Factuurbedrag incl. btw:</span>
                  <span className="font-bold text-emerald-400 text-sm">{fmt.currency(transaction.amount)}</span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markAsPaid}
                      onChange={e => setMarkAsPaid(e.target.checked)}
                      className="accent-brand-500 rounded"
                    />
                    <span>Direct als 'Betaald' boeken</span>
                  </label>

                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary text-xs sm:text-sm py-1.5 px-3">
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingInvoice}
                      className="btn-primary text-xs sm:text-sm py-1.5 px-3.5"
                    >
                      <Check size={14} /> {isCreatingInvoice ? 'Maken...' : 'Aanmaken & koppelen'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
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
  const [name, setName] = useState(transaction.counterpart_name || (transaction as any).contra_account_name || '')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [iban, setIban] = useState(transaction.counterpart_iban || (transaction as any).contra_account_iban || '')
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
  const [vendor, setVendor] = useState(transaction.counterpart_name || (transaction as any).contra_account_name || 'Leverancier')
  const [date, setDate] = useState(transaction.transaction_date || (transaction as any).value_date || new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState(transaction.remittance_reference || (transaction as any).raw_reference || (transaction as any).description || 'Bankafschrijving')
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
      const newExp = await expensesApi.create({
        vendor_name: vendor.trim(),
        expense_date: date,
        description: description.trim(),
        category,
        vat_rate: vatRate,
        amount_excl_vat: amountExcl,
        vat_amount: vatAmount,
        amount_incl_vat: amountIncl,
      })
      if (newExp && newExp.id) {
        await bankApi.matchExpense(transaction.id, newExp.id)
      }
      toast.success(`Kostenpost "${vendor}" opgeslagen en direct gekoppeld!`)
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
            <h3 className="font-semibold text-slate-100 text-sm sm:text-base">Als uitgave opslaan & direct koppelen</h3>
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
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ['bank-transactions'],
    queryFn: () => bankApi.transactions(),
  })
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  })
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.list(),
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
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: () => toast.error('Upload mislukt'),
  })

  const reconcileMutation = useMutation({
    mutationFn: bankApi.reconcile,
    onSuccess: (r) => {
      toast.success(`Afstemming voltooid: ${r.matched ?? 0} gematcht`)
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })

  const clearAllMutation = useMutation({
    mutationFn: bankApi.clearAll,
    onSuccess: () => {
      toast.success('Alle banktransacties gewist')
      setConfirmClearAll(false)
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
    },
    onError: () => toast.error('Wissen mislukt'),
  })

  const matchInvoiceMutation = useMutation({
    mutationFn: ({ txId, invoiceId }: { txId: string; invoiceId: string }) =>
      bankApi.match(txId, invoiceId),
    onSuccess: () => {
      toast.success('Transactie gekoppeld aan factuur!')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setMatchModal(null)
    },
  })

  const matchExpenseMutation = useMutation({
    mutationFn: ({ txId, expenseId }: { txId: string; expenseId: string }) =>
      bankApi.matchExpense(txId, expenseId),
    onSuccess: () => {
      toast.success('Transactie gekoppeld aan uitgave!')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setMatchModal(null)
    },
  })

  const unmatchMutation = useMutation({
    mutationFn: (txId: string) => bankApi.unmatch(txId),
    onSuccess: () => {
      toast.success('Koppeling verwijderd')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
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
              onClick={() => setConfirmClearAll(true)}
              disabled={clearAllMutation.isPending}
              className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 py-2 px-3 border border-red-500/20 flex items-center gap-1.5"
              title="Alle transacties verwijderen"
              aria-label="Alle banktransacties wissen"
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
            const matched_exp = expenses.find(e => e.id === txn.matched_expense_id)
            const isMatched = !!(matched_inv || matched_exp)
            const isDebit = txn.type === 'DEBIT' || (txn as any).transaction_type === 'DEBIT'
            const txDate = txn.transaction_date || (txn as any).value_date || (txn as any).entry_date
            const counterpartName = txn.counterpart_name || (txn as any).contra_account_name || ''
            const counterpartIban = txn.counterpart_iban || (txn as any).contra_account_iban || ''
            const remittance = txn.remittance_reference || (txn as any).raw_reference || (txn as any).description || ''
            const isClientKnown = counterpartName ? clientNameSet.has(counterpartName.toLowerCase().trim()) : false

            return (
              <div key={txn.id} className="card p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span>{counterpartName || 'Onbekende partij'}</span>
                      {!isDebit && counterpartName && !isClientKnown && (
                        <button
                          onClick={() => setClientModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 border border-brand-500/30 flex items-center gap-1"
                        >
                          <UserPlus size={10} /> + Klant
                        </button>
                      )}
                      {isDebit && counterpartName && !isMatched && (
                        <button
                          onClick={() => setExpenseModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 flex items-center gap-1"
                          title="Als uitgave opslaan en direct koppelen"
                        >
                          <Receipt size={10} /> + Uitgave
                        </button>
                      )}
                    </div>
                    {counterpartIban && (
                      <div className="text-[11px] text-slate-500 font-mono">{counterpartIban}</div>
                    )}
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{fmt.date(txDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className={clsx(
                      'font-mono font-bold text-sm',
                      isDebit ? 'text-red-400' : 'text-emerald-400'
                    )}>
                      {isDebit ? '−' : '+'}{fmt.currency(txn.amount)}
                    </div>
                    <span className={clsx(si.cls, 'text-[10px] mt-0.5 inline-block')}>{si.label}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="truncate max-w-[200px]">
                    <div className="text-slate-400 font-mono text-[11px] truncate">{remittance || '—'}</div>
                    {matched_inv && (
                      <div className="font-mono text-brand-400 text-xs font-semibold flex items-center gap-1 mt-0.5">
                        <Check size={11} /> Factuur {matched_inv.invoice_number}
                      </div>
                    )}
                    {matched_exp && (
                      <div className="text-purple-400 text-xs font-medium flex items-center gap-1 mt-0.5 truncate">
                        <Receipt size={11} /> Uitgave: {matched_exp.vendor_name}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setMatchModal(txn)}
                      className={clsx(
                        'btn-sm text-xs py-1 px-2.5 flex items-center gap-1',
                        isMatched ? 'btn-ghost text-slate-400 hover:text-white' : 'btn-secondary text-brand-300'
                      )}
                    >
                      <Link2 size={12} /> {isMatched ? 'Wijzigen' : 'Koppelen'}
                    </button>
                    {isMatched && (
                      <button
                        onClick={() => unmatchMutation.mutate(txn.id)}
                        className="btn-ghost p-1 text-red-400 hover:text-red-300"
                        title="Koppeling ongedaan maken"
                      >
                        <Unlink size={13} />
                      </button>
                    )}
                  </div>
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
              const matched_exp = expenses.find(e => e.id === txn.matched_expense_id)
              const isMatched = !!(matched_inv || matched_exp)
              const isDebit = txn.type === 'DEBIT' || (txn as any).transaction_type === 'DEBIT'
              const txDate = txn.transaction_date || (txn as any).value_date || (txn as any).entry_date
              const counterpartName = txn.counterpart_name || (txn as any).contra_account_name || ''
              const counterpartIban = txn.counterpart_iban || (txn as any).contra_account_iban || ''
              const remittance = txn.remittance_reference || (txn as any).raw_reference || (txn as any).description || ''
              const isClientKnown = counterpartName ? clientNameSet.has(counterpartName.toLowerCase().trim()) : false

              return (
                <tr key={txn.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">{fmt.date(txDate)}</td>
                  <td className="p-3.5">
                    {!isDebit ? (
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
                      <span className="text-sm font-medium text-slate-100">{counterpartName || '—'}</span>
                      {!isDebit && counterpartName && !isClientKnown && (
                        <button
                          onClick={() => setClientModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 border border-brand-500/30 flex items-center gap-1"
                          title="Voeg toe als geregistreerde klant"
                        >
                          <UserPlus size={10} /> + Klant
                        </button>
                      )}
                      {isDebit && counterpartName && !isMatched && (
                        <button
                          onClick={() => setExpenseModalTxn(txn)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 flex items-center gap-1"
                          title="Als zakelijke uitgave registreren en direct koppelen"
                        >
                          <Receipt size={10} /> + Uitgave
                        </button>
                      )}
                    </div>
                    {counterpartIban && (
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{counterpartIban}</div>
                    )}
                  </td>
                  <td className="p-3.5 max-w-[240px]">
                    <div className="text-xs text-slate-400 truncate font-mono" title={remittance}>
                      {remittance || '—'}
                    </div>
                    {matched_inv && (
                      <div className="text-xs text-brand-400 font-mono font-medium mt-0.5 flex items-center gap-1">
                        <Check size={12} /> Factuur {matched_inv.invoice_number}
                      </div>
                    )}
                    {matched_exp && (
                      <div className="text-xs text-purple-400 font-medium mt-0.5 flex items-center gap-1">
                        <Receipt size={12} /> Uitgave: {matched_exp.vendor_name} ({fmt.currency(matched_exp.amount_incl_vat)})
                      </div>
                    )}
                  </td>
                  <td className="p-3.5"><span className={si.cls}>{si.label}</span></td>
                  <td className={clsx(
                    'p-3.5 text-right font-mono font-semibold',
                    isDebit ? 'text-red-400' : 'text-emerald-400',
                  )}>
                    {isDebit ? '−' : '+'}{fmt.currency(txn.amount)}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex gap-1 justify-end items-center">
                      <button
                        onClick={() => setMatchModal(txn)}
                        className={clsx(
                          'p-1.5 rounded-lg flex items-center gap-1 text-xs transition-colors',
                          isMatched
                            ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
                            : 'text-brand-400 hover:text-brand-300 bg-brand-600/15 hover:bg-brand-600/25 border border-brand-500/30'
                        )}
                        title={isMatched ? 'Koppeling wijzigen' : 'Aan factuur of uitgave koppelen'}
                      >
                        <Link2 size={13} />
                        <span>{isMatched ? 'Wijzigen' : 'Koppelen'}</span>
                      </button>
                      {isMatched && (
                        <button
                          onClick={() => unmatchMutation.mutate(txn.id)}
                          className="btn-ghost p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Koppeling ongedaan maken"
                        >
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

      {/* Match Modal */}
      {matchModal && (
        <MatchModal
          transaction={matchModal}
          invoices={invoices}
          expenses={expenses}
          clients={clients}
          onMatchInvoice={(invoiceId) => matchInvoiceMutation.mutate({ txId: matchModal.id, invoiceId })}
          onMatchExpense={(expenseId) => matchExpenseMutation.mutate({ txId: matchModal.id, expenseId })}
          onUnmatch={() => unmatchMutation.mutate(matchModal.id)}
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
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['expenses'] })
            qc.invalidateQueries({ queryKey: ['bank-transactions'] })
          }}
        />
      )}

      {/* Clear All Bank Transactions Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmClearAll}
        title="Alle banktransacties wissen"
        description="Weet u zeker dat u alle geïmporteerde banktransacties wilt wissen? Gekoppelde facturen en uitgaven blijven behouden maar worden ontkoppeld."
        confirmLabel="Alle transacties wissen"
        cancelLabel="Annuleren"
        variant="danger"
        isLoading={clearAllMutation.isPending}
        onConfirm={() => clearAllMutation.mutate()}
        onClose={() => setConfirmClearAll(false)}
      />
    </div>
  )
}

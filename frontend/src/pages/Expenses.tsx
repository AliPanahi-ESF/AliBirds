import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Receipt, X, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { expensesApi, fmt } from '@/lib/api'
import { Expense } from '@/lib/types'
import { clsx } from 'clsx'
import ConfirmDialog from '@/components/ConfirmDialog'
import { TableRowSkeleton, CardSkeleton } from '@/components/TableSkeleton'

const CATEGORIES = [
  'Software', 'Hardware', 'Kantoor', 'Abonnementen',
  'Reiskosten', 'Marketing', 'Professionele Diensten', 'Overig',
]

const CAT_COLORS: Record<string, string> = {
  Software: 'badge-blue', Hardware: 'badge-purple',
  Kantoor: 'badge-gray', Office: 'badge-gray',
  Abonnementen: 'badge-yellow', Subscriptions: 'badge-yellow',
  Reiskosten: 'badge-green', Travel: 'badge-green',
  Marketing: 'badge-red',
  'Professionele Diensten': 'badge-blue', 'Professional Services': 'badge-blue',
  Overig: 'badge-gray', Other: 'badge-gray',
}

const CAT_LABELS: Record<string, string> = {
  Office: 'Kantoor',
  Subscriptions: 'Abonnementen',
  Travel: 'Reiskosten',
  'Professional Services': 'Professionele Diensten',
  Other: 'Overig',
}

export function formatCategory(cat: string) {
  return CAT_LABELS[cat] || cat
}

interface ExpenseForm {
  vendor_name: string
  expense_date: string
  description: string
  category: string
  amount_excl_vat: number
  vat_rate: string
  amount_incl_vat: number
  vat_amount: number
}

export default function Expenses() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.list(),
  })

  const { register, handleSubmit, watch, setValue, reset } = useForm<ExpenseForm>({
    defaultValues: {
      vendor_name: '',
      expense_date: today,
      description: '',
      category: 'Software',
      amount_excl_vat: 0,
      vat_rate: '21',
      amount_incl_vat: 0,
      vat_amount: 0,
    },
  })

  const excl = watch('amount_excl_vat')
  const rate = watch('vat_rate')

  const recalcFromExcl = (v: number) => {
    const r = rate === 'REVERSE_CHARGE' ? 0 : (Number(rate) / 100)
    const vat = Number(v) * r
    const incl = Number(v) + vat
    setValue('vat_amount', Math.round(vat * 100) / 100)
    setValue('amount_incl_vat', Math.round(incl * 100) / 100)
  }

  const createMutation = useMutation({
    mutationFn: (data: ExpenseForm) => expensesApi.create({
      ...data,
      amount_excl_vat: Number(data.amount_excl_vat),
      vat_amount: Number(data.vat_amount),
      amount_incl_vat: Number(data.amount_incl_vat),
    }),
    onSuccess: () => {
      toast.success('Kosten toegevoegd')
      qc.invalidateQueries({ queryKey: ['expenses'] })
      reset()
      setShowForm(false)
    },
    onError: () => toast.error('Opslaan mislukt'),
  })

  const deleteMutation = useMutation({
    mutationFn: expensesApi.delete,
    onSuccess: () => {
      toast.success('Kosten verwijderd')
      setDeletingExpense(null)
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: () => toast.error('Verwijderen mislukt'),
  })

  const totalExcl = expenses.reduce((s, e) => s + Number(e.amount_excl_vat), 0)
  const totalVat = expenses.reduce((s, e) => s + Number(e.vat_amount), 0)

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Kosten</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Zakelijke uitgaven en voorbelasting (5b)</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-xs sm:text-sm py-2 px-3.5"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Sluiten' : 'Kosten toevoegen'}
        </button>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-3.5 sm:p-5">
          <div className="text-base sm:text-xl font-bold font-mono text-slate-100">{fmt.currency(totalExcl)}</div>
          <div className="text-xs text-slate-400 mt-1">Totaal excl. btw</div>
        </div>
        <div className="card p-3.5 sm:p-5">
          <div className="text-base sm:text-xl font-bold font-mono text-emerald-400">{fmt.currency(totalVat)}</div>
          <div className="text-xs text-slate-400 mt-1">Voorbelasting (5b)</div>
        </div>
        <div className="card p-3.5 sm:p-5 col-span-2 sm:col-span-1">
          <div className="text-base sm:text-xl font-bold font-mono text-slate-100">{expenses.length}</div>
          <div className="text-xs text-slate-400 mt-1">Geregistreerde posten</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card p-4 sm:p-5 animate-fade-in border-brand-600/30">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Nieuwe kostenpost invoeren</h2>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Leverancier *</label>
                <input className="input text-xs sm:text-sm" placeholder="Adobe, NS, Apple..." {...register('vendor_name', { required: true })} />
              </div>
              <div>
                <label className="label">Datum</label>
                <input type="date" className="input text-xs sm:text-sm" {...register('expense_date')} />
              </div>
              <div>
                <label className="label">Categorie</label>
                <select className="select text-xs sm:text-sm" {...register('category')}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Omschrijving</label>
              <input className="input text-xs sm:text-sm" placeholder="Bijv. Maandabonnement Cloud licenties..." {...register('description')} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Excl. btw</label>
                <input
                  type="number" step="0.01" className="input text-xs sm:text-sm font-mono text-right"
                  {...register('amount_excl_vat', { valueAsNumber: true })}
                  onBlur={e => recalcFromExcl(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Btw%</label>
                <select className="select text-xs sm:text-sm" {...register('vat_rate')}
                  onChange={e => { setValue('vat_rate', e.target.value); recalcFromExcl(excl) }}>
                  <option value="21">21% (hoog)</option>
                  <option value="9">9% (laag)</option>
                  <option value="0">0% (nul)</option>
                </select>
              </div>
              <div>
                <label className="label">Btw bedrag</label>
                <input type="number" step="0.01" className="input text-xs sm:text-sm font-mono text-right text-emerald-400" readOnly
                  {...register('vat_amount', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="label">Totaal incl.</label>
                <input type="number" step="0.01" className="input text-xs sm:text-sm font-mono text-right font-bold text-slate-100" readOnly
                  {...register('amount_incl_vat', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs sm:text-sm py-2 px-3">
                Annuleren
              </button>
              <button type="submit" className="btn-primary text-xs sm:text-sm py-2 px-4" disabled={createMutation.isPending}>
                <Receipt size={14} /> {createMutation.isPending ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <CardSkeleton count={4} />
        ) : expenses.length === 0 ? (
          <div className="card text-center py-10 text-xs text-slate-500">Geen kosten gevonden</div>
        ) : (
          expenses.map(exp => (
            <div key={exp.id} className="card p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-slate-100">{exp.vendor_name}</div>
                  {exp.description && (
                    <div className="text-xs text-slate-400 mt-0.5">{exp.description}</div>
                  )}
                </div>
                <span className={clsx(CAT_COLORS[exp.category] ?? 'badge-gray', 'text-[10px]')}>{formatCategory(exp.category)}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800 text-slate-400">
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-500" />
                  <span>{fmt.date(exp.expense_date)}</span>
                  <span className="text-slate-600">·</span>
                  <span>{exp.vat_rate}% btw</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-slate-100">{fmt.currency(Number(exp.amount_incl_vat))}</span>
                    <span className="text-[10px] text-emerald-400 block font-mono">+{fmt.currency(Number(exp.vat_amount))} btw</span>
                  </div>
                  <button
                    onClick={() => setDeletingExpense(exp)}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-1"
                    title="Uitgave verwijderen"
                    aria-label={`Uitgave van ${exp.vendor_name} verwijderen`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Expenses table (>= md) */}
      <div className="hidden md:block table-wrapper bg-slate-900">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-3.5 font-medium">Datum</th>
              <th className="p-3.5 font-medium">Leverancier</th>
              <th className="p-3.5 font-medium">Omschrijving</th>
              <th className="p-3.5 font-medium">Categorie</th>
              <th className="p-3.5 font-medium">Btw%</th>
              <th className="p-3.5 font-medium text-right">Excl. btw</th>
              <th className="p-3.5 font-medium text-right">Btw</th>
              <th className="p-3.5 font-medium text-right">Incl. btw</th>
              <th className="p-3.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <TableRowSkeleton cols={9} rows={5} />
            ) : expenses.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-slate-500">Nog geen kosten geregistreerd</td></tr>
            ) : expenses.map(exp => (
              <tr key={exp.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="p-3.5 text-xs text-slate-400 whitespace-nowrap">{fmt.date(exp.expense_date)}</td>
                <td className="p-3.5 font-medium text-slate-200">{exp.vendor_name}</td>
                <td className="p-3.5 text-slate-400 text-xs max-w-[160px] truncate">{exp.description ?? '—'}</td>
                <td className="p-3.5"><span className={CAT_COLORS[exp.category] ?? 'badge-gray'}>{formatCategory(exp.category)}</span></td>
                <td className="p-3.5 text-slate-400 text-xs">{exp.vat_rate}%</td>
                <td className="p-3.5 text-right font-mono text-xs text-slate-300">{fmt.currency(Number(exp.amount_excl_vat))}</td>
                <td className="p-3.5 text-right font-mono text-xs text-emerald-400">{fmt.currency(Number(exp.vat_amount))}</td>
                <td className="p-3.5 text-right font-mono text-sm font-semibold text-slate-100">{fmt.currency(Number(exp.amount_incl_vat))}</td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => setDeletingExpense(exp)}
                    className="btn-danger p-1.5 rounded-lg text-red-400"
                    title="Uitgave verwijderen"
                    aria-label={`Uitgave van ${exp.vendor_name} verwijderen`}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expense Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingExpense)}
        title="Uitgave verwijderen"
        description={
          <span>
            Weet u zeker dat u de uitgave van <strong className="text-slate-200">{deletingExpense?.vendor_name}</strong> ter waarde van <strong className="text-slate-200">{fmt.currency(Number(deletingExpense?.amount_incl_vat))}</strong> wilt verwijderen?
          </span>
        }
        confirmLabel="Uitgave wissen"
        cancelLabel="Annuleren"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingExpense) deleteMutation.mutate(deletingExpense.id)
        }}
        onClose={() => setDeletingExpense(null)}
      />
    </div>
  )
}

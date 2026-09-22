import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Edit2, Search, Users, Mail, Phone, MapPin, X, Sparkles, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientsApi, bankApi } from '@/lib/api'
import { Client, BankTransaction } from '@/lib/types'
import { parsePdfInvoice } from '@/lib/pdfInvoiceParser'
import ConfirmDialog from '@/components/ConfirmDialog'
import { TableRowSkeleton, CardSkeleton } from '@/components/TableSkeleton'

const COUNTRIES = [
  { code: 'NL', name: 'Nederland' }, { code: 'BE', name: 'België' },
  { code: 'DE', name: 'Duitsland' }, { code: 'FR', name: 'Frankrijk' },
  { code: 'GB', name: 'Verenigd Koninkrijk' }, { code: 'US', name: 'Verenigde Staten' },
]

export default function Clients() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isParsingPdf, setIsParsingPdf] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list(search || undefined),
  })

  const { data: bankTransactions = [] } = useQuery<BankTransaction[]>({
    queryKey: ['bank-transactions'],
    queryFn: () => bankApi.transactions(),
  })

  const existingNames = new Set(clients.map(c => c.name.toLowerCase().trim()))
  const discoveredCandidates: { name: string; iban?: string }[] = []
  const seenNames = new Set<string>()

  for (const tx of bankTransactions) {
    if (tx.type === 'CREDIT' && tx.counterpart_name) {
      const norm = tx.counterpart_name.trim()
      const low = norm.toLowerCase()
      if (!existingNames.has(low) && !seenNames.has(low)) {
        seenNames.add(low)
        discoveredCandidates.push({
          name: norm,
          iban: tx.counterpart_iban,
        })
      }
    }
  }

  const { register, handleSubmit, reset } = useForm<Partial<Client>>({
    defaultValues: {
      name: '', contact_person: '', email: '', phone: '',
      vat_number: '', kvk_number: '',
      billing_address_street: '', billing_address_city: '', billing_address_postcode: '',
      country_code: 'NL', default_payment_term_days: 14, notes: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Client>) => clientsApi.create(data),
    onSuccess: () => {
      toast.success('Klant aangemaakt')
      qc.invalidateQueries({ queryKey: ['clients'] })
      reset(); setShowForm(false)
    },
    onError: () => toast.error('Opslaan mislukt'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) => clientsApi.update(id, data),
    onSuccess: () => {
      toast.success('Klant bijgewerkt')
      qc.invalidateQueries({ queryKey: ['clients'] })
      setEditing(null)
      setShowForm(false)
    },
    onError: () => toast.error('Opslaan mislukt'),
  })

  const removeMutation = useMutation({
    mutationFn: clientsApi.remove,
    onSuccess: () => {
      toast.success('Klant verwijderd')
      setDeletingClient(null)
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: () => toast.error('Verwijderen mislukt'),
  })

  const onSubmit = (data: Partial<Client>) => {
    if (editing) updateMutation.mutate({ id: editing.id, data })
    else createMutation.mutate(data)
  }

  const openEdit = (client: Client) => {
    setEditing(client)
    reset(client)
    setShowForm(true)
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setIsParsingPdf(true)
    try {
      const parsed = await parsePdfInvoice(f, clients)
      const name = parsed.counterparty || f.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
      setEditing(null)
      reset({
        name,
        contact_person: '',
        email: '',
        phone: '',
        vat_number: '',
        kvk_number: '',
        billing_address_street: '',
        billing_address_city: '',
        billing_address_postcode: '',
        country_code: parsed.iban?.startsWith('BE') ? 'BE' : parsed.iban?.startsWith('DE') ? 'DE' : 'NL',
        default_payment_term_days: 14,
        notes: parsed.iban ? `IBAN: ${parsed.iban}${parsed.reference ? ' | Ref: ' + parsed.reference : ''}` : (parsed.reference || ''),
      })
      setShowForm(true)
      toast.success(`Klantgegevens uitgelezen: ${name}`, { icon: '✨', duration: 4000 })
    } catch (err) {
      console.warn('PDF parsing error:', err)
      toast.error('Kon PDF niet automatisch uitlezen')
    } finally {
      setIsParsingPdf(false)
      if (e.target) e.target.value = ''
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Klanten</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{clients.length} geregistreerde opdrachtgevers</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handlePdfUpload}
          />
          <button
            type="button"
            disabled={isParsingPdf}
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs sm:text-sm py-2 px-3 flex items-center gap-1.5"
            title="Klantgegevens automatisch uitlezen uit factuur of banktransactie PDF"
          >
            <Upload size={14} className="text-brand-400" />
            <span>{isParsingPdf ? 'PDF lezen...' : 'Klant uit PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (showForm) {
                setShowForm(false)
                setEditing(null)
              } else {
                setEditing(null)
                reset({
                  name: '', contact_person: '', email: '', phone: '',
                  vat_number: '', kvk_number: '',
                  billing_address_street: '', billing_address_city: '', billing_address_postcode: '',
                  country_code: 'NL', default_payment_term_days: 14, notes: '',
                })
                setShowForm(true)
              }
            }}
            className="btn-primary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5"
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            <span>{showForm ? 'Sluiten' : 'Klant toevoegen'}</span>
          </button>
        </div>
      </div>

      {/* Discovered from Bank Statement Banner */}
      {discoveredCandidates.length > 0 && (
        <div className="card p-3.5 sm:p-4 bg-gradient-to-r from-brand-950/40 via-slate-900 to-slate-900 border border-brand-500/30 animate-fade-in">
          <div className="flex items-center gap-2 text-brand-400 font-medium text-xs sm:text-sm mb-1.5">
            <Sparkles size={16} />
            <span>Ontdekt uit MT940 bankafschrift ({discoveredCandidates.length})</span>
          </div>
          <p className="text-xs text-slate-400 mb-2.5">
            Onderstaande betalers zijn herkend uit bijschrijvingen in uw banktransacties maar nog niet toegevoegd als klant:
          </p>
          <div className="flex flex-wrap gap-2">
            {discoveredCandidates.map(c => (
              <button
                key={c.name}
                onClick={() => {
                  setEditing(null)
                  reset({
                    name: c.name,
                    contact_person: '',
                    email: '',
                    phone: '',
                    vat_number: '',
                    kvk_number: '',
                    billing_address_street: '',
                    billing_address_city: '',
                    billing_address_postcode: '',
                    country_code: 'NL',
                    default_payment_term_days: 14,
                    notes: c.iban ? `IBAN: ${c.iban}` : '',
                  })
                  setShowForm(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 text-xs text-brand-200 transition-colors"
                title="Klantgegevens automatisch invullen"
              >
                <Plus size={13} className="text-brand-400" />
                <span className="font-semibold">{c.name}</span>
                {c.iban && <span className="font-mono text-[10px] text-brand-400 opacity-80">({c.iban.slice(0, 8)}...)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-8 text-xs sm:text-sm py-2"
          placeholder="Zoek opdrachtgever..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-4 sm:p-5 animate-fade-in border-brand-600/30">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">
            {editing ? `Klant bewerken: ${editing.name}` : 'Nieuwe klant toevoegen'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="label">Bedrijfsnaam *</label>
                <input className="input text-xs sm:text-sm" {...register('name', { required: true })} />
              </div>
              <div>
                <label className="label">Contactpersoon</label>
                <input className="input text-xs sm:text-sm" {...register('contact_person')} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input type="email" className="input text-xs sm:text-sm" {...register('email')} />
              </div>
              <div>
                <label className="label">BTW-nummer</label>
                <input className="input text-xs sm:text-sm font-mono" placeholder="NL...B01" {...register('vat_number')} />
              </div>
              <div>
                <label className="label">KVK-nummer</label>
                <input className="input text-xs sm:text-sm font-mono" {...register('kvk_number')} />
              </div>
              <div>
                <label className="label">Betalingstermijn (dagen)</label>
                <input type="number" className="input text-xs sm:text-sm" {...register('default_payment_term_days', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Straat + huisnummer</label>
                <input className="input text-xs sm:text-sm" {...register('billing_address_street')} />
              </div>
              <div>
                <label className="label">Postcode</label>
                <input className="input text-xs sm:text-sm" {...register('billing_address_postcode')} />
              </div>
              <div>
                <label className="label">Plaats</label>
                <input className="input text-xs sm:text-sm" {...register('billing_address_city')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Land</label>
                <select className="select text-xs sm:text-sm" {...register('country_code')}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notities</label>
                <input className="input text-xs sm:text-sm" placeholder="Bijv. vaste factuurafspraken" {...register('notes')} />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="btn-secondary text-xs sm:text-sm py-2 px-3">
                <span>Annuleren</span>
              </button>
              <button type="submit" className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5">
                <Users size={14} />
                <span>{editing ? 'Bijwerken' : 'Opslaan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <CardSkeleton count={4} />
        ) : clients.length === 0 ? (
          <div className="card text-center py-10 text-xs text-slate-500">Geen klanten gevonden</div>
        ) : (
          clients.map(c => (
            <div key={c.id} className="card p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-slate-100">{c.name}</div>
                  {c.contact_person && (
                    <div className="text-xs text-slate-400 mt-0.5">{c.contact_person}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="badge-gray text-[10px]">{c.country_code}</span>
                  {c.country_code !== 'NL' && c.vat_number && (
                    <span className="badge-yellow text-[10px]">EU B2B</span>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                {c.email && (
                  <div className="flex items-center gap-1.5 text-brand-400">
                    <Mail size={12} />
                    <a href={`mailto:${c.email}`} className="truncate">{c.email}</a>
                  </div>
                )}
                {c.billing_address_city && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin size={12} />
                    <span>{c.billing_address_street ? `${c.billing_address_street}, ` : ''}{c.billing_address_city}</span>
                  </div>
                )}
                {c.vat_number && (
                  <div className="font-mono text-[11px] text-slate-500">
                    BTW: {c.vat_number}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs text-slate-500">
                <span>Termijn: {c.default_payment_term_days} dagen</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Klant bewerken"
                    aria-label={`Klant ${c.name} bewerken`}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeletingClient(c)}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    title="Klant verwijderen"
                    aria-label={`Klant ${c.name} verwijderen`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Clients table (>= md) */}
      <div className="hidden md:block table-wrapper bg-slate-900">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-3.5 font-medium">Naam</th>
              <th className="p-3.5 font-medium">Contactpersoon</th>
              <th className="p-3.5 font-medium">E-mail</th>
              <th className="p-3.5 font-medium">Land</th>
              <th className="p-3.5 font-medium">BTW-nr</th>
              <th className="p-3.5 font-medium">Termijn</th>
              <th className="p-3.5 text-right font-medium">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <TableRowSkeleton cols={7} rows={5} />
            ) : clients.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">Geen klanten gevonden</td></tr>
            ) : clients.map(c => (
              <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="p-3.5">
                  <div className="font-medium text-slate-100">{c.name}</div>
                  {c.billing_address_city && (
                    <div className="text-xs text-slate-500">{c.billing_address_city}</div>
                  )}
                </td>
                <td className="p-3.5 text-slate-400">{c.contact_person ?? '—'}</td>
                <td className="p-3.5">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-brand-400 hover:underline">{c.email}</a>
                  ) : '—'}
                </td>
                <td className="p-3.5">
                  <span className="badge-gray">{c.country_code}</span>
                  {c.country_code !== 'NL' && c.vat_number && (
                    <span className="badge-yellow ml-1 text-[10px]">EU B2B</span>
                  )}
                </td>
                <td className="p-3.5 font-mono text-xs text-slate-400">{c.vat_number ?? '—'}</td>
                <td className="p-3.5 text-slate-400">{c.default_payment_term_days}d</td>
                <td className="p-3.5 text-right">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => openEdit(c)}
                      className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                      title="Klant bewerken"
                      aria-label={`Klant ${c.name} bewerken`}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeletingClient(c)}
                      className="btn-danger p-1.5 rounded-lg text-red-400"
                      title="Klant verwijderen"
                      aria-label={`Klant ${c.name} verwijderen`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Client Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingClient)}
        title="Klant verwijderen"
        description={
          <span>
            Weet u zeker dat u klant <strong className="text-slate-200">{deletingClient?.name}</strong> definitief wilt verwijderen? Eerder aangemaakte facturen blijven behouden.
          </span>
        }
        confirmLabel="Klant wissen"
        cancelLabel="Annuleren"
        variant="danger"
        isLoading={removeMutation.isPending}
        onConfirm={() => {
          if (deletingClient) removeMutation.mutate(deletingClient.id)
        }}
        onClose={() => setDeletingClient(null)}
      />
    </div>
  )
}

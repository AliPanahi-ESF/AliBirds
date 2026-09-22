import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, FileCheck, Eye, Edit3, Trash2,
  Copy, ArrowRight, CheckCircle2, Clock, AlertTriangle,
  Send, ExternalLink, Calendar, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'
import { quotationsApi, settingsApi, clientsApi, fmt } from '@/lib/api'
import { Quotation, QuotationStatus, BusinessSettings, Client } from '@/lib/types'
import QuotationPrintModal from '@/components/QuotationPrintModal'
import SignatureCanvasModal from '@/components/SignatureCanvasModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { clsx } from 'clsx'

const STATUS_MAP: Record<QuotationStatus, { label: string; cls: string; icon: any }> = {
  DRAFT:     { label: 'Concept',     cls: 'badge-gray',   icon: Clock },
  SENT:      { label: 'Verzonden',   cls: 'badge-blue',   icon: Send },
  ACCEPTED:  { label: 'Geaccepteerd',cls: 'badge-green',  icon: CheckCircle2 },
  REJECTED:  { label: 'Geweigerd',   cls: 'badge-red',    icon: AlertTriangle },
  CONVERTED: { label: 'Gefactureerd',cls: 'badge-purple', icon: FileCheck },
}

export default function Quotations() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [printQuotation, setPrintQuotation] = useState<Quotation | null>(null)
  const [signQuotation, setSignQuotation] = useState<Quotation | null>(null)
  const [deletingQuotation, setDeletingQuotation] = useState<Quotation | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const { data: settings } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ['quotations', filter],
    queryFn: () => quotationsApi.list(filter ? { status: filter } : {}),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotationsApi.delete(id),
    onSuccess: () => {
      toast.success('Offerte verwijderd')
      setDeletingQuotation(null)
      qc.invalidateQueries({ queryKey: ['quotations'] })
    },
    onError: () => toast.error('Verwijderen mislukt'),
  })

  // Convert to Invoice mutation
  const convertMutation = useMutation({
    mutationFn: (id: string) => quotationsApi.convertToInvoice(id),
    onSuccess: (res) => {
      toast.success(`Offerte succesvol omgezet naar factuur ${res.invoice_number}!`)
      qc.invalidateQueries({ queryKey: ['quotations'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setConvertingId(null)
      // Navigate to the newly created invoice editor
      nav(`/invoices/${res.invoice_id}/edit`)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Omzetten naar factuur mislukt')
      setConvertingId(null)
    },
  })

  // Save Signature
  const handleSaveSignature = async (sigDataUrl: string, signerName: string) => {
    if (!signQuotation) return
    try {
      await quotationsApi.signPublicly(signQuotation.id, sigDataUrl, signerName)
      toast.success('Offerte digitaal ondertekend!')
      qc.invalidateQueries({ queryKey: ['quotations'] })
      setSignQuotation(null)
    } catch (err: any) {
      toast.error(err.message || 'Ondertekenen mislukt')
    }
  }

  // Copy public review link
  const copyPublicLink = (id: string) => {
    const url = `${window.location.origin}/quote/review/${id}`
    navigator.clipboard.writeText(url)
    toast.success('Publieke ondertekenlink gekopieerd naar klembord!')
  }

  // Filtered quotations
  const filtered = quotations.filter((q) => {
    const matchSearch =
      !search ||
      q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
      q.client?.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = !filter || q.status === filter
    return matchSearch && matchFilter
  })

  // KPI Calculations
  const totalVolume = quotations.reduce((s, q) => s + (Number(q.total_amount) || 0), 0)
  const draftsCount = quotations.filter((q) => q.status === 'DRAFT').length
  const sentCount = quotations.filter((q) => q.status === 'SENT').length
  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED' || q.status === 'CONVERTED').length
  const convertedCount = quotations.filter((q) => q.status === 'CONVERTED').length
  const winRate = quotations.length > 0 ? Math.round((acceptedCount / quotations.length) * 100) : 0

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2.5">
            <span>Offertes</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-medium">
              Offertebeheer
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Beheer voorstellen, digitale handtekeningen en 1-klik facturatie
          </p>
        </div>
        <button
          onClick={() => nav('/quotations/new')}
          className="btn-primary py-2.5 px-4 text-sm flex items-center gap-2 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40"
        >
          <Plus size={18} />
          <span>Nieuwe Offerte</span>
        </button>
      </div>

      {/* KPI Pipeline Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="card p-4 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Totaal Waarde</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 font-mono mt-1.5">
            {fmt.currency(totalVolume)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{quotations.length} offertes totaal</div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Concepten</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-300 font-mono mt-1.5">
            {draftsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">In voorbereiding</div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Verzonden</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-400 font-mono mt-1.5">
            {sentCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Wachten op akkoord</div>
        </div>

        <div className="card p-4 flex flex-col justify-between border-emerald-500/20 bg-emerald-950/10">
          <div className="text-xs text-emerald-400 font-medium flex items-center justify-between">
            <span>Geaccepteerd</span>
            <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded font-mono">{winRate}% win</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono mt-1.5">
            {acceptedCount}
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Digitaal ondertekend</div>
        </div>

        <div className="card p-4 flex flex-col justify-between border-purple-500/20 bg-purple-950/10">
          <div className="text-xs text-purple-400 font-medium">Gefactureerd</div>
          <div className="text-xl sm:text-2xl font-bold text-purple-300 font-mono mt-1.5">
            {convertedCount}
          </div>
          <div className="text-[11px] text-purple-400/80 mt-1">1-Klik omgezet</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek offerte of klant..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: '', label: 'Alle' },
            { id: 'DRAFT', label: 'Concept' },
            { id: 'SENT', label: 'Verzonden' },
            { id: 'ACCEPTED', label: 'Geaccepteerd' },
            { id: 'CONVERTED', label: 'Gefactureerd' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                filter === tab.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations List Table */}
      {isLoading ? (
        <div className="card p-8 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Offertes laden...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-4">
            <FileCheck size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-200">Geen offertes gevonden</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {search || filter
              ? 'Geen offertes die voldoen aan de zoekcriteria.'
              : 'Maak uw eerste offerte aan en laat klanten eenvoudig online ondertekenen.'}
          </p>
          <button
            onClick={() => nav('/quotations/new')}
            className="btn-primary mt-5 py-2 px-4 text-xs flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Offerte Aanmaken</span>
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Offertenummer</th>
                <th>Klant</th>
                <th>Offertedatum</th>
                <th>Geldig tot</th>
                <th className="text-right">Totaal (incl)</th>
                <th>Status</th>
                <th className="text-right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quote) => {
                const statusMeta = STATUS_MAP[quote.status] || STATUS_MAP.DRAFT
                const StatusIcon = statusMeta.icon
                const isAccepted = quote.status === 'ACCEPTED'
                const isConverted = quote.status === 'CONVERTED'
                const isExpired = new Date(quote.valid_until_date).getTime() < Date.now() && quote.status === 'SENT'

                return (
                  <tr key={quote.id} className="group">
                    {/* Number */}
                    <td>
                      <button
                        onClick={() => setPrintQuotation(quote)}
                        className="font-mono font-bold text-brand-400 hover:underline flex items-center gap-1.5"
                      >
                        <FileCheck size={14} className="shrink-0" />
                        <span>{quote.quotation_number}</span>
                      </button>
                    </td>

                    {/* Client */}
                    <td>
                      <div className="font-medium text-slate-200">
                        {quote.client?.name || 'Onbekende klant'}
                      </div>
                      {quote.client?.contact_person && (
                        <div className="text-[11px] text-slate-500">
                          {quote.client.contact_person}
                        </div>
                      )}
                    </td>

                    {/* Issue date */}
                    <td className="text-slate-400 text-xs">
                      {fmt.date(quote.issue_date)}
                    </td>

                    {/* Validity */}
                    <td>
                      <div className={clsx('text-xs flex items-center gap-1', isExpired ? 'text-red-400 font-medium' : 'text-slate-400')}>
                        <Calendar size={13} className="shrink-0" />
                        <span>{fmt.date(quote.valid_until_date)}</span>
                        {isExpired && <span className="text-[10px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded">Verlopen</span>}
                      </div>
                    </td>

                    {/* Total amount */}
                    <td className="text-right font-mono font-bold text-slate-100">
                      {fmt.currency(quote.total_amount)}
                    </td>

                    {/* Status */}
                    <td>
                      <span className={clsx(statusMeta.cls, 'inline-flex items-center gap-1 text-[11px]')}>
                        <StatusIcon size={12} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                        {/* 1-Click Convert to Invoice Button */}
                        {isAccepted && (
                          <button
                            onClick={() => convertMutation.mutate(quote.id)}
                            disabled={convertMutation.isPending && convertingId === quote.id}
                            className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 shadow-sm"
                            title="Zet om naar officiële factuur"
                          >
                            <ArrowRight size={13} />
                            <span>Factureren</span>
                          </button>
                        )}

                        {/* Sign Button (if sent and pending signature) */}
                        {quote.status === 'SENT' && (
                          <button
                            onClick={() => setSignQuotation(quote)}
                            className="btn-ghost py-1 px-2 text-xs text-brand-400 hover:bg-brand-500/10 border border-brand-500/20"
                            title="Digitaal ondertekenen"
                          >
                            <span>Ondertekenen</span>
                          </button>
                        )}

                        {/* Copy Public Link */}
                        <button
                          onClick={() => copyPublicLink(quote.id)}
                          className="btn-ghost p-1.5 text-slate-400 hover:text-white"
                          title="Kopieer publieke ondertekenlink"
                        >
                          <Copy size={14} />
                        </button>

                        {/* Preview / Print */}
                        <button
                          onClick={() => setPrintQuotation(quote)}
                          className="btn-ghost p-1.5 text-slate-400 hover:text-white"
                          title="Offerte bekijken & printen"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Edit */}
                        {!isConverted && (
                          <button
                            onClick={() => nav(`/quotations/${quote.id}/edit`)}
                            className="btn-ghost p-1.5 text-slate-400 hover:text-white"
                            title="Bewerken"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => setDeletingQuotation(quote)}
                          className="btn-ghost p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                          title="Verwijderen"
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
      )}

      {/* Print / Preview Modal */}
      {printQuotation && (
        <QuotationPrintModal
          quotation={printQuotation}
          settings={settings}
          onClose={() => setPrintQuotation(null)}
        />
      )}

      {/* Signature Canvas Modal */}
      {signQuotation && (
        <SignatureCanvasModal
          isOpen={!!signQuotation}
          onClose={() => setSignQuotation(null)}
          onSave={handleSaveSignature}
          quotationNumber={signQuotation.quotation_number}
          clientName={signQuotation.client?.contact_person || signQuotation.client?.name}
          totalAmount={fmt.currency(signQuotation.total_amount)}
        />
      )}

      {/* Confirm Delete Dialog */}
      {deletingQuotation && (
        <ConfirmDialog
          isOpen={!!deletingQuotation}
          title="Offerte Verwijderen"
          message={`Weet u zeker dat u offerte "${deletingQuotation.quotation_number}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
          confirmLabel="Verwijderen"
          danger
          onConfirm={() => deleteMutation.mutate(deletingQuotation.id)}
          onClose={() => setDeletingQuotation(null)}
        />
      )}
    </div>
  )
}

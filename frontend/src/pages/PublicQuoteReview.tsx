import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileCheck, CheckCircle2, Calendar, Printer,
  PenTool, ShieldCheck, Clock, Building2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { quotationsApi, settingsApi, fmt } from '@/lib/api'
import { Quotation, BusinessSettings } from '@/lib/types'
import SignatureCanvasModal from '@/components/SignatureCanvasModal'

export default function PublicQuoteReview() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [showSignModal, setShowSignModal] = useState(false)

  const { data: quote, isLoading, error } = useQuery<Quotation>({
    queryKey: ['public-quotation', id],
    queryFn: () => quotationsApi.get(id!),
    enabled: !!id,
    retry: 1,
  })

  const { data: settings } = useQuery<BusinessSettings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  const signMutation = useMutation({
    mutationFn: ({ signature, name }: { signature: string; name: string }) =>
      quotationsApi.signPublicly(id!, signature, name),
    onSuccess: () => {
      toast.success('Offerte succesvol digitaal ondertekend!')
      qc.invalidateQueries({ queryKey: ['public-quotation', id] })
      qc.invalidateQueries({ queryKey: ['quotations'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Ondertekenen mislukt')
    },
  })

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Offerte laden...</span>
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="card max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto">
            <FileCheck size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Offerte Niet Gevonden</h2>
          <p className="text-xs text-slate-400">
            De opgevraagde offerte bestaat niet meer of de koppeling is verlopen. Neem contact op met de afzender.
          </p>
        </div>
      </div>
    )
  }

  const isSigned = quote.status === 'ACCEPTED' || quote.status === 'CONVERTED' || Boolean(quote.signature_data_url)
  const isExpired = new Date(quote.valid_until_date).getTime() < Date.now() && !isSigned
  const accentColor = settings?.accent_color || '#4f46e5'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-3 sm:px-6 lg:px-8 print:p-0 print:bg-white animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Floating Status / Action Bar */}
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-brand-500/30 bg-slate-900/90 backdrop-blur-md shadow-2xl print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <FileCheck size={22} />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Offerte Ter Beoordeling</div>
              <div className="text-base sm:text-lg font-bold text-slate-100">
                {quote.quotation_number}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
            >
              <Printer size={15} />
              <span>Afdrukken / PDF</span>
            </button>

            {!isSigned && !isExpired && (
              <button
                onClick={() => setShowSignModal(true)}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-2 shadow-lg shadow-brand-600/30 flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-500"
              >
                <PenTool size={15} />
                <span>Akkoord & Ondertekenen</span>
              </button>
            )}

            {isSigned && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 size={15} />
                <span>Geaccepteerd</span>
              </div>
            )}
          </div>
        </div>

        {/* Signed Success Alert Banner */}
        {isSigned && (
          <div className="card p-5 border-emerald-500/30 bg-emerald-950/20 text-emerald-300 flex items-center gap-3.5 print:hidden">
            <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Hartelijk dank voor uw akkoord!</span> Deze offerte is rechtsgeldig
              digitaal ondertekend door <span className="font-semibold text-emerald-200">{quote.signed_by_name}</span> op{' '}
              <span className="font-semibold text-emerald-200">
                {quote.signed_at ? new Date(quote.signed_at).toLocaleString('nl-NL') : ''}
              </span>.
            </div>
          </div>
        )}

        {/* Expired Alert Banner */}
        {isExpired && (
          <div className="card p-5 border-amber-500/30 bg-amber-950/20 text-amber-300 flex items-center gap-3.5 print:hidden">
            <Clock size={24} className="text-amber-400 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Let op:</span> De geldigheidstermijn van deze offerte is verstreken op{' '}
              {fmt.date(quote.valid_until_date)}. Neem contact op met de verzender voor een verlengd voorstel.
            </div>
          </div>
        )}

        {/* Document Sheet */}
        <div className="card p-6 sm:p-12 bg-slate-900 border-slate-800 shadow-2xl space-y-8 print:p-0 print:border-0 print:shadow-none print:bg-white print:text-black">
          {/* Company & Quote Details Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-slate-800 print:border-slate-300">
            <div>
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Bedrijfslogo" className="h-12 w-auto object-contain mb-3" />
              ) : (
                <div
                  className="font-black text-2xl tracking-tight mb-1 text-brand-400"
                  style={{ color: accentColor }}
                >
                  {settings?.company_name || 'Mijn ZZP Studio'}
                </div>
              )}
              <div className="text-xs text-slate-400 space-y-0.5 print:text-slate-600">
                <p>{settings?.address_street}</p>
                <p>{settings?.address_postcode} {settings?.address_city}</p>
                {settings?.kvk_number && <p><span className="font-semibold text-slate-300">KVK:</span> {settings.kvk_number}</p>}
                {settings?.btw_id && <p><span className="font-semibold text-slate-300">Btw-id:</span> {settings.btw_id}</p>}
                {settings?.email && <p><span className="font-semibold text-slate-300">E-mail:</span> {settings.email}</p>}
              </div>
            </div>

            <div className="sm:text-right">
              <span
                className="inline-block uppercase tracking-widest text-xs font-black px-3 py-1 rounded-full text-white mb-2"
                style={{ backgroundColor: accentColor }}
              >
                OFFERTE
              </span>
              <h1 className="text-2xl font-black text-slate-100 print:text-slate-950 font-mono">
                {quote.quotation_number}
              </h1>
              <div className="text-xs text-slate-400 mt-2 space-y-1 print:text-slate-600">
                <p><span className="font-semibold text-slate-300">Offertedatum:</span> {fmt.date(quote.issue_date)}</p>
                <p><span className="font-semibold text-slate-300">Geldig tot:</span> {fmt.date(quote.valid_until_date)}</p>
              </div>
            </div>
          </div>

          {/* Client Recipient */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 print:bg-slate-50 print:border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Geoffreerd Aan:
            </div>
            {quote.client ? (
              <div className="text-xs text-slate-200 space-y-0.5 print:text-slate-800">
                <p className="font-bold text-sm text-slate-100 print:text-slate-950">{quote.client.name}</p>
                {quote.client.contact_person && <p>T.a.v. {quote.client.contact_person}</p>}
                {quote.client.billing_address_street && <p>{quote.client.billing_address_street}</p>}
                {(quote.client.billing_address_postcode || quote.client.billing_address_city) && (
                  <p>{quote.client.billing_address_postcode} {quote.client.billing_address_city}</p>
                )}
                {quote.client.vat_number && <p className="text-slate-400 font-mono mt-0.5">Btw: {quote.client.vat_number}</p>}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Klantgegevens niet gespecificeerd</p>
            )}
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 print:border-slate-300 text-slate-400 print:text-slate-600 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-2 font-bold">Omschrijving</th>
                  <th className="py-3 px-2 text-right font-bold w-20">Aantal</th>
                  <th className="py-3 px-2 text-right font-bold w-28">Prijs</th>
                  <th className="py-3 px-2 text-right font-bold w-20">Btw</th>
                  <th className="py-3 px-2 text-right font-bold w-28">Totaal (excl)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 print:divide-slate-200 text-slate-200 print:text-slate-800">
                {quote.line_items?.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-3.5 px-2 font-medium">{it.description}</td>
                    <td className="py-3.5 px-2 text-right font-mono">{it.quantity}</td>
                    <td className="py-3.5 px-2 text-right font-mono">{fmt.currency(it.unit_price)}</td>
                    <td className="py-3.5 px-2 text-right">
                      {it.vat_rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${it.vat_rate}%`}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono font-semibold">
                      {fmt.currency(it.line_total_excl ?? it.quantity * it.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-800 print:border-slate-300">
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1 text-slate-300 font-semibold mb-1">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Offertegarantie & Veiligheid</span>
              </div>
              <p>Alle tarieven en calculaties conform Nederlandse fiscale regelgeving.</p>
            </div>

            <div className="text-xs space-y-1.5 sm:w-80">
              <div className="flex justify-between text-slate-400">
                <span>Subtotaal (excl. btw):</span>
                <span className="font-mono font-semibold text-slate-200">{fmt.currency(quote.subtotal_excl)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Btw-bedrag:</span>
                <span className="font-mono font-semibold text-slate-200">{fmt.currency(quote.total_vat)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-100 print:text-slate-950 pt-2 border-t border-slate-800 print:border-slate-300">
                <span>Totaalbedrag (incl. btw):</span>
                <span className="font-mono text-brand-400 print:text-slate-950">{fmt.currency(quote.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(quote.notes || quote.disclaimer) && (
            <div className="pt-4 border-t border-slate-800 print:border-slate-300 text-xs text-slate-400 print:text-slate-600 space-y-3">
              {quote.notes && (
                <div>
                  <span className="font-bold text-slate-200 print:text-slate-800">Toelichting:</span>
                  <p className="whitespace-pre-line mt-0.5">{quote.notes}</p>
                </div>
              )}
              {quote.disclaimer && (
                <div>
                  <span className="font-bold text-slate-200 print:text-slate-800">Voorwaarden:</span>
                  <p className="whitespace-pre-line mt-0.5 text-slate-500">{quote.disclaimer}</p>
                </div>
              )}
            </div>
          )}

          {/* Digital Signature Verification Area */}
          {quote.signature_data_url ? (
            <div className="mt-6 p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 print:bg-emerald-50 print:border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 print:text-emerald-800">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>Geaccepteerd & Digitaal Ondertekend</span>
                </div>
                <p className="text-xs text-slate-200 print:text-slate-800">
                  Ondertekend door: <span className="font-bold">{quote.signed_by_name}</span>
                </p>
                <p className="text-[11px] text-slate-400 print:text-slate-500">
                  Tijdstempel: {quote.signed_at ? new Date(quote.signed_at).toLocaleString('nl-NL') : ''}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-md">
                <img
                  src={quote.signature_data_url}
                  alt="Digitale Handtekening"
                  className="h-16 w-auto object-contain max-w-[220px]"
                />
              </div>
            </div>
          ) : (
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <div className="text-xs text-slate-400">
                Klaar om dit voorstel goed te keuren? Plaats direct uw handtekening via uw smartphone of desktop.
              </div>
              <button
                onClick={() => setShowSignModal(true)}
                disabled={isExpired}
                className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40"
              >
                <PenTool size={16} />
                <span>Akkoord & Digitaal Ondertekenen</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <SignatureCanvasModal
          isOpen={showSignModal}
          onClose={() => setShowSignModal(false)}
          onSave={async (signatureDataUrl, signerName) => {
            await signMutation.mutateAsync({ signature: signatureDataUrl, name: signerName })
          }}
          quotationNumber={quote.quotation_number}
          clientName={quote.client?.contact_person || quote.client?.name}
          totalAmount={fmt.currency(quote.total_amount)}
        />
      )}
    </div>
  )
}

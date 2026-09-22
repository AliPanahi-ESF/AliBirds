import React from 'react'
import { Printer, X, CheckCircle2, Calendar, FileCheck, ShieldCheck } from 'lucide-react'
import { Quotation, BusinessSettings, Client } from '@/lib/types'
import { fmt, clientsApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

interface QuotationPrintModalProps {
  quotation: Quotation
  client?: Client
  settings?: BusinessSettings
  onClose: () => void
}

export default function QuotationPrintModal({
  quotation,
  client: propClient,
  settings,
  onClose,
}: QuotationPrintModalProps) {
  const handlePrint = () => {
    window.print()
  }

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  const embeddedClient = Array.isArray(quotation.client) ? quotation.client[0] : quotation.client
  const client: Client | undefined =
    propClient ||
    (embeddedClient && embeddedClient.name ? embeddedClient : undefined) ||
    allClients.find((c) => c.id === quotation.client_id) ||
    embeddedClient

  const accentColor = settings?.accent_color || '#4f46e5'

  const subtotalExcl = Number(
    quotation.subtotal_excl ??
    quotation.line_items?.reduce((s, it) => s + (Number(it.line_total_excl) || 0), 0) ??
    0
  )
  const totalVat = Number(
    quotation.total_vat ??
    quotation.line_items?.reduce((s, it) => s + (Number(it.vat_amount) || 0), 0) ??
    0
  )
  const totalAmount = Number(quotation.total_amount ?? subtotalExcl + totalVat)

  // VAT breakdown per tariff
  const vatBreakdown: Record<string, { base: number; vat: number }> = {}
  quotation.line_items?.forEach((it) => {
    const rate = String(it.vat_rate)
    if (!vatBreakdown[rate]) {
      vatBreakdown[rate] = { base: 0, vat: 0 }
    }
    vatBreakdown[rate].base += Number(it.line_total_excl) || 0
    vatBreakdown[rate].vat += Number(it.vat_amount) || 0
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-0 print:shadow-none print:bg-white print:text-black">
        {/* Modal Action Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 print:hidden">
          <div className="flex items-center gap-2 text-slate-300">
            <FileCheck size={18} className="text-brand-400" />
            <span className="text-sm font-semibold">Offerte Voorbeeld: {quotation.quotation_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5"
            >
              <Printer size={14} />
              <span>Afdrukken / Opslaan als PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Sluit"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 print:overflow-visible print:p-8 font-sans">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-slate-200">
            <div>
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-12 w-auto object-contain mb-3" />
              ) : (
                <div
                  className="font-black text-2xl tracking-tight mb-1"
                  style={{ color: accentColor }}
                >
                  {settings?.company_name || 'Mijn ZZP Studio'}
                </div>
              )}
              <div className="text-xs text-slate-600 space-y-0.5">
                <p>{settings?.address_street}</p>
                <p>{settings?.address_postcode} {settings?.address_city}</p>
                {settings?.kvk_number && <p><span className="font-semibold">KVK:</span> {settings.kvk_number}</p>}
                {settings?.btw_id && <p><span className="font-semibold">Btw-id:</span> {settings.btw_id}</p>}
                {settings?.iban && <p><span className="font-semibold">IBAN:</span> {settings.iban}</p>}
              </div>
            </div>

            <div className="sm:text-right">
              <span
                className="inline-block uppercase tracking-widest text-xs font-black px-3 py-1 rounded-full text-white mb-2"
                style={{ backgroundColor: accentColor }}
              >
                OFFERTE
              </span>
              <h1 className="text-2xl font-black text-slate-900">{quotation.quotation_number}</h1>
              <div className="text-xs text-slate-600 mt-2 space-y-1">
                <p><span className="font-semibold text-slate-700">Offertedatum:</span> {fmt.date(quotation.issue_date)}</p>
                <p><span className="font-semibold text-slate-700">Geldig tot:</span> {fmt.date(quotation.valid_until_date)}</p>
                <p>
                  <span className="font-semibold text-slate-700">Status:</span>{' '}
                  <span className="font-medium text-brand-600">
                    {quotation.status === 'ACCEPTED' ? 'Geaccepteerd & Ondertekend' :
                     quotation.status === 'SENT' ? 'Verzonden (Wacht op akkoord)' :
                     quotation.status === 'CONVERTED' ? 'Omgezet naar factuur' : 'Concept'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Client Block */}
          <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Offerte Bestemd Voor:
            </div>
            {client ? (
              <div className="text-xs text-slate-800 space-y-0.5">
                <p className="font-bold text-sm text-slate-900">{client.name}</p>
                {client.contact_person && <p>T.a.v. {client.contact_person}</p>}
                {client.billing_address_street && <p>{client.billing_address_street}</p>}
                {(client.billing_address_postcode || client.billing_address_city) && (
                  <p>{client.billing_address_postcode} {client.billing_address_city}</p>
                )}
                {client.vat_number && <p className="text-slate-500 font-mono mt-1">Btw: {client.vat_number}</p>}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Geen klantgegevens geselecteerd</p>
            )}
          </div>

          {/* Line Items Table */}
          <table className="w-full text-left my-6 border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-600 text-xs uppercase tracking-wider">
                <th className="py-2.5 px-2 font-bold">Omschrijving</th>
                <th className="py-2.5 px-2 text-right font-bold w-20">Aantal</th>
                <th className="py-2.5 px-2 text-right font-bold w-28">Prijs (excl)</th>
                <th className="py-2.5 px-2 text-right font-bold w-20">Btw</th>
                <th className="py-2.5 px-2 text-right font-bold w-28">Totaal (excl)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
              {quotation.line_items?.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td className="py-3 px-2 font-medium">{item.description}</td>
                  <td className="py-3 px-2 text-right">{item.quantity}</td>
                  <td className="py-3 px-2 text-right">{fmt.currency(item.unit_price)}</td>
                  <td className="py-3 px-2 text-right">
                    {item.vat_rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${item.vat_rate}%`}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold">
                    {fmt.currency(item.line_total_excl ?? item.quantity * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & VAT Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-200">
            {/* VAT Summary */}
            <div className="text-xs space-y-1 sm:w-1/2">
              <div className="font-bold text-slate-700 mb-1">Btw-specificatie:</div>
              {Object.entries(vatBreakdown).map(([rate, vals]) => (
                <div key={rate} className="flex justify-between text-slate-600 py-0.5 max-w-xs">
                  <span>{rate === 'REVERSE_CHARGE' ? 'Btw verlegd' : `Btw ${rate}% over ${fmt.currency(vals.base)}:`}</span>
                  <span className="font-semibold">{fmt.currency(vals.vat)}</span>
                </div>
              ))}
            </div>

            {/* Final Totals */}
            <div className="text-xs space-y-1.5 sm:w-80">
              <div className="flex justify-between text-slate-600">
                <span>Subtotaal (excl. btw):</span>
                <span className="font-semibold">{fmt.currency(subtotalExcl)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Totaal btw:</span>
                <span className="font-semibold">{fmt.currency(totalVat)}</span>
              </div>
              <div
                className="flex justify-between text-base font-black text-slate-950 pt-2 border-t-2 border-slate-900"
                style={{ color: accentColor }}
              >
                <span>Totaalbedrag (incl. btw):</span>
                <span>{fmt.currency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Disclaimer */}
          {(quotation.notes || quotation.disclaimer) && (
            <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-2">
              {quotation.notes && (
                <div>
                  <span className="font-bold text-slate-800">Toelichting:</span>
                  <p className="whitespace-pre-line mt-0.5">{quotation.notes}</p>
                </div>
              )}
              {quotation.disclaimer && (
                <div>
                  <span className="font-bold text-slate-800">Voorwaarden:</span>
                  <p className="whitespace-pre-line mt-0.5 text-slate-500">{quotation.disclaimer}</p>
                </div>
              )}
            </div>
          )}

          {/* Digital Signature Confirmation Stamp */}
          {quotation.signature_data_url && (
            <div className="mt-8 p-4 rounded-xl border border-emerald-300 bg-emerald-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Digitaal Ondertekend & Geaccepteerd</span>
                </div>
                <p className="text-xs text-slate-700">
                  Ondertekend door: <span className="font-bold">{quotation.signed_by_name}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Datum & Tijdstempel: {quotation.signed_at ? new Date(quotation.signed_at).toLocaleString('nl-NL') : ''}
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <img
                  src={quotation.signature_data_url}
                  alt="Digitale Handtekening"
                  className="h-14 w-auto object-contain max-w-[200px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { Printer, Download, X, Building2, CheckCircle2, Calendar, CreditCard } from 'lucide-react'
import { Invoice, BusinessSettings, Client } from '@/lib/types'
import { fmt, clientsApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

interface InvoicePrintModalProps {
  invoice: Invoice
  client?: Client
  settings?: BusinessSettings
  onClose: () => void
}

export default function InvoicePrintModal({ invoice, client: propClient, settings, onClose }: InvoicePrintModalProps) {
  const handlePrint = () => {
    window.print()
  }

  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  })

  // 1. Resolve client with maximum fallback coverage:
  // - Explicitly provided propClient (e.g. live editor selection)
  // - Embedded invoice.client (unwrapping array if returned as [client])
  // - Lookup by invoice.client_id in loaded clients
  const embeddedClient = Array.isArray(invoice.client) ? invoice.client[0] : invoice.client
  const client: Client | undefined =
    propClient ||
    (embeddedClient && embeddedClient.name ? embeddedClient : undefined) ||
    allClients.find(c => c.id === invoice.client_id) ||
    embeddedClient

  const accentColor = settings?.accent_color || '#4f46e5'

  // Pricing display mode (excluding or including VAT)
  const [priceMode, setPriceMode] = React.useState<'EXCLUSIVE' | 'INCLUSIVE'>(
    invoice.calculation_mode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE'
  )

  // Safe totals calculation with multiple fallbacks
  const subtotalExcl = Number(
    invoice.subtotal_excl ??
    invoice.subtotal_excl_vat ??
    invoice.line_items?.reduce((s, it) => s + (Number(it.line_total_excl) || 0), 0) ??
    0
  )
  const totalVat = Number(
    invoice.total_vat ??
    invoice.total_vat_amount ??
    invoice.line_items?.reduce((s, it) => s + (Number(it.vat_amount) || 0), 0) ??
    0
  )
  const totalIncl = Number(
    invoice.total_incl ??
    invoice.total_incl_vat ??
    (subtotalExcl + totalVat)
  )

  // Calculate VAT breakdown per tariff
  const vatBreakdown: Record<string, { base: number; vat: number }> = {}
  invoice.line_items?.forEach(it => {
    const rate = String(it.vat_rate)
    if (!vatBreakdown[rate]) {
      vatBreakdown[rate] = { base: 0, vat: 0 }
    }
    vatBreakdown[rate].base += (Number(it.line_total_excl) || 0)
    vatBreakdown[rate].vat += (Number(it.vat_amount) || 0)
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:w-full print:max-w-none">
        
        {/* Top Action Bar (Hidden when printing) */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 text-white border-b border-slate-800 print:hidden gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Factuur Preview & PDF Export</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {invoice.invoice_number}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Price display mode toggle */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400 pl-1 font-medium">Prijzen:</span>
              <button
                type="button"
                onClick={() => setPriceMode('EXCLUSIVE')}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                  priceMode === 'EXCLUSIVE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Excl. btw
              </button>
              <button
                type="button"
                onClick={() => setPriceMode('INCLUSIVE')}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                  priceMode === 'INCLUSIVE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Incl. btw
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
            >
              <Printer size={15} />
              <span>Afdrukken / Opslaan als PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Sluiten"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <div id="invoice-printable-sheet" className="p-6 sm:p-10 md:p-14 print:p-8 text-slate-800 text-xs sm:text-sm font-sans bg-white min-h-[900px]">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-8 gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {settings?.company_name ? settings.company_name[0].toUpperCase() : 'A'}
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  {settings?.company_name || 'Studio AliBirds'}
                </h1>
              </div>
              <div className="text-slate-500 space-y-0.5 text-xs">
                <div>{settings?.address_street || 'Keizersgracht 100'}</div>
                <div>{settings?.address_postcode} {settings?.address_city}, {settings?.address_country || 'NL'}</div>
                {settings?.email && <div>E-mail: {settings.email}</div>}
              </div>
            </div>

            <div className="text-right">
              <div
                className="text-2xl sm:text-3xl font-black tracking-tight uppercase"
                style={{ color: accentColor }}
              >
                FACTUUR
              </div>
              <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                <div><span className="font-semibold text-slate-800">Factuurnummer:</span> {invoice.invoice_number}</div>
                <div><span className="font-semibold text-slate-800">Factuurdatum:</span> {fmt.date(invoice.issue_date)}</div>
                <div><span className="font-semibold text-slate-800">Vervaldatum:</span> {fmt.date(invoice.due_date)}</div>
                {invoice.delivery_date && (
                  <div><span className="font-semibold text-slate-800">Leverdatum:</span> {fmt.date(invoice.delivery_date)}</div>
                )}
              </div>
            </div>
          </div>

          {/* Legal Identifiers & Client Billing Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200">
            {/* Client address */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Factuur voor:</div>
              <div className="font-bold text-slate-900 text-sm sm:text-base">
                {client?.name || 'Geen klant geselecteerd'}
              </div>
              {client?.contact_person && (
                <div className="text-xs text-slate-600 font-medium">t.a.v. {client.contact_person}</div>
              )}
              <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                {client?.billing_address_street && <div>{client.billing_address_street}</div>}
                {(client?.billing_address_postcode || client?.billing_address_city) && (
                  <div>{client.billing_address_postcode} {client.billing_address_city}</div>
                )}
                {client?.country_code && <div>{client.country_code}</div>}
                {client?.vat_number && (
                  <div className="pt-0.5 text-slate-700">
                    Btw-id: <span className="font-mono font-medium">{client.vat_number}</span>
                  </div>
                )}
                {client?.kvk_number && (
                  <div className="text-slate-700">
                    KvK: <span className="font-mono font-medium">{client.kvk_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Issuer legal details */}
            <div className="sm:text-right text-xs text-slate-600 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bedrijfsgegevens:</div>
              <div>KvK-nummer: <span className="font-mono font-medium text-slate-800">{settings?.kvk_number || '12345678'}</span></div>
              <div>Btw-identificatienummer: <span className="font-mono font-medium text-slate-800">{settings?.btw_id || 'NL123456789B01'}</span></div>
              <div>IBAN: <span className="font-mono font-medium text-slate-800">{settings?.iban || 'NL00BANK0123456789'}</span></div>
              {settings?.bic && <div>BIC: <span className="font-mono font-medium text-slate-800">{settings.bic}</span></div>}
            </div>
          </div>

          {/* Line items table */}
          <div className="py-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5">Omschrijving</th>
                  <th className="py-2.5 text-center">Aantal</th>
                  <th className="py-2.5 text-right">
                    Prijs p/st {priceMode === 'INCLUSIVE' ? '(incl. btw)' : '(excl. btw)'}
                  </th>
                  <th className="py-2.5 text-center">Btw</th>
                  <th className="py-2.5 text-right">
                    Totaal {priceMode === 'INCLUSIVE' ? '(incl. btw)' : '(excl. btw)'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {invoice.line_items?.map((item, idx) => {
                  const qty = Number(item.quantity) || 1
                  const excl = Number(item.line_total_excl) || 0
                  const vat = Number(item.vat_amount) || 0
                  const incl = Number(item.line_total_incl || (excl + vat)) || excl
                  const unitPrice = Number(item.unit_price) || 0
                  const unitPriceIncl = qty > 0 ? (incl / qty) : unitPrice
                  const unitPriceExcl = qty > 0 ? (excl / qty) : unitPrice

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 font-medium text-slate-800">{item.description}</td>
                      <td className="py-3 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-3 text-right font-mono text-slate-600">
                        {fmt.currency(priceMode === 'INCLUSIVE' ? unitPriceIncl : unitPriceExcl)}
                      </td>
                      <td className="py-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                          {item.vat_rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${item.vat_rate}%`}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-slate-900">
                        {fmt.currency(priceMode === 'INCLUSIVE' ? incl : excl)}
                        {priceMode === 'INCLUSIVE' && vat > 0 && (
                          <div className="text-[10px] font-normal text-slate-400">
                            excl. {fmt.currency(excl)}
                          </div>
                        )}
                        {priceMode === 'EXCLUSIVE' && vat > 0 && (
                          <div className="text-[10px] font-normal text-slate-400">
                            incl. {fmt.currency(incl)}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & VAT Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 pb-8 border-t border-slate-200">
            {/* VAT Summary Table */}
            <div className="w-full sm:w-1/2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Btw-specificatie
              </div>
              <table className="w-full text-xs text-slate-600 border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="p-1.5 text-left">Tarief</th>
                    <th className="p-1.5 text-right">Grondslag</th>
                    <th className="p-1.5 text-right">Btw-bedrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(vatBreakdown).map(([rate, data]) => (
                    <tr key={rate}>
                      <td className="p-1.5 font-medium">
                        {rate === 'REVERSE_CHARGE' ? 'Btw verlegd (0%)' : `Btw ${rate}%`}
                      </td>
                      <td className="p-1.5 text-right font-mono">{fmt.currency(data.base)}</td>
                      <td className="p-1.5 text-right font-mono">{fmt.currency(data.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(invoice as any).is_reverse_charge && (
                <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
                  <strong>Let op:</strong> Btw verlegd naar afnemer (Art. 194 Richtlijn 2006/112/EG).
                </div>
              )}
            </div>

            {/* Totals Box */}
            <div className="w-full sm:w-5/12 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs sm:text-sm space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotaal (excl. btw):</span>
                <span className="font-mono font-medium">{fmt.currency(subtotalExcl)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Totale btw:</span>
                <span className="font-mono font-medium">{fmt.currency(totalVat)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-base sm:text-lg font-black text-slate-900">
                <span>Totaal te betalen:</span>
                <span className="font-mono" style={{ color: accentColor }}>
                  {fmt.currency(totalIncl)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Terms & Instructions */}
          <div className="mt-6 pt-6 border-t border-slate-200 bg-slate-50/70 p-4 rounded-xl text-xs text-slate-600">
            <div className="font-bold text-slate-800 mb-1">Betalingsvoorwaarden</div>
            <div>
              Wij verzoeken u vriendelijk het totaalbedrag van <span className="font-bold text-slate-800">{fmt.currency(totalIncl)}</span> binnen {settings?.default_payment_term_days || 14} dagen (vóór {fmt.date(invoice.due_date)}) over te maken naar rekeningnummer:
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono font-semibold text-slate-800">
              <div>IBAN: <span>{settings?.iban || 'NL00BANK0123456789'}</span></div>
              {settings?.bic && <div>BIC: <span>{settings.bic}</span></div>}
              <div>Onder vermelding van: <span>{invoice.invoice_number}</span></div>
            </div>
            {invoice.notes && (
              <div className="mt-3 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 italic">
                {invoice.notes}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

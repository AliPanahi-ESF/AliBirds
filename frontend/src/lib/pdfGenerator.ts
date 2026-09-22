/**
 * AliBirds Vector PDF Generator
 * Creates clean, professional, Dutch-tax compliant A4 invoice PDFs using jsPDF.
 */
import { jsPDF } from 'jspdf'
import { Invoice, BusinessSettings, Client } from './types'
import { fmt } from './api'

export function generateInvoicePdf(
  invoice: Invoice,
  client?: Client,
  settings?: BusinessSettings,
  paymentLink?: string
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = 210
  const margin = 20
  const contentWidth = pageWidth - margin * 2 // 170mm

  const companyName = settings?.company_name || 'Studio AliBirds'
  const clientName = client?.name || invoice.client?.name || 'Klant'
  const resolvedPaymentLink = paymentLink || (settings as any)?.payment_link || ''

  // Brand primary color
  const hex = settings?.accent_color || '#4f46e5'
  const r = parseInt(hex.slice(1, 3), 16) || 79
  const g = parseInt(hex.slice(3, 5), 16) || 70
  const b = parseInt(hex.slice(5, 7), 16) || 229

  let y = 22

  // Top color accent bar
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, pageWidth, 4, 'F')

  // ── Company Header (Left) ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20, 24, 33)
  doc.text(companyName, margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  y += 5
  if (settings?.address_street) {
    doc.text(settings.address_street, margin, y)
    y += 4
  }
  const cityLine = [settings?.address_postcode, settings?.address_city, settings?.address_country || 'NL'].filter(Boolean).join(' ')
  if (cityLine) {
    doc.text(cityLine, margin, y)
    y += 4
  }
  if (settings?.email) {
    doc.text(`E-mail: ${settings.email}`, margin, y)
    y += 4
  }
  if (settings?.phone) {
    doc.text(`Tel: ${settings.phone}`, margin, y)
    y += 4
  }

  // ── Invoice Meta (Right) ───────────────────────────────────────────────────
  let rightY = 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(r, g, b)
  doc.text('FACTUUR', pageWidth - margin, rightY, { align: 'right' })

  rightY += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)

  doc.text(`Factuurnummer:`, pageWidth - margin - 35, rightY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(invoice.invoice_number, pageWidth - margin, rightY, { align: 'right' })

  rightY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(`Factuurdatum:`, pageWidth - margin - 35, rightY)
  doc.text(fmt.date(invoice.issue_date), pageWidth - margin, rightY, { align: 'right' })

  rightY += 4.5
  doc.text(`Vervaldatum:`, pageWidth - margin - 35, rightY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(fmt.date(invoice.due_date), pageWidth - margin, rightY, { align: 'right' })

  if (invoice.delivery_date) {
    rightY += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`Leverdatum:`, pageWidth - margin - 35, rightY)
    doc.text(fmt.date(invoice.delivery_date), pageWidth - margin, rightY, { align: 'right' })
  }

  y = Math.max(y, rightY) + 8

  // Divider
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  // ── Client & Legal Identifiers ─────────────────────────────────────────────
  const clientStartY = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('FACTUUR VOOR:', margin, y)

  y += 4.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(clientName, margin, y)

  y += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  if (client?.contact_person) {
    doc.text(`T.a.v. ${client.contact_person}`, margin, y)
    y += 4
  }
  if (client?.billing_address_street) {
    doc.text(client.billing_address_street, margin, y)
    y += 4
  }
  const clientCity = [client?.billing_address_postcode, client?.billing_address_city, client?.country_code].filter(Boolean).join(' ')
  if (clientCity) {
    doc.text(clientCity, margin, y)
    y += 4
  }
  if (client?.kvk_number) {
    doc.text(`KVK: ${client.kvk_number}`, margin, y)
    y += 4
  }
  if (client?.vat_number) {
    doc.text(`BTW: ${client.vat_number}`, margin, y)
    y += 4
  }

  // Company Legal IDs (Right Side)
  let legalY = clientStartY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('BEDRIJFSGEGEVENS:', pageWidth - margin, legalY, { align: 'right' })

  legalY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)

  if (settings?.kvk_number) {
    doc.text(`KVK: ${settings.kvk_number}`, pageWidth - margin, legalY, { align: 'right' })
    legalY += 4
  }
  if (settings?.btw_id) {
    doc.text(`BTW-id: ${settings.btw_id}`, pageWidth - margin, legalY, { align: 'right' })
    legalY += 4
  }
  if (settings?.iban) {
    doc.text(`IBAN: ${settings.iban}`, pageWidth - margin, legalY, { align: 'right' })
    legalY += 4
  }
  if (settings?.bic) {
    doc.text(`BIC: ${settings.bic}`, pageWidth - margin, legalY, { align: 'right' })
    legalY += 4
  }

  y = Math.max(y, legalY) + 8

  // ── Table Header ───────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, y, contentWidth, 7, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y + 7, pageWidth - margin, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)

  const colX = {
    desc: margin + 2,
    qty: margin + 95,
    price: margin + 115,
    vat: margin + 140,
    total: pageWidth - margin - 2,
  }

  doc.text('OMSCHRIJVING', colX.desc, y + 5)
  doc.text('AANTAL', colX.qty, y + 5, { align: 'center' })
  doc.text('PRIJS EXCL.', colX.price, y + 5, { align: 'right' })
  doc.text('BTW', colX.vat, y + 5, { align: 'center' })
  doc.text('TOTAAL EXCL.', colX.total, y + 5, { align: 'right' })

  y += 9

  // ── Line Items ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)

  const items = invoice.line_items || []
  items.forEach((it, idx) => {
    const qty = Number(it.quantity) || 1
    const price = Number(it.unit_price) || 0
    const lineExcl = Number(it.line_total_excl ?? price * qty)
    const vatRate = it.vat_rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${it.vat_rate}%`

    // Zebra background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 3.5, contentWidth, 7, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.text(it.description || 'Dienst / Product', colX.desc, y + 1)
    doc.text(String(qty), colX.qty, y + 1, { align: 'center' })
    doc.text(fmt.currency(price), colX.price, y + 1, { align: 'right' })
    doc.text(vatRate, colX.vat, y + 1, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.text(fmt.currency(lineExcl), colX.total, y + 1, { align: 'right' })

    y += 6.5
  })

  y += 2
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Totals Box ─────────────────────────────────────────────────────────────
  const subtotalExcl = Number(
    invoice.subtotal_excl ??
    invoice.subtotal_excl_vat ??
    items.reduce((s, it) => s + (Number(it.line_total_excl) || 0), 0)
  )
  const totalVat = Number(
    invoice.total_vat ??
    invoice.total_vat_amount ??
    items.reduce((s, it) => s + (Number(it.vat_amount) || 0), 0)
  )
  const totalIncl = Number(
    invoice.total_incl ??
    invoice.total_incl_vat ??
    (subtotalExcl + totalVat)
  )

  const totalsLabelX = pageWidth - margin - 60
  const totalsValX = pageWidth - margin

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('Subtotaal excl. btw:', totalsLabelX, y)
  doc.text(fmt.currency(subtotalExcl), totalsValX, y, { align: 'right' })
  y += 5

  doc.text('Totaal btw bedrag:', totalsLabelX, y)
  doc.text(fmt.currency(totalVat), totalsValX, y, { align: 'right' })
  y += 6

  // Grand Total Banner
  doc.setFillColor(r, g, b)
  doc.roundedRect(totalsLabelX - 5, y - 4, 65, 9, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('Totaal incl. btw:', totalsLabelX, y + 2)
  doc.text(fmt.currency(totalIncl), totalsValX, y + 2, { align: 'right' })

  y += 14

  // ── Payment Box (Bottom) ───────────────────────────────────────────────────
  const boxHeight = resolvedPaymentLink ? 26 : 20
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text('Betaalinstructies', margin + 4, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(51, 65, 85)
  doc.text(
    `Gelieve over te maken naar IBAN: ${settings?.iban || 'Zie factuur'} t.n.v. ${companyName}.`,
    margin + 4,
    y + 11
  )
  doc.text(
    `Betalingskenmerk: ${invoice.invoice_number}  |  Vervaldatum: ${fmt.date(invoice.due_date)}`,
    margin + 4,
    y + 15.5
  )

  if (resolvedPaymentLink) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(r, g, b)
    doc.text(`Directe betaallink (iDEAL): ${resolvedPaymentLink}`, margin + 4, y + 21)
  }

  // Footer note
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Hartelijk dank voor uw opdracht!', pageWidth / 2, 285, { align: 'center' })

  return doc
}

/**
 * Returns PDF document as Base64 string for Resend attachment
 */
export function generateInvoicePdfBase64(
  invoice: Invoice,
  client?: Client,
  settings?: BusinessSettings,
  paymentLink?: string
): string {
  const doc = generateInvoicePdf(invoice, client, settings, paymentLink)
  return doc.output('datauristring').split(',')[1] || ''
}

/**
 * Downloads the PDF directly to the user's browser
 */
export function downloadInvoicePdf(
  invoice: Invoice,
  client?: Client,
  settings?: BusinessSettings,
  paymentLink?: string
): void {
  const doc = generateInvoicePdf(invoice, client, settings, paymentLink)
  const filename = `Factuur-${invoice.invoice_number || 'AliBirds'}.pdf`
  doc.save(filename)
}

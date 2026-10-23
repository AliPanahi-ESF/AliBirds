/**
 * AliBirds Vector PDF Generator
 * Creates clean, professional, Dutch-tax compliant A4 invoice & quotation PDFs using jsPDF.
 * Engineered for mobile touch ergonomics, iOS Safari/PWA Web Share API, and desktop downloads.
 */
import { jsPDF } from 'jspdf'
import { Invoice, BusinessSettings, Client, Quotation } from './types'
import { generateRfReference } from './paymentReference'

const fmt = {
  currency: (n: number = 0) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0),
  date: (s: string) => {
    if (!s) return ''
    try {
      return new Date(s).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return String(s)
    }
  },
}

/**
 * Checks whether the current device supports the Web Share API with PDF files.
 * Supported on iOS Safari (iOS 15+), iPadOS, Android Chrome, and Safari macOS.
 */
export function canSharePdf(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  if (!navigator.share || !navigator.canShare) return false
  try {
    const testFile = new File([new Blob(['%PDF-1.4 test'], { type: 'application/pdf' })], 'test.pdf', {
      type: 'application/pdf',
    })
    return navigator.canShare({ files: [testFile] })
  } catch {
    return false
  }
}

/**
 * Generates an authentic, high-resolution vector PDF for an invoice.
 */
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
  
  // Resilient client resolution supporting direct prop, embedded object, or embedded array (Supabase PostgREST join)
  const rawClient = client || invoice.client
  const resolvedClient: Client | undefined = Array.isArray(rawClient) ? rawClient[0] : rawClient
  const clientName = resolvedClient?.name || 'Klant'
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

  const metaLabelX = pageWidth - margin - 65
  const metaValX = pageWidth - margin

  doc.text('Factuurnummer:', metaLabelX, rightY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(invoice.invoice_number, metaValX, rightY, { align: 'right' })

  rightY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text('Factuurdatum:', metaLabelX, rightY)
  doc.text(fmt.date(invoice.issue_date), metaValX, rightY, { align: 'right' })

  rightY += 4.5
  doc.text('Vervaldatum:', metaLabelX, rightY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(fmt.date(invoice.due_date), metaValX, rightY, { align: 'right' })

  if (invoice.delivery_date) {
    rightY += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Leverdatum:', metaLabelX, rightY)
    doc.text(fmt.date(invoice.delivery_date), metaValX, rightY, { align: 'right' })
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
  if (resolvedClient?.contact_person) {
    doc.text(`T.a.v. ${resolvedClient.contact_person}`, margin, y)
    y += 4
  }
  if (resolvedClient?.billing_address_street) {
    doc.text(resolvedClient.billing_address_street, margin, y)
    y += 4
  }
  const clientCity = [resolvedClient?.billing_address_postcode, resolvedClient?.billing_address_city, resolvedClient?.country_code].filter(Boolean).join(' ')
  if (clientCity) {
    doc.text(clientCity, margin, y)
    y += 4
  }
  if (resolvedClient?.kvk_number) {
    doc.text(`KVK: ${resolvedClient.kvk_number}`, margin, y)
    y += 4
  }
  if (resolvedClient?.vat_number) {
    doc.text(`BTW: ${resolvedClient.vat_number}`, margin, y)
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
    desc: margin + 2,             // 22mm
    qty: margin + 82,             // 102mm (center)
    price: margin + 114,          // 134mm (right)
    vat: margin + 132,            // 152mm (center)
    total: pageWidth - margin - 2 // 188mm (right)
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
    // If approaching bottom of the page, add page and reprint header
    if (y > 235) {
      doc.addPage()
      y = 20
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y, contentWidth, 7, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, y + 7, pageWidth - margin, y + 7)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.text('OMSCHRIJVING', colX.desc, y + 5)
      doc.text('AANTAL', colX.qty, y + 5, { align: 'center' })
      doc.text('PRIJS EXCL.', colX.price, y + 5, { align: 'right' })
      doc.text('BTW', colX.vat, y + 5, { align: 'center' })
      doc.text('TOTAAL EXCL.', colX.total, y + 5, { align: 'right' })
      y += 9
    }

    const qty = Number(it.quantity) || 1
    const price = Number(it.unit_price) || 0
    const lineExcl = Number(it.line_total_excl ?? (price * qty))
    const vatRate = it.vat_rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${it.vat_rate}%`

    const descLines = doc.splitTextToSize(it.description || 'Dienst / Product', 72)
    const rowHeight = Math.max(6.5, descLines.length * 4.2 + 2.3)

    // Zebra background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 3.5, contentWidth, rowHeight, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.text(descLines, colX.desc, y + 1)
    doc.text(String(qty), colX.qty, y + 1, { align: 'center' })
    doc.text(fmt.currency(price), colX.price, y + 1, { align: 'right' })
    doc.text(vatRate, colX.vat, y + 1, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.text(fmt.currency(lineExcl), colX.total, y + 1, { align: 'right' })

    y += rowHeight
  })

  y += 2
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // Check if enough space remains for totals and payment instructions
  if (y > 215) {
    doc.addPage()
    y = 25
  }

  // ── Multi-rate VAT Breakdown & Totals Box (Dutch Tax Compliant) ────────────
  const itemsSumExcl = items.reduce((s, it) => s + (Number(it.line_total_excl ?? (Number(it.quantity || 1) * Number(it.unit_price || 0))) || 0), 0)
  const itemsSumVat = items.reduce((s, it) => {
    const rate = String(it.vat_rate || '21')
    const excl = Number(it.line_total_excl ?? (Number(it.quantity || 1) * Number(it.unit_price || 0))) || 0
    return s + (Number(it.vat_amount ?? (rate === 'REVERSE_CHARGE' ? 0 : Math.round(excl * (Number(rate) / 100) * 100) / 100)) || 0)
  }, 0)

  const subtotalExcl = items.length > 0 ? itemsSumExcl : Number(invoice.subtotal_excl ?? invoice.subtotal_excl_vat ?? 0)
  const totalVat = items.length > 0 ? itemsSumVat : Number(invoice.total_vat ?? invoice.total_vat_amount ?? 0)
  const totalIncl = subtotalExcl + totalVat

  // Compute breakdown per VAT tariff (Art. 35a lid 1 sub i Wet OB)
  const vatBreakdown: Record<string, { base: number; vat: number }> = {}
  items.forEach(it => {
    const rate = String(it.vat_rate || '21')
    const excl = Number(it.line_total_excl ?? (Number(it.quantity) * Number(it.unit_price))) || 0
    const vat = Number(it.vat_amount ?? (rate === 'REVERSE_CHARGE' ? 0 : Math.round(excl * (Number(rate) / 100) * 100) / 100)) || 0
    if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
    vatBreakdown[rate].base += excl
    vatBreakdown[rate].vat += vat
  })

  // Left side: Btw-specificatie table (Legal Requirement)
  const vatTableX = margin
  const vatBaseX = margin + 55
  const vatAmountX = margin + 78
  let vatTableY = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('BTW-SPECIFICATIE', vatTableX, vatTableY)
  doc.text('GRONDSLAG', vatBaseX, vatTableY, { align: 'right' })
  doc.text('BTW', vatAmountX, vatTableY, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  vatTableY += 4

  const rateLabels: Record<string, string> = {
    '21': 'Tarief 21% (hoog)',
    '9': 'Tarief 9% (laag)',
    '0': 'Tarief 0% (nul)',
    'REVERSE_CHARGE': 'Btw verlegd (0%)',
  }

  Object.entries(vatBreakdown).forEach(([rate, data]) => {
    const label = rateLabels[rate] || `Tarief ${rate}%`
    doc.text(label, vatTableX, vatTableY)
    doc.text(fmt.currency(data.base), vatBaseX, vatTableY, { align: 'right' })
    doc.text(fmt.currency(data.vat), vatAmountX, vatTableY, { align: 'right' })
    vatTableY += 3.5
  })

  // Right side: Grand Totals
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

  y = Math.max(y + 11, vatTableY + 4)

  // Reverse Charge Legal Notice (Art. 12 lid 3 Wet OB / EU Richtlijn 2006/112/EG)
  const isReverseCharge = (invoice as any).is_reverse_charge || items.some(i => i.vat_rate === 'REVERSE_CHARGE')
  if (isReverseCharge) {
    doc.setFillColor(254, 243, 199)
    doc.setDrawColor(245, 158, 11)
    doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(146, 64, 14)
    const noticeText = `Btw verlegd op grond van art. 12 lid 3 Wet OB / Art. 194-196 EU Richtlijn 2006/112/EG${resolvedClient?.vat_number ? ` | Btw-id afnemer: ${resolvedClient.vat_number}` : ''}`
    doc.text(noticeText, margin + 3, y + 4.5)
    y += 10
  }

  // ── Payment Box (Bottom) ───────────────────────────────────────────────────
  const betalingsKenmerk = invoice.payment_reference || generateRfReference(invoice.invoice_number)
  const boxHeight = resolvedPaymentLink ? 27 : 22
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text('Betaalinstructies (SEPA Overboeking)', margin + 4, y + 5.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(51, 65, 85)
  doc.text(
    `Gelieve over te maken naar IBAN: ${settings?.iban || 'Zie factuur'} t.n.v. ${companyName}.`,
    margin + 4,
    y + 10.5
  )
  doc.text(
    `Betalingskenmerk: ${betalingsKenmerk}   |   Factuurnummer: ${invoice.invoice_number}   |   Vervaldatum: ${fmt.date(invoice.due_date)}`,
    margin + 4,
    y + 15
  )
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    'Vermeld s.v.p. het bovenstaande betalingskenmerk bij uw overboeking voor directe automatische verwerking.',
    margin + 4,
    y + 19.5
  )

  if (resolvedPaymentLink) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(r, g, b)
    doc.text(`Directe betaallink (iDEAL): ${resolvedPaymentLink}`, margin + 4, y + 24.5)
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
 * Triggers native Web Share API with the real PDF file.
 * Opens iOS Share Sheet with "Save to Files" (Bewaar in Bestanden), WhatsApp, AirDrop, etc.
 */
export async function shareInvoicePdf(
  invoice: Invoice,
  client?: Client,
  settings?: BusinessSettings,
  paymentLink?: string
): Promise<boolean> {
  const doc = generateInvoicePdf(invoice, client, settings, paymentLink)
  const filename = `Factuur-${invoice.invoice_number || 'AliBirds'}.pdf`
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Factuur ${invoice.invoice_number} van ${settings?.company_name || 'AliBirds'}`,
      })
      return true
    } catch (err: any) {
      if (err.name === 'AbortError') return false // User dismissed share sheet
      console.warn('Native Web Share failed, falling back to download:', err)
    }
  }

  // Fallback to direct download
  await downloadInvoicePdf(invoice, client, settings, paymentLink)
  return true
}

/**
 * Downloads the PDF directly to the user's device.
 * Handles iOS Mobile Safari, Android, and desktop browsers with full blob compatibility.
 */
export async function downloadInvoicePdf(
  invoice: Invoice,
  client?: Client,
  settings?: BusinessSettings,
  paymentLink?: string
): Promise<void> {
  const doc = generateInvoicePdf(invoice, client, settings, paymentLink)
  const filename = `Factuur-${invoice.invoice_number || 'AliBirds'}.pdf`
  const blob = doc.output('blob')

  // Check iOS WebKit
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

  // In iOS PWA Standalone mode, standard <a download> is suppressed by Apple WebKit.
  // Using native Web Share summons "Save to Files" directly.
  const isStandalone =
    typeof window !== 'undefined' &&
    (Boolean((window.navigator as any).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches)

  if (isIOS && isStandalone && canSharePdf()) {
    const file = new File([blob], filename, { type: 'application/pdf' })
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Factuur ${invoice.invoice_number}`,
      })
      return
    } catch (err: any) {
      if (err.name === 'AbortError') return
    }
  }

  // Safe Blob URL download
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    if (a.parentNode) {
      document.body.removeChild(a)
    }
    URL.revokeObjectURL(blobUrl)
  }, 3000)
}

/**
 * ── Quotations PDF Generation & Export ─────────────────────────────────────────
 */
export function generateQuotationPdf(
  quotation: Quotation,
  client?: Client,
  settings?: BusinessSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = 210
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  const companyName = settings?.company_name || 'Studio AliBirds'
  const rawClient = client || quotation.client
  const resolvedClient: Client | undefined = Array.isArray(rawClient) ? rawClient[0] : rawClient
  const clientName = resolvedClient?.name || 'Klant'

  const hex = settings?.accent_color || '#4f46e5'
  const r = parseInt(hex.slice(1, 3), 16) || 79
  const g = parseInt(hex.slice(3, 5), 16) || 70
  const b = parseInt(hex.slice(5, 7), 16) || 229

  let y = 22

  // Top accent bar
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, pageWidth, 4, 'F')

  // Company Header
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

  // Quotation Meta (Right)
  let rightY = 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(r, g, b)
  doc.text('OFFERTE', pageWidth - margin, rightY, { align: 'right' })

  rightY += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)

  const metaLabelX = pageWidth - margin - 65
  const metaValX = pageWidth - margin

  doc.text('Offertenummer:', metaLabelX, rightY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(quotation.quotation_number, metaValX, rightY, { align: 'right' })

  rightY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text('Offertedatum:', metaLabelX, rightY)
  doc.text(fmt.date(quotation.issue_date), metaValX, rightY, { align: 'right' })

  rightY += 4.5
  doc.text('Geldig tot:', metaLabelX, rightY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(fmt.date(quotation.valid_until_date), metaValX, rightY, { align: 'right' })

  y = Math.max(y, rightY) + 8

  // Divider
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  // Client Details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('OFFERTE VOOR:', margin, y)

  y += 4.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(clientName, margin, y)

  y += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  if (resolvedClient?.contact_person) {
    doc.text(`T.a.v. ${resolvedClient.contact_person}`, margin, y)
    y += 4
  }
  if (resolvedClient?.billing_address_street) {
    doc.text(resolvedClient.billing_address_street, margin, y)
    y += 4
  }
  const clientCity = [resolvedClient?.billing_address_postcode, resolvedClient?.billing_address_city, resolvedClient?.country_code].filter(Boolean).join(' ')
  if (clientCity) {
    doc.text(clientCity, margin, y)
    y += 4
  }

  y += 8

  // Line items table
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, y, contentWidth, 7, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y + 7, pageWidth - margin, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)

  const colX = {
    desc: margin + 2,             // 22mm
    qty: margin + 82,             // 102mm (center)
    price: margin + 114,          // 134mm (right)
    vat: margin + 132,            // 152mm (center)
    total: pageWidth - margin - 2 // 188mm (right)
  }

  doc.text('OMSCHRIJVING', colX.desc, y + 5)
  doc.text('AANTAL', colX.qty, y + 5, { align: 'center' })
  doc.text('PRIJS EXCL.', colX.price, y + 5, { align: 'right' })
  doc.text('BTW', colX.vat, y + 5, { align: 'center' })
  doc.text('TOTAAL EXCL.', colX.total, y + 5, { align: 'right' })

  y += 9

  const items = quotation.line_items || []
  items.forEach((it, idx) => {
    if (y > 235) {
      doc.addPage()
      y = 20
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y, contentWidth, 7, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, y + 7, pageWidth - margin, y + 7)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.text('OMSCHRIJVING', colX.desc, y + 5)
      doc.text('AANTAL', colX.qty, y + 5, { align: 'center' })
      doc.text('PRIJS EXCL.', colX.price, y + 5, { align: 'right' })
      doc.text('BTW', colX.vat, y + 5, { align: 'center' })
      doc.text('TOTAAL EXCL.', colX.total, y + 5, { align: 'right' })
      y += 9
    }
    const qty = Number(it.quantity) || 1
    const price = Number(it.unit_price) || 0
    const lineExcl = Number(it.line_total_excl ?? (price * qty))
    const vatRate = it.vat_rate === 'REVERSE_CHARGE' ? 'Verlegd' : `${it.vat_rate}%`

    const descLines = doc.splitTextToSize(it.description || 'Dienst / Product', 72)
    const rowHeight = Math.max(6.5, descLines.length * 4.2 + 2.3)

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 3.5, contentWidth, rowHeight, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.text(descLines, colX.desc, y + 1)
    doc.text(String(qty), colX.qty, y + 1, { align: 'center' })
    doc.text(fmt.currency(price), colX.price, y + 1, { align: 'right' })
    doc.text(vatRate, colX.vat, y + 1, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.text(fmt.currency(lineExcl), colX.total, y + 1, { align: 'right' })

    y += rowHeight
  })

  y += 2
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // Totals
  const totalsLabelX = pageWidth - margin - 60
  const totalsValX = pageWidth - margin

  const quoteSumExcl = items.reduce((s, it) => s + (Number(it.line_total_excl ?? (Number(it.quantity || 1) * Number(it.unit_price || 0))) || 0), 0)
  const quoteSumVat = items.reduce((s, it) => {
    const rate = String(it.vat_rate || '21')
    const excl = Number(it.line_total_excl ?? (Number(it.quantity || 1) * Number(it.unit_price || 0))) || 0
    return s + (Number(it.vat_amount ?? (rate === 'REVERSE_CHARGE' ? 0 : Math.round(excl * (Number(rate) / 100) * 100) / 100)) || 0)
  }, 0)

  const subtotalExcl = items.length > 0 ? quoteSumExcl : (Number(quotation.subtotal_excl) || 0)
  const totalVat = items.length > 0 ? quoteSumVat : (Number(quotation.total_vat) || 0)
  const totalIncl = subtotalExcl + totalVat

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('Subtotaal excl. btw:', totalsLabelX, y)
  doc.text(fmt.currency(subtotalExcl), totalsValX, y, { align: 'right' })
  y += 5

  doc.text('Totaal btw bedrag:', totalsLabelX, y)
  doc.text(fmt.currency(totalVat), totalsValX, y, { align: 'right' })
  y += 6

  doc.setFillColor(r, g, b)
  doc.roundedRect(totalsLabelX - 5, y - 4, 65, 9, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('Totaal incl. btw:', totalsLabelX, y + 2)
  doc.text(fmt.currency(totalIncl), totalsValX, y + 2, { align: 'right' })

  // Footer note
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Deze offerte is geheel vrijblijvend geldig tot de vermelde datum.', pageWidth / 2, 285, { align: 'center' })

  return doc
}

export async function downloadQuotationPdf(
  quotation: Quotation,
  client?: Client,
  settings?: BusinessSettings
): Promise<void> {
  const doc = generateQuotationPdf(quotation, client, settings)
  const filename = `Offerte-${quotation.quotation_number || 'AliBirds'}.pdf`
  const blob = doc.output('blob')
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  }, 3000)
}

export async function shareQuotationPdf(
  quotation: Quotation,
  client?: Client,
  settings?: BusinessSettings
): Promise<boolean> {
  const doc = generateQuotationPdf(quotation, client, settings)
  const filename = `Offerte-${quotation.quotation_number || 'AliBirds'}.pdf`
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Offerte ${quotation.quotation_number}`,
      })
      return true
    } catch (err: any) {
      if (err.name === 'AbortError') return false
    }
  }

  await downloadQuotationPdf(quotation, client, settings)
  return true
}

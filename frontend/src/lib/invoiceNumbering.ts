import { Client, Invoice, BusinessSettings } from './types'

export type InvoiceIdGenerationMode =
  | 'CLIENT_SEQ'      // Client previous invoice + 1
  | 'GLOBAL_SEQ'      // General sequential (settings prefix + seq)
  | 'CLIENT_CODE_SEQ' // Client initials/code + seq (e.g. ACM-0001)
  | 'YEAR_MONTH_SEQ'  // YYYYMM-001
  | 'CUSTOM'          // Custom manual input

export interface InvoiceIdOption {
  mode: InvoiceIdGenerationMode
  id: string
  label: string
  description: string
  isRecommended?: boolean
  previousInvoiceNumber?: string
}

/**
 * Increment the numeric suffix of an invoice number while preserving prefix and zero-padding
 * Examples:
 *   "2026-0003" -> "2026-0004"
 *   "ACM-042"   -> "ACM-043"
 *   "INV-99"    -> "INV-100"
 *   "1005"      -> "1006"
 */
export function incrementInvoiceNumber(invNum: string): string {
  if (!invNum || typeof invNum !== 'string') return '2026-0001'

  const trimmed = invNum.trim()
  const match = trimmed.match(/^(.*?)(\d+)$/)

  if (!match) {
    return `${trimmed}-1`
  }

  const prefix = match[1]
  const numStr = match[2]
  const nextNum = parseInt(numStr, 10) + 1
  const padded = String(nextNum).padStart(numStr.length, '0')

  return `${prefix}${padded}`
}

/**
 * Extract a clean 3-4 uppercase letter code from a client name
 * e.g. "Acme Corporation B.V." -> "ACM"
 *      "Panahi Design" -> "PAN"
 *      "De Jong BV" -> "JONG"
 */
export function generateClientCode(name?: string): string {
  if (!name || !name.trim()) return 'KLNT'

  const words = name
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(w => !['bv', 'b.v.', 'vof', 'v.o.f.', 'eenmanszaak', 'de', 'het', 'een', 'van', 'der', 'en'].includes(w.toLowerCase()))

  if (words.length >= 2) {
    const letters = words.map(w => w[0].toUpperCase()).join('')
    return letters.slice(0, 4)
  }

  const singleWord = (words[0] || name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return singleWord.slice(0, 4) || 'KLNT'
}

/**
 * Find the most recent invoice for a specific client
 */
export function findLastInvoiceForClient(
  clientId?: string,
  clientName?: string,
  invoices: Invoice[] = []
): Invoice | null {
  if (!clientId && !clientName) return null

  const clientInvoices = invoices.filter(inv => {
    if (clientId && inv.client_id === clientId) return true
    if (clientId && inv.client?.id === clientId) return true
    if (clientName && inv.client?.name && inv.client.name.trim().toLowerCase() === clientName.trim().toLowerCase()) return true
    return false
  })

  if (clientInvoices.length === 0) return null

  // Sort by created_at or issue_date descending, then invoice_number
  return clientInvoices.sort((a, b) => {
    const dateA = new Date(a.issue_date || a.created_at || 0).getTime()
    const dateB = new Date(b.issue_date || b.created_at || 0).getTime()
    if (dateB !== dateA) return dateB - dateA
    return (b.invoice_number || '').localeCompare(a.invoice_number || '')
  })[0]
}

/**
 * Generate all smart invoice ID options for the current client and business settings
 */
export function getSmartInvoiceIdOptions({
  selectedClient,
  invoices = [],
  settings,
}: {
  selectedClient?: Client | null
  invoices?: Invoice[]
  settings?: BusinessSettings | null
}): InvoiceIdOption[] {
  const currentYear = new Date().getFullYear()
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const defaultPrefix = settings?.invoice_prefix || `${currentYear}-`

  // 1. Calculate highest general sequence
  let maxSeq = settings?.next_invoice_sequence || 1
  for (const inv of invoices) {
    if (inv.invoice_number && inv.invoice_number.startsWith(defaultPrefix)) {
      const match = inv.invoice_number.slice(defaultPrefix.length).match(/^(\d+)/)
      if (match) {
        const n = parseInt(match[1], 10)
        if (n >= maxSeq) maxSeq = n + 1
      }
    }
  }
  const globalSeqId = `${defaultPrefix}${String(maxSeq).padStart(4, '0')}`

  // 2. Check previous invoice for this specific client
  const lastClientInvoice = selectedClient
    ? findLastInvoiceForClient(selectedClient.id, selectedClient.name, invoices)
    : null

  const options: InvoiceIdOption[] = []

  // Option A: Client-based sequential (last invoice ID + 1)
  if (lastClientInvoice?.invoice_number) {
    const clientNextId = incrementInvoiceNumber(lastClientInvoice.invoice_number)
    options.push({
      mode: 'CLIENT_SEQ',
      id: clientNextId,
      label: `Klant volgnummer (+1)`,
      description: `Vorige factuur van ${selectedClient?.name}: ${lastClientInvoice.invoice_number} → Volgend: ${clientNextId}`,
      isRecommended: true,
      previousInvoiceNumber: lastClientInvoice.invoice_number,
    })
  }

  // Option B: Standard Global Sequential
  options.push({
    mode: 'GLOBAL_SEQ',
    id: globalSeqId,
    label: `Algemene reeks`,
    description: `Standaard opeenvolgend (${globalSeqId}) volgens uw bedrijfsinstellingen`,
    isRecommended: !lastClientInvoice,
  })

  // Option C: Client Code based sequence
  if (selectedClient?.name) {
    const clientCode = generateClientCode(selectedClient.name)
    // Find highest count with this client code
    let clientCodeSeq = 1
    const codePrefix = `${clientCode}-${currentYear}-`
    for (const inv of invoices) {
      if (inv.invoice_number && inv.invoice_number.startsWith(codePrefix)) {
        const match = inv.invoice_number.slice(codePrefix.length).match(/^(\d+)/)
        if (match) {
          const n = parseInt(match[1], 10)
          if (n >= clientCodeSeq) clientCodeSeq = n + 1
        }
      }
    }
    const clientCodeId = `${codePrefix}${String(clientCodeSeq).padStart(2, '0')}`
    options.push({
      mode: 'CLIENT_CODE_SEQ',
      id: clientCodeId,
      label: `Klantcode (${clientCode})`,
      description: `Prefix met klantafkorting: ${clientCodeId}`,
    })
  }

  // Option D: Year-Month based sequence (e.g. 202610-001)
  const ymPrefix = `${currentYear}${currentMonth}-`
  let ymSeq = 1
  for (const inv of invoices) {
    if (inv.invoice_number && inv.invoice_number.startsWith(ymPrefix)) {
      const match = inv.invoice_number.slice(ymPrefix.length).match(/^(\d+)/)
      if (match) {
        const n = parseInt(match[1], 10)
        if (n >= ymSeq) ymSeq = n + 1
      }
    }
  }
  const ymId = `${ymPrefix}${String(ymSeq).padStart(3, '0')}`
  options.push({
    mode: 'YEAR_MONTH_SEQ',
    id: ymId,
    label: `Jaar-Maand`,
    description: `Gestructureerd per factuurmaand: ${ymId}`,
  })

  return options
}

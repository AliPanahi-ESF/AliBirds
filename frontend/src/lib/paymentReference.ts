/**
 * AliBirds Automated Payment Reference Engine (SEPA ISO 11649 / Dutch Betalingskenmerk)
 * 
 * Provides:
 * 1. ISO 11649 RF Creditor Reference generation (Modulo 97-10 check digits).
 * 2. ISO 11649 RF Creditor Reference validation.
 * 3. Dutch 16-digit Modulo 11 Betalingskenmerk generation & validation.
 * 4. Remittance & bank statement reference extraction & auto-reconciliation scoring.
 */

import { BankTransaction, Invoice } from './types'

/**
 * Normalizes an input reference by removing whitespace, hyphens, and slashes,
 * and converting to uppercase.
 */
export function cleanReference(raw: string): string {
  if (!raw) return ''
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * Formats a clean reference string in standard groups of 4 characters
 * e.g. "RF1820260001" -> "RF18 2026 0001"
 */
export function formatPaymentReference(ref: string): string {
  if (!ref) return ''
  const cleaned = cleanReference(ref)
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned
}

/**
 * Helper: Converts alphanumeric string to numeric string according to ISO 7064
 * A=10, B=11, ..., Z=35. Digits 0-9 stay the same.
 */
function toNumericString(str: string): string {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      // 0-9
      result += str[i]
    } else if (code >= 65 && code <= 90) {
      // A-Z -> 10..35
      result += (code - 55).toString()
    }
  }
  return result
}

/**
 * Computes ISO 11649 RF Creditor Reference check digits using Modulo 97-10.
 * Standard used by Rabobank, ING, ABN AMRO, bunq, Knab, and all SEPA banks.
 * 
 * @param invoiceNumber Invoice identifier (e.g. "2026-0001", "INV-2026-99")
 * @returns Formatted RF Creditor Reference (e.g. "RF18 2026 0001")
 */
export function generateRfReference(invoiceNumber: string): string {
  if (!invoiceNumber) {
    invoiceNumber = `${new Date().getFullYear()}0001`
  }

  // Strip non-alphanumeric chars; limit payload to 21 chars (ISO 11649 max total length 25)
  let payload = cleanReference(invoiceNumber)
  if (payload.startsWith('RF')) {
    // If it already has RF prefix, strip RF and 2 check digits if present
    if (/^RF\d{2}/.test(payload)) {
      payload = payload.slice(4)
    } else {
      payload = payload.slice(2)
    }
  }
  if (!payload) {
    payload = `${new Date().getFullYear()}0001`
  }
  if (payload.length > 21) {
    payload = payload.slice(0, 21)
  }

  // ISO 11649 Algorithm:
  // 1. Append 'RF00' to payload
  // 2. Convert to numeric string (R=27, F=15, 0=0, 0=0)
  // 3. remainder = BigInt(numeric) % 97n
  // 4. checkDigits = 98 - remainder
  const prep = payload + 'RF00'
  const numericStr = toNumericString(prep)
  const remainder = Number(BigInt(numericStr) % 97n)
  const checkDigits = 98 - remainder
  const checkDigitsStr = checkDigits < 10 ? `0${checkDigits}` : `${checkDigits}`

  const fullRef = `RF${checkDigitsStr}${payload}`
  return formatPaymentReference(fullRef)
}

/**
 * Validates whether a string is a mathematically valid ISO 11649 Creditor Reference
 */
export function isValidRfReference(ref: string): boolean {
  if (!ref) return false
  const cleaned = cleanReference(ref)
  if (!cleaned.startsWith('RF') || cleaned.length < 5 || cleaned.length > 25) {
    return false
  }

  const checkDigits = cleaned.slice(2, 4)
  if (!/^\d{2}$/.test(checkDigits)) {
    return false
  }

  // Move first 4 chars (RFxx) to the end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)
  const numericStr = toNumericString(rearranged)
  if (!numericStr) return false

  try {
    const remainder = Number(BigInt(numericStr) % 97n)
    return remainder === 1
  } catch {
    return false
  }
}

/**
 * Generates a Dutch 16-digit Modulo 11 Betalingskenmerk (Acceptgiro style)
 * e.g. "0000 0020 2600 0113"
 */
export function generateBetalingskenmerk16(input: string): string {
  const digitsOnly = (input || '').replace(/\D/g, '') || `${new Date().getFullYear()}0001`
  // Pad to 15 digits
  const padded15 = digitsOnly.padStart(15, '0').slice(-15)
  
  // Modulo 11 weights: 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4 (from right to left)
  const weights = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4]
  let sum = 0
  for (let i = 0; i < 15; i++) {
    const d = parseInt(padded15[14 - i], 10)
    sum += d * weights[i]
  }

  let checkDigit = 11 - (sum % 11)
  if (checkDigit === 11) checkDigit = 0
  if (checkDigit === 10) checkDigit = 1 // or 0 fallback

  const full16 = padded15 + checkDigit.toString()
  return formatPaymentReference(full16)
}

/**
 * Extracts candidate payment references from remittance text or raw MT940 line :86:
 */
export function extractPaymentReferenceCandidates(text: string): {
  rfReferences: string[]
  invoiceNumbers: string[]
  cleanedText: string
} {
  if (!text) return { rfReferences: [], invoiceNumbers: [], cleanedText: '' }

  const rfReferences: string[] = []
  const invoiceNumbers: string[] = []

  // 1. Look for explicit ISO 11649 RF patterns: e.g. "RF18 2026 0001" or "RF1820260001"
  const rfRegex = /\b(RF\s*\d{2}(?:[\s\-]?[A-Z0-9]){4,21})\b/gi
  let match: RegExpExecArray | null
  while ((match = rfRegex.exec(text)) !== null) {
    const rawMatch = match[1]
    const cleaned = cleanReference(rawMatch)
    if (isValidRfReference(cleaned)) {
      rfReferences.push(formatPaymentReference(cleaned))
    }
  }

  // 2. Look for tagged remittance references: /REMI/ /EREF/ /CSID/ >20
  const taggedMatches = [
    text.match(/\/REMI\/([^\/]+)/i)?.[1],
    text.match(/\/EREF\/([^\/]+)/i)?.[1],
    text.match(/\/CSID\/([^\/]+)/i)?.[1],
    text.match(/>20([^\/>]+)/)?.[1],
    text.match(/KENMERK:?\s*([A-Z0-9\s\-]+)/i)?.[1],
  ].filter(Boolean) as string[]

  for (const tag of taggedMatches) {
    const cleaned = cleanReference(tag)
    if (cleaned.startsWith('RF') && isValidRfReference(cleaned)) {
      rfReferences.push(formatPaymentReference(cleaned))
    }
  }

  // 3. Look for standard invoice numbers (e.g. 2026-0001, 2026_0001, 20260001, FACT-2026-001)
  const invRegex = /\b(202\d[-_]?\d{3,5}|FACT[-_]?202\d[-_]?\d{3,5}|\d{4,8})\b/gi
  while ((match = invRegex.exec(text)) !== null) {
    invoiceNumbers.push(match[1])
  }

  return {
    rfReferences: Array.from(new Set(rfReferences)),
    invoiceNumbers: Array.from(new Set(invoiceNumbers)),
    cleanedText: cleanReference(text),
  }
}

export interface MatchScoreResult {
  score: number
  matchedReason: 'BETALINGSKENMERK_EXACT' | 'INVOICE_NUMBER_EXACT' | 'AMOUNT_AND_CLIENT_NAME' | 'AMOUNT_AND_IBAN' | 'AMOUNT_ONLY' | 'NONE'
  details: string
}

/**
 * Calculates a match confidence score between an incoming bank transaction and an invoice.
 * Tier 1 (100%): Exact ISO 11649 Betalingskenmerk match in remittance
 * Tier 2 (98%): Exact Invoice Number match in remittance
 * Tier 3 (95%): Exact Amount + Counterparty name matches client
 * Tier 4 (80%): Exact Amount only
 */
export function calculateInvoiceMatchScore(
  tx: Partial<BankTransaction>,
  invoice: Invoice
): MatchScoreResult {
  const isDebit = tx.type === 'DEBIT' || tx.transaction_type === 'DEBIT'
  if (isDebit) {
    return { score: 0, matchedReason: 'NONE', details: 'Transactie is debet/afschrijving' }
  }

  const remittance = `${tx.description || ''} ${tx.remittance_reference || ''} ${tx.raw_reference || ''}`
  const txClean = cleanReference(remittance)
  const txAmount = Number(tx.amount || 0)
  const invTotal = Number(invoice.total_incl_vat ?? invoice.total_incl ?? 0)
  const amountMatches = Math.abs(txAmount - invTotal) < 0.02

  // ── Tier 1: Exact ISO 11649 Payment Reference (Betalingskenmerk) ─────────
  if (invoice.payment_reference) {
    const invRefClean = cleanReference(invoice.payment_reference)
    if (invRefClean && txClean.includes(invRefClean)) {
      return {
        score: 100,
        matchedReason: 'BETALINGSKENMERK_EXACT',
        details: `100% match via betalingskenmerk (${invoice.payment_reference})`,
      }
    }
  }

  // Also check if an RF reference generated for this invoice matches
  const autoGeneratedRef = cleanReference(generateRfReference(invoice.invoice_number))
  if (autoGeneratedRef && txClean.includes(autoGeneratedRef)) {
    return {
      score: 100,
      matchedReason: 'BETALINGSKENMERK_EXACT',
      details: `100% match via berekend betalingskenmerk (${formatPaymentReference(autoGeneratedRef)})`,
    }
  }

  // ── Tier 2: Exact Invoice Number ─────────────────────────────────────────
  if (invoice.invoice_number) {
    const invNumClean = cleanReference(invoice.invoice_number)
    if (invNumClean && txClean.includes(invNumClean)) {
      return {
        score: 98,
        matchedReason: 'INVOICE_NUMBER_EXACT',
        details: `98% match via factuurnummer (${invoice.invoice_number})`,
      }
    }
  }

  // ── Tier 3: Exact Amount + Client Name / Counterparty Match ──────────────
  const contraName = (tx.counterpart_name || tx.contra_account_name || '').toLowerCase().trim()
  const clientName = (invoice.client?.name || '').toLowerCase().trim()

  if (amountMatches) {
    if (clientName && contraName && (contraName.includes(clientName) || clientName.includes(contraName))) {
      return {
        score: 95,
        matchedReason: 'AMOUNT_AND_CLIENT_NAME',
        details: `95% match: exact bedrag en klantnaam (${invoice.client?.name})`,
      }
    }

    return {
      score: 75,
      matchedReason: 'AMOUNT_ONLY',
      details: `75% match: identiek factuurbedrag (${invTotal})`,
    }
  }

  return { score: 0, matchedReason: 'NONE', details: 'Geen overeenkomst' }
}

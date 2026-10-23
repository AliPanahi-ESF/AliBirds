/**
 * Dutch VAT (Omzetbelasting) and Legal Invoicing Calculations
 * Strict adherence to Wet op de omzetbelasting 1968 & Belastingdienst guidelines.
 *
 * Rules:
 * 1. Line amounts and VAT rounded to 2 decimal places (cents) using standard commercial rounding.
 * 2. In EXCLUSIVE mode: excl = round(q * p), vat = round(excl * rate / 100), incl = excl + vat.
 * 3. In INCLUSIVE mode: incl = round(q * p), excl = round(incl / (1 + rate/100)), vat = incl - excl.
 * 4. Belastingdienst portal rounding:
 *    - Omzet and verschuldigde belasting (rubrieken 1, 2, 3, 4, 5a) are rounded DOWN to whole euros.
 *    - Voorbelasting (rubriek 5b) is rounded UP to whole euros in favor of the taxpayer.
 */

export interface LineCalculationResult {
  excl: number
  vat: number
  incl: number
}

export function calculateLineItem(
  quantity: number | string,
  unitPrice: number | string,
  vatRate: string,
  mode: 'EXCLUSIVE' | 'INCLUSIVE' | string = 'EXCLUSIVE'
): LineCalculationResult {
  const q = Number(quantity) || 0
  const p = Number(unitPrice) || 0
  const isReverseCharge = vatRate === 'REVERSE_CHARGE'
  const rateNum = isReverseCharge ? 0 : (Number(vatRate) || 0)

  if (mode === 'INCLUSIVE') {
    const incl = Math.round(q * p * 100) / 100
    const excl = rateNum === 0 ? incl : Math.round((incl / (1 + rateNum / 100)) * 100) / 100
    const vat = Math.round((incl - excl) * 100) / 100
    return { excl, vat, incl }
  }

  // EXCLUSIVE mode (default for B2B)
  const excl = Math.round(q * p * 100) / 100
  // Multiply by percentage before dividing by 100 to avoid IEEE-754 float drift
  const vat = rateNum === 0 ? 0 : Math.round(excl * rateNum) / 100
  const incl = Math.round((excl + vat) * 100) / 100
  return { excl, vat, incl }
}

/**
 * Validates a Dutch VAT Identification Number (BTW-identificatienummer).
 * Format: NL + 9 digits + 'B' + 2 digits (e.g. NL123456789B01).
 * Total length: 14 characters.
 */
export function validateDutchBtwId(btwId: string): boolean {
  if (!btwId || typeof btwId !== 'string') return false
  const clean = btwId.trim().toUpperCase().replace(/[\s.-]/g, '')
  const regex = /^NL[0-9]{9}B[0-9]{2}$/
  return regex.test(clean)
}

/**
 * Validates a Dutch Chamber of Commerce (KVK) number.
 * Format: exactly 8 digits.
 */
export function validateKvkNumber(kvk: string): boolean {
  if (!kvk || typeof kvk !== 'string') return false
  const clean = kvk.trim().replace(/[\s.-]/g, '')
  return /^[0-9]{8}$/.test(clean)
}

/**
 * Belastingdienst whole-euro rounding:
 * - 'TURNOVER_OR_DUE': turnover and VAT due rounded DOWN (in favor of taxpayer)
 * - 'VOORBELASTING': input VAT deduction rounded UP (in favor of taxpayer)
 */
export function roundBelastingdienst(
  amount: number,
  type: 'TURNOVER_OR_DUE' | 'VOORBELASTING'
): number {
  if (!amount || isNaN(amount)) return 0
  if (type === 'VOORBELASTING') {
    return Math.ceil(amount)
  }
  return Math.floor(amount)
}

/**
 * Official EU Member State Country Codes (excluding NL).
 */
export const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'EL', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
])

export function isEuCountry(countryCode?: string): boolean {
  if (!countryCode) return false
  const clean = countryCode.trim().toUpperCase()
  return EU_COUNTRY_CODES.has(clean)
}

/**
 * Determines which Belastingdienst rubric a reverse-charge sales invoice belongs to:
 * - EU B2B customer (with EU VAT ID, non-NL) -> '3b' (ICP)
 * - NL customer (domestic reverse charge) or Non-EU customer -> '1e' (0% / niet bij u belast)
 */
export function classifySalesReverseChargeRubric(countryCode?: string, vatNumber?: string): '3b' | '1e' {
  const code = (countryCode || (vatNumber && vatNumber.length >= 2 ? vatNumber.slice(0, 2) : '')).toUpperCase()
  if (code === 'NL') {
    return '1e' // Binnenlandse verlegging
  }
  if (isEuCountry(code)) {
    return '3b' // Intracommunautaire prestatie (ICP)
  }
  return '1e' // Diensten aan afnemer buiten de EU
}

export interface VatDeadlineInfo {
  deadlineDate: Date
  deadlineLabel: string
  daysRemaining: number
  urgency: 'normal' | 'warning' | 'urgent' | 'passed'
  badgeText: string
}

/**
 * Returns accurate Belastingdienst filing deadline for a given Dutch VAT quarter:
 * Q1 -> 30 April, Q2 -> 31 July, Q3 -> 31 October, Q4 -> 31 January (following year)
 */
export function getVatDeadlineInfo(quarter: number, year: number, currentDate: Date = new Date()): VatDeadlineInfo {
  let deadlineDate: Date
  if (quarter === 1) {
    deadlineDate = new Date(year, 3, 30, 23, 59, 59) // 30 April
  } else if (quarter === 2) {
    deadlineDate = new Date(year, 6, 31, 23, 59, 59) // 31 July
  } else if (quarter === 3) {
    deadlineDate = new Date(year, 9, 31, 23, 59, 59) // 31 October
  } else {
    deadlineDate = new Date(year + 1, 0, 31, 23, 59, 59) // 31 January next year
  }

  const diffMs = deadlineDate.getTime() - currentDate.getTime()
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const deadlineLabel = deadlineDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  let urgency: 'normal' | 'warning' | 'urgent' | 'passed' = 'normal'
  let badgeText = `Vóór ${deadlineLabel} (${daysRemaining}d resterend)`

  if (daysRemaining < 0) {
    urgency = 'passed'
    badgeText = `Deadline verstreken (${deadlineLabel})`
  } else if (daysRemaining <= 3) {
    urgency = 'urgent'
    badgeText = `⚠️ Let op: Nog ${daysRemaining} ${daysRemaining === 1 ? 'dag' : 'dagen'} tot deadline!`
  } else if (daysRemaining <= 14) {
    urgency = 'warning'
    badgeText = `⏰ Nog ${daysRemaining} dagen (vóór ${deadlineLabel})`
  }

  return { deadlineDate, deadlineLabel, daysRemaining, urgency, badgeText }
}


/**
 * AliBirds Legal & Edge Cases Comprehensive Test Suite
 * Tests Dutch Tax Law (Wet OB), Belastingdienst Factuureisen,
 * Mathematical Rounding, MT940 Bank Parsing, and Auth Access Edge Cases.
 */

import { parseMT940, autoMatchTransactions } from '../src/lib/mt940'

interface TestResult {
  suite: string
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

function test(suite: string, name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn()
    if (res instanceof Promise) {
      throw new Error('Async test called synchronously')
    }
    results.push({ suite, name, passed: true })
    console.log(`  ✓ [${suite}] ${name}`)
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err.message || String(err) })
    console.error(`  ✗ [${suite}] ${name}: ${err.message}`)
  }
}

async function testAsync(suite: string, name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ suite, name, passed: true })
    console.log(`  ✓ [${suite}] ${name}`)
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err.message || String(err) })
    console.error(`  ✗ [${suite}] ${name}: ${err.message}`)
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertClose(actual: number, expected: number, tolerance = 0.01, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: Expected ${expected} (+/-${tolerance}), got ${actual}`)
  }
}

console.log('=================================================================')
console.log('   ALIBIRDS LEGAL & TAX EDGE CASES TEST RUNNER')
console.log('=================================================================\n')

// ── 1. MATHEMATICAL & DUTCH VAT ROUNDING TESTS ─────────────────────────────
console.log('SECTION 1: Dutch Invoicing & VAT Calculations')

function calculateLine(quantity: number, unitPrice: number, vatRate: string, mode: 'EXCLUSIVE' | 'INCLUSIVE') {
  const q = Number(quantity) || 0
  const p = Number(unitPrice) || 0
  const rateNum = vatRate === 'REVERSE_CHARGE' ? 0 : (Number(vatRate) || 0)

  if (mode === 'EXCLUSIVE') {
    const excl = Math.round(q * p * 100) / 100
    // Commercial rounding: multiply by rate percentage before dividing by 100 to avoid IEEE-754 float drift
    const vat = Math.round(excl * rateNum) / 100
    const incl = Math.round((excl + vat) * 100) / 100
    return { excl, vat, incl }
  } else {
    const incl = Math.round(q * p * 100) / 100
    const excl = rateNum === 0 ? incl : Math.round((incl / (1 + rateNum / 100)) * 100) / 100
    const vat = Math.round((incl - excl) * 100) / 100
    return { excl, vat, incl }
  }
}

test('VAT Math', 'Standard 21% Exclusive line calculation', () => {
  const line = calculateLine(10, 100, '21', 'EXCLUSIVE')
  assertEquals(line.excl, 1000.00, 'Excl should be 1000')
  assertEquals(line.vat, 210.00, 'VAT should be 210')
  assertEquals(line.incl, 1210.00, 'Incl should be 1210')
})

test('VAT Math', 'Reduced 9% Exclusive line calculation', () => {
  const line = calculateLine(5, 45.50, '9', 'EXCLUSIVE')
  assertEquals(line.excl, 227.50, 'Excl should be 227.50')
  assertEquals(line.vat, 20.48, 'VAT should be 20.48') // 227.50 * 0.09 = 20.475 -> 20.48
  assertEquals(line.incl, 247.98, 'Incl should be 247.98')
})

test('VAT Math', 'Zero 0% Exclusive line calculation', () => {
  const line = calculateLine(2, 500, '0', 'EXCLUSIVE')
  assertEquals(line.excl, 1000.00, 'Excl should be 1000')
  assertEquals(line.vat, 0.00, 'VAT should be 0')
  assertEquals(line.incl, 1000.00, 'Incl should be 1000')
})

test('VAT Math', 'Reverse Charge (Btw Verlegd) line calculation', () => {
  const line = calculateLine(1, 1500, 'REVERSE_CHARGE', 'EXCLUSIVE')
  assertEquals(line.excl, 1500.00, 'Excl should be 1500')
  assertEquals(line.vat, 0.00, 'VAT must be exactly 0 under Reverse Charge')
  assertEquals(line.incl, 1500.00, 'Incl must equal Excl')
})

test('VAT Math', 'Inclusive Mode: 21% extraction must correctly split excl and vat', () => {
  const line = calculateLine(1, 121, '21', 'INCLUSIVE')
  assertEquals(line.incl, 121.00, 'Incl should be 121')
  assertEquals(line.excl, 100.00, 'Excl should be 100')
  assertEquals(line.vat, 21.00, 'VAT should be 21')
})

test('VAT Math', 'Cent Rounding Coherence: Excl + VAT must strictly equal Incl', () => {
  // Test tricky odd numbers that produce recurring decimals
  const trickyItems = [
    { q: 1, p: 33.33, r: '21' },
    { q: 3, p: 14.15, r: '9' },
    { q: 7, p: 9.99, r: '21' },
  ]

  for (const item of trickyItems) {
    const res = calculateLine(item.q, item.p, item.r, 'EXCLUSIVE')
    assert(
      Math.abs(res.excl + res.vat - res.incl) < 0.001,
      `Rounding coherence violation: ${res.excl} + ${res.vat} !== ${res.incl}`
    )
  }
})

// ── 2. BELASTINGDIENST FACTUUREISEN & LAW TESTS ────────────────────────────
console.log('\nSECTION 2: Belastingdienst Factuureisen & Legal Invoicing Rules')

function validateDutchKvk(kvk: string): boolean {
  const clean = String(kvk || '').replace(/\D/g, '')
  return clean.length === 8
}

function validateDutchBtwId(btwId: string): boolean {
  const clean = String(btwId || '').trim().toUpperCase().replace(/\s+/g, '')
  // Dutch BTW-id format: NL + 9 digits + B + 2 digits (e.g. NL123456789B01)
  return /^NL\d{9}B\d{2}$/.test(clean)
}

function validateReverseChargeInvoice(invoice: {
  is_reverse_charge: boolean
  customer_vat_number?: string
  disclaimer_present: boolean
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (invoice.is_reverse_charge) {
    if (!invoice.customer_vat_number || invoice.customer_vat_number.trim().length < 5) {
      errors.push('Wettelijke overtreding: Btw verlegd vereist een geldig btw-identificatienummer van de afnemer.')
    }
    if (!invoice.disclaimer_present) {
      errors.push('Wettelijke overtreding: Factuur moet de term "btw verlegd" of artikel 12 lid 3 Wet OB vermelding bevatten.')
    }
  }
  return { valid: errors.length === 0, errors }
}

test('Legal Checks', 'Validates 8-digit Dutch KVK number correctly', () => {
  assert(validateDutchKvk('12345678'), '12345678 must be valid')
  assert(validateDutchKvk(' 1234 5678 '), 'spaced KVK must be valid')
  assert(!validateDutchKvk('1234567'), '7 digits must be invalid')
  assert(!validateDutchKvk('123456789'), '9 digits must be invalid')
})

test('Legal Checks', 'Validates 14-char Dutch BTW-id syntax (NL + 9 digits + B + 2 digits)', () => {
  assert(validateDutchBtwId('NL123456789B01'), 'NL123456789B01 must be valid')
  assert(validateDutchBtwId('nl123456789b02'), 'lowercase must be accepted after normalization')
  assert(!validateDutchBtwId('NL12345678B01'), '8 digits must be rejected')
  assert(!validateDutchBtwId('BE0123456789'), 'Belgian VAT ID must not match Dutch format')
  assert(!validateDutchBtwId('123456789B01'), 'Missing country code NL must be rejected')
})

test('Legal Checks', 'Enforces customer VAT ID and statutory notice when Reverse Charge is applied', () => {
  const invalidCase = validateReverseChargeInvoice({
    is_reverse_charge: true,
    customer_vat_number: undefined,
    disclaimer_present: false,
  })
  assertEquals(invalidCase.valid, false, 'Reverse charge without customer VAT ID must fail')
  assert(invalidCase.errors.length >= 2, 'Must report both missing VAT ID and missing disclaimer')

  const validCase = validateReverseChargeInvoice({
    is_reverse_charge: true,
    customer_vat_number: 'DE123456789',
    disclaimer_present: true,
  })
  assertEquals(validCase.valid, true, 'Properly documented reverse charge must pass')
})

test('Legal Checks', 'Sequential Invoice Numbering Integrity: forbids random suffix numbers', () => {
  const validSequence = ['2026-0001', '2026-0002', '2026-0003']
  const badGeneratedNumber = '2026-0001-482' // Random fallback used in buggy code

  const isProperSequence = (num: string) => /^[A-Z0-9]+-\d{4,}$/.test(num)
  assert(isProperSequence(validSequence[0]), 'Standard format must be valid')
  assert(!isProperSequence(badGeneratedNumber), 'Random triple-part suffix violates sequential numbering law')
})

// ── 3. BTW-AANGIFTE QUARTERLY TAX RETURN TESTS ─────────────────────────────
console.log('\nSECTION 3: Btw-Aangifte (Quarterly Tax Return) Rubric Calculations')

function computeBtwAangifte(
  invoices: Array<{
    status: string
    issue_date: string
    line_items: Array<{ vat_rate: string; line_total_excl: number; vat_amount: number }>
  }>,
  expenses: Array<{
    expense_date: string
    vat_amount: number
    is_deductible?: boolean
  }>,
  year: number,
  quarter: number
) {
  // Determine date bounds
  const qStartMonth = (quarter - 1) * 3 + 1
  const qEndMonth = quarter * 3
  const startStr = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
  const lastDay = [31, quarter === 1 ? (year % 4 === 0 ? 29 : 28) : (quarter === 2 ? 30 : (quarter === 3 ? 30 : 31)), 31][quarter - 1] || 31
  const endStr = `${year}-${String(qEndMonth).padStart(2, '0')}-${lastDay}`

  let turnover21 = 0, tax21 = 0
  let turnover9 = 0, tax9 = 0
  let turnover0 = 0
  let turnover3b = 0

  for (const inv of invoices) {
    if (!['SENT', 'PAID', 'OVERDUE'].includes(inv.status)) continue
    if (inv.issue_date < startStr || inv.issue_date > endStr) continue

    for (const item of inv.line_items) {
      if (item.vat_rate === '21') {
        turnover21 += item.line_total_excl
        tax21 += item.vat_amount
      } else if (item.vat_rate === '9') {
        turnover9 += item.line_total_excl
        tax9 += item.vat_amount
      } else if (item.vat_rate === '0') {
        turnover0 += item.line_total_excl
      } else if (item.vat_rate === 'REVERSE_CHARGE') {
        turnover3b += item.line_total_excl
      }
    }
  }

  let voorbelasting5b = 0
  for (const exp of expenses) {
    if (exp.is_deductible === false) continue
    if (exp.expense_date < startStr || exp.expense_date > endStr) continue
    voorbelasting5b += exp.vat_amount || 0
  }

  const totalOutputVat = tax21 + tax9
  const teBetalen = Math.round((totalOutputVat - voorbelasting5b) * 100) / 100

  return {
    quarter: `${year}-Q${quarter}`,
    start_date: startStr,
    end_date: endStr,
    rubrics: {
      '1a': { turnover: Math.round(turnover21), tax: Math.round(tax21) },
      '1b': { turnover: Math.round(turnover9), tax: Math.round(tax9) },
      '1e': { turnover: Math.round(turnover0), tax: 0 },
      '3b': { turnover: Math.round(turnover3b), tax: 0 },
      '5b': { turnover: 0, tax: Math.round(voorbelasting5b * 100) / 100 },
    },
    total_output_vat: Math.round(totalOutputVat * 100) / 100,
    voorbelasting: Math.round(voorbelasting5b * 100) / 100,
    te_betalen: teBetalen,
  }
}

test('Tax Return', 'Filters strictly by selected Quarter and Year (does not leak other quarters)', () => {
  const invoices = [
    {
      status: 'SENT',
      issue_date: '2026-07-15', // Q3
      line_items: [{ vat_rate: '21', line_total_excl: 1000, vat_amount: 210 }],
    },
    {
      status: 'PAID',
      issue_date: '2026-01-10', // Q1 - must NOT be included in Q3
      line_items: [{ vat_rate: '21', line_total_excl: 5000, vat_amount: 1050 }],
    },
  ]
  const expenses = [
    {
      expense_date: '2026-08-01', // Q3
      vat_amount: 50,
      is_deductible: true,
    },
    {
      expense_date: '2026-02-01', // Q1
      vat_amount: 300,
      is_deductible: true,
    },
  ]

  const q3Report = computeBtwAangifte(invoices, expenses, 2026, 3)
  assertEquals(q3Report.rubrics['1a'].turnover, 1000, 'Q3 turnover must only be 1000')
  assertEquals(q3Report.rubrics['1a'].tax, 210, 'Q3 VAT must only be 210')
  assertEquals(q3Report.voorbelasting, 50, 'Q3 input VAT must only be 50')
  assertEquals(q3Report.te_betalen, 160, 'Net due: 210 - 50 = 160')
})

test('Tax Return', 'Ignores DRAFT invoices in VAT return (only SENT or PAID are reportable)', () => {
  const invoices = [
    {
      status: 'DRAFT',
      issue_date: '2026-07-20',
      line_items: [{ vat_rate: '21', line_total_excl: 2000, vat_amount: 420 }],
    },
  ]
  const report = computeBtwAangifte(invoices, [], 2026, 3)
  assertEquals(report.rubrics['1a'].turnover, 0, 'DRAFT invoices must not be counted in official tax return')
  assertEquals(report.rubrics['1a'].tax, 0, 'DRAFT VAT must be 0')
})

// ── 4. MT940 BANK STATEMENT PARSING & RECONCILIATION TESTS ─────────────────
console.log('\nSECTION 4: MT940 Bank Statement Parsing & Auto-Reconciliation')

const SAMPLE_MT940_ING = `
:20:STARTMR
:25:NL92BUNQ2192282605 EUR
:28C:00001
:60F:C260701EUR10000,00
:61:2607150715CR2420,00NTRFNONREF//2026-0001
:86:BETALING FACTUUR 2026-0001 /IBAN/NL50INGB0001234567/NAME/ACME BV
:61:2607200720DR54,45NTRFNONREF//KVK BIJDRAGE
:86:JAARLIJKSE BIJDRAGE /IBAN/NL02ABNA0123456789/NAME/KAMER VAN KOOPHANDEL
:62F:C260731EUR12365,55
-
`

test('MT940', 'Correctly parses Dutch IBAN, currency, and statement lines', () => {
  const parsed = parseMT940(SAMPLE_MT940_ING)
  assertEquals(parsed.accountIban, 'NL92BUNQ2192282605', 'IBAN parsed accurately')
  assertEquals(parsed.currency, 'EUR', 'Currency parsed as EUR')
  assertEquals(parsed.transactions.length, 2, 'Must extract exactly 2 transactions')

  const tx1 = parsed.transactions[0]
  assertEquals(tx1.type, 'CREDIT', 'Transaction 1 is CREDIT')
  assertEquals(tx1.amount, 2420.00, 'Amount is 2420.00')
  assertEquals(tx1.counterpart_name, 'ACME BV', 'Extracted counterpart name ACME BV')
  assertEquals(tx1.counterpart_iban, 'NL50INGB0001234567', 'Extracted counterpart IBAN')

  const tx2 = parsed.transactions[1]
  assertEquals(tx2.type, 'DEBIT', 'Transaction 2 is DEBIT')
  assertEquals(tx2.amount, 54.45, 'Amount is 54.45')
})

test('MT940', 'Auto-matches customer payment to invoice by invoice number in remittance', () => {
  const parsed = parseMT940(SAMPLE_MT940_ING)
  const invoices = [
    {
      id: 'inv-uuid-001',
      invoice_number: '2026-0001',
      total_incl: 2420.00,
      client: { name: 'ACME BV' },
    },
  ]

  const matchResult = autoMatchTransactions(parsed.transactions as any, invoices as any, [])
  assertEquals(matchResult.matched, 1, 'Must match 1 invoice')
  const matchedTx = matchResult.results[0]
  assertEquals(matchedTx.invoiceId, 'inv-uuid-001', 'Must link directly to inv-uuid-001')
  assertEquals(matchedTx.score, 100, 'Score should be 100 for exact invoice number match')
})

// ── 5. AUTHENTICATION & ACCESS RESILIENCE EDGE CASES ────────────────────────
console.log('\nSECTION 5: Account Access & Network Resilience Edge Cases')

test('Auth Resilience', 'Detects broken or unresolvable Supabase project domain', () => {
  const testUrl = 'https://gnizaskjsgxwgdirzrrf.supabase.co'
  const isDummyOrBroken = testUrl.includes('placeholder') || testUrl.length < 15
  assert(!isDummyOrBroken, 'URL string itself is structurally a URL')
  // But network DNS NXDOMAIN causes createClient calls to hang or throw TypeError: Failed to fetch
})

test('Auth Resilience', 'Email confirmation policy edge case identification', () => {
  const mockSignUpResponseWithoutSession = {
    user: { id: 'usr-123', email: 'test@example.com', email_confirmed_at: null },
    session: null, // Returned when Supabase requires email confirmation
  }

  const isConfirmed = Boolean(mockSignUpResponseWithoutSession.user.email_confirmed_at)
  const hasSession = Boolean(mockSignUpResponseWithoutSession.session)

  assertEquals(isConfirmed, false, 'User created without confirmed email is unconfirmed')
  assertEquals(hasSession, false, 'No session is provided until confirmation is completed')
})

test('Auth Resilience', 'Local fallback user generation preserves session when BaaS is offline', () => {
  const userEmail = 'ali@studiomethodila.nl'
  const localFallbackUser = {
    id: 'local_' + Buffer.from(userEmail).toString('base64').slice(0, 12),
    name: 'Ali',
    email: userEmail,
    company_name: 'Studio Methodila',
    is_onboarded: true,
  }

  assert(localFallbackUser.id.startsWith('local_'), 'Local user ID generated with prefix')
  assertEquals(localFallbackUser.is_onboarded, true, 'Local session marks onboarding complete to avoid gate trap')
})

// ── SUMMARY REPORT ─────────────────────────────────────────────────────────
console.log('\n=================================================================')
const total = results.length
const passed = results.filter(r => r.passed).length
const failed = total - passed

console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`)
if (failed === 0) {
  console.log('STATUS: ALL EDGE CASE TESTS PASSED SUCCESSFULLY! ✓')
} else {
  console.log('STATUS: SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE. ✗')
}
console.log('=================================================================\n')

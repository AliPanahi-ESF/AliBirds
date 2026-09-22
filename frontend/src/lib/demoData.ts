import {
  Invoice, Client, Expense, BankTransaction, BusinessSettings,
  DashboardKPIs, BtwAangifte, LineItem, CalcMode, VATRate, RecurringSchedule,
  Quotation
} from './types'

const STORAGE_KEYS = {
  INVOICES: 'alibirds_invoices',
  CLIENTS: 'alibirds_clients',
  EXPENSES: 'alibirds_expenses',
  BANK: 'alibirds_bank',
  SETTINGS: 'alibirds_settings',
  RECURRING: 'alibirds_recurring',
  QUOTATIONS: 'alibirds_quotations',
}

export const INITIAL_SETTINGS: BusinessSettings = {
  id: 'settings-1',
  company_name: 'Ali Creative Studio',
  trade_name: 'AliBirds Design & Code',
  kvk_number: '84920182',
  btw_id: 'NL849201820B01',
  iban: 'NL91BUNQ2049182741',
  bic: 'BUNQNL2A',
  address_street: 'Keizersgracht 421',
  address_city: 'Amsterdam',
  address_postcode: '1016 EK',
  address_country: 'NL',
  phone: '+31 (0)20 894 1234',
  email: 'facturen@alibirds-studio.nl',
  website: 'https://alibirds.netlify.app',
  default_payment_term_days: 14,
  invoice_prefix: '2026-',
  next_invoice_sequence: 5,
  invoice_notes_default: 'Graag betalen binnen 14 dagen o.v.v. het factuurnummer.',
  accent_color: '#4f46e5',
  font_family: 'Inter',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'client-1',
    name: 'Studio Van Dijk B.V.',
    contact_person: 'Martijn van Dijk',
    email: 'administratie@studiovandijk.nl',
    phone: '+31 6 12345678',
    vat_number: 'NL851234567B01',
    kvk_number: '71234567',
    billing_address_street: 'Herengracht 182',
    billing_address_city: 'Amsterdam',
    billing_address_postcode: '1016 BR',
    country_code: 'NL',
    default_payment_term_days: 14,
    notes: 'Vaste klant voor UI/UX ontwerpen',
    is_active: true,
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z',
  },
  {
    id: 'client-2',
    name: 'Berlin Tech Labs GmbH',
    contact_person: 'Klaus Schmidt',
    email: 'billing@berlintechlabs.de',
    phone: '+49 30 98765432',
    vat_number: 'DE318928312',
    kvk_number: 'HRB 198274',
    billing_address_street: 'Friedrichstraße 45',
    billing_address_city: 'Berlin',
    billing_address_postcode: '10117',
    country_code: 'DE',
    default_payment_term_days: 30,
    notes: 'EU B2B klant — Btw verlegd (Art. 194)',
    is_active: true,
    created_at: '2026-02-01T12:00:00Z',
    updated_at: '2026-02-01T12:00:00Z',
  },
  {
    id: 'client-3',
    name: 'Noord Media & Design',
    contact_person: 'Sanne Bakker',
    email: 'facturatie@noordmedia.nl',
    phone: '+31 6 87654321',
    vat_number: 'NL829384756B02',
    kvk_number: '69283741',
    billing_address_street: 'Grote Markt 12',
    billing_address_city: 'Groningen',
    billing_address_postcode: '9712 HN',
    country_code: 'NL',
    default_payment_term_days: 14,
    notes: 'Kwartaal branding updates',
    is_active: true,
    created_at: '2026-03-05T09:00:00Z',
    updated_at: '2026-03-05T09:00:00Z',
  },
]

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoice_number: '2026-0001',
    client_id: 'client-1',
    client: INITIAL_CLIENTS[0],
    issue_date: '2026-09-01',
    delivery_date: '2026-08-31',
    due_date: '2026-09-15',
    status: 'SENT',
    calculation_mode: 'EXCLUSIVE',
    subtotal_excl_vat: 2450.00,
    total_vat_amount: 514.50,
    total_incl_vat: 2964.50,
    amount_paid: 0.00,
    payment_reference: 'RF82 2026 0001',
    notes: 'Bedankt voor de fijne samenwerking.',
    line_items: [
      {
        id: 'item-1-1',
        description: 'Design System & Figma Component Library',
        quantity: 28,
        unit_price: 75.00,
        vat_rate: '21',
        vat_amount: 441.00,
        line_total_excl: 2100.00,
        line_total_incl: 2541.00,
        sort_order: 1,
      },
      {
        id: 'item-1-2',
        description: 'Design Sprint Workshop (halve dag)',
        quantity: 1,
        unit_price: 350.00,
        vat_rate: '21',
        vat_amount: 73.50,
        line_total_excl: 350.00,
        line_total_incl: 423.50,
        sort_order: 2,
      },
    ],
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'inv-2',
    invoice_number: '2026-0002',
    client_id: 'client-2',
    client: INITIAL_CLIENTS[1],
    issue_date: '2026-09-05',
    delivery_date: '2026-09-04',
    due_date: '2026-10-05',
    status: 'PAID',
    calculation_mode: 'EXCLUSIVE',
    subtotal_excl_vat: 3800.00,
    total_vat_amount: 0.00,
    total_incl_vat: 3800.00,
    amount_paid: 3800.00,
    payment_reference: 'RF14 2026 0002',
    notes: 'Btw verlegd / Reverse charge (Richtlijn 2006/112/EG art. 194).',
    paid_at: '2026-09-18T14:30:00Z',
    line_items: [
      {
        id: 'item-2-1',
        description: 'Cloud Architecture Consultancy & API Integration',
        quantity: 40,
        unit_price: 95.00,
        vat_rate: 'REVERSE_CHARGE',
        vat_amount: 0.00,
        line_total_excl: 3800.00,
        line_total_incl: 3800.00,
        sort_order: 1,
      },
    ],
    created_at: '2026-09-05T09:00:00Z',
    updated_at: '2026-09-18T14:30:00Z',
  },
  {
    id: 'inv-3',
    invoice_number: '2026-0003',
    client_id: 'client-3',
    client: INITIAL_CLIENTS[2],
    issue_date: '2026-08-10',
    delivery_date: '2026-08-08',
    due_date: '2026-08-24',
    status: 'OVERDUE',
    calculation_mode: 'EXCLUSIVE',
    subtotal_excl_vat: 1200.00,
    total_vat_amount: 252.00,
    total_incl_vat: 1452.00,
    amount_paid: 0.00,
    payment_reference: 'RF59 2026 0003',
    notes: 'Vriendelijke herinnering: betalingstermijn is verstreken.',
    line_items: [
      {
        id: 'item-3-1',
        description: 'Website herontwerp & animaties',
        quantity: 16,
        unit_price: 75.00,
        vat_rate: '21',
        vat_amount: 252.00,
        line_total_excl: 1200.00,
        line_total_incl: 1452.00,
        sort_order: 1,
      },
    ],
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-25T10:00:00Z',
  },
  {
    id: 'inv-4',
    invoice_number: '2026-0004',
    client_id: 'client-1',
    client: INITIAL_CLIENTS[0],
    issue_date: '2026-09-20',
    due_date: '2026-10-04',
    status: 'DRAFT',
    calculation_mode: 'EXCLUSIVE',
    subtotal_excl_vat: 850.00,
    total_vat_amount: 178.50,
    total_incl_vat: 1028.50,
    amount_paid: 0.00,
    notes: 'Concept factuur voor sprint 3.',
    line_items: [
      {
        id: 'item-4-1',
        description: 'Onderhoud & bugfixes',
        quantity: 10,
        unit_price: 85.00,
        vat_rate: '21',
        vat_amount: 178.50,
        line_total_excl: 850.00,
        line_total_incl: 1028.50,
        sort_order: 1,
      },
    ],
    created_at: '2026-09-20T11:00:00Z',
    updated_at: '2026-09-20T11:00:00Z',
  },
]

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    vendor_name: 'Adobe Creative Cloud',
    expense_date: '2026-09-02',
    category: 'SOFTWARE',
    amount_excl_vat: 65.99,
    vat_rate: '21',
    vat_amount: 13.86,
    amount_incl_vat: 79.85,
    description: 'Maandelijks abonnement All Apps',
    created_at: '2026-09-02T10:00:00Z',
    updated_at: '2026-09-02T10:00:00Z',
  },
  {
    id: 'exp-2',
    vendor_name: 'Apple Store Amsterdam',
    expense_date: '2026-09-08',
    category: 'HARDWARE',
    amount_excl_vat: 120.00,
    vat_rate: '21',
    vat_amount: 25.20,
    amount_incl_vat: 145.20,
    description: 'Verstelbare laptopstandaard & USB-C adapter',
    created_at: '2026-09-08T15:00:00Z',
    updated_at: '2026-09-08T15:00:00Z',
  },
  {
    id: 'exp-3',
    vendor_name: 'NS Reizigers',
    expense_date: '2026-09-12',
    category: 'TRAVEL',
    amount_excl_vat: 32.11,
    vat_rate: '9',
    vat_amount: 2.89,
    amount_incl_vat: 35.00,
    description: 'Treinreis klantbezoek Groningen',
    created_at: '2026-09-12T18:00:00Z',
    updated_at: '2026-09-12T18:00:00Z',
  },
  {
    id: 'exp-4',
    vendor_name: 'Google Workspace',
    expense_date: '2026-09-15',
    category: 'SOFTWARE',
    amount_excl_vat: 18.00,
    vat_rate: '21',
    vat_amount: 3.78,
    amount_incl_vat: 21.78,
    description: 'Bedrijfs e-mail & cloudopslag',
    created_at: '2026-09-15T09:00:00Z',
    updated_at: '2026-09-15T09:00:00Z',
  },
]

export const INITIAL_BANK: BankTransaction[] = [
  {
    id: 'bank-1',
    transaction_date: '2026-09-18',
    amount: 3800.00,
    currency: 'EUR',
    type: 'CREDIT',
    counterpart_name: 'Berlin Tech Labs GmbH',
    counterpart_iban: 'DE89370400440532013000',
    remittance_reference: 'RF14 2026 0002 / FACTUUR 2026-0002',
    reconciliation_status: 'MATCHED',
    matched_invoice_id: 'inv-2',
    imported_at: '2026-09-19T06:00:00Z',
  },
  {
    id: 'bank-2',
    transaction_date: '2026-09-15',
    amount: 79.85,
    currency: 'EUR',
    type: 'DEBIT',
    counterpart_name: 'Adobe Systems Direct',
    counterpart_iban: 'IE29AIBK93115212345678',
    remittance_reference: 'INV-ADOBE-93821094',
    reconciliation_status: 'MATCHED',
    imported_at: '2026-09-16T06:00:00Z',
  },
  {
    id: 'bank-3',
    transaction_date: '2026-09-10',
    amount: 1452.00,
    currency: 'EUR',
    type: 'CREDIT',
    counterpart_name: 'Noord Media & Design',
    counterpart_iban: 'NL44INGB0002938475',
    remittance_reference: 'Factuurnr 2026-0003 betaling',
    reconciliation_status: 'PENDING_CONFIRMATION',
    matched_invoice_id: 'inv-3',
    imported_at: '2026-09-11T06:00:00Z',
  },
]

export const INITIAL_RECURRING: RecurringSchedule[] = [
  {
    id: 'rec-1',
    name: 'Maandelijks onderhoud & hosting',
    client_id: 'client-1',
    frequency: 'MONTHLY',
    start_date: '2026-01-01',
    next_run_date: '2026-10-01',
    payment_term_days: 14,
    auto_send_email: false,
    is_active: true,
    notes_template: 'Maandelijkse vaste vergoeding voor softwareonderhoud en hosting.',
    line_items_template: [
      { description: 'Onderhoud, updates & SLA support', quantity: 1, unit_price: 350.00, vat_rate: '21' },
      { description: 'Cloud hosting & back-up faciliteiten', quantity: 1, unit_price: 49.00, vat_rate: '21' },
    ],
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
  },
]

// ── Local Storage Helper ───────────────────────────────────────────────────

function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback))
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save to localStorage', e)
  }
}

// ── Demo Store API ────────────────────────────────────────────────────────

export const demoStore = {
  getSettings: (): BusinessSettings => getStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS),
  saveSettings: (data: Partial<BusinessSettings>): BusinessSettings => {
    const current = demoStore.getSettings()
    const updated = { ...current, ...data, updated_at: new Date().toISOString() }
    setStored(STORAGE_KEYS.SETTINGS, updated)
    return updated
  },

  getClients: (): Client[] => getStored(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS),
  saveClient: (client: Partial<Client>): Client => {
    const list = demoStore.getClients()
    if (client.id) {
      const idx = list.findIndex(c => c.id === client.id)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...client, updated_at: new Date().toISOString() }
        setStored(STORAGE_KEYS.CLIENTS, list)
        return list[idx]
      }
    }
    const newClient: Client = {
      id: `client-${Date.now()}`,
      name: client.name || 'Nieuwe Klant',
      contact_person: client.contact_person || '',
      email: client.email || '',
      phone: client.phone || '',
      vat_number: client.vat_number || '',
      kvk_number: client.kvk_number || '',
      billing_address_street: client.billing_address_street || '',
      billing_address_city: client.billing_address_city || '',
      billing_address_postcode: client.billing_address_postcode || '',
      country_code: client.country_code || 'NL',
      default_payment_term_days: client.default_payment_term_days || 14,
      notes: client.notes || '',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    list.push(newClient)
    setStored(STORAGE_KEYS.CLIENTS, list)
    return newClient
  },
  deleteClient: (id: string): void => {
    const list = demoStore.getClients().filter(c => c.id !== id)
    setStored(STORAGE_KEYS.CLIENTS, list)
  },

  getInvoices: (): Invoice[] => {
    const list = getStored(STORAGE_KEYS.INVOICES, INITIAL_INVOICES)
    const clients = demoStore.getClients()
    return list.map(inv => ({
      ...inv,
      client: clients.find(c => c.id === inv.client_id) || inv.client,
    }))
  },
  getInvoice: (id: string): Invoice | undefined => {
    return demoStore.getInvoices().find(i => i.id === id)
  },
  saveInvoice: (invoiceData: any): Invoice => {
    const list = demoStore.getInvoices()
    const clients = demoStore.getClients()
    const client = invoiceData.client || clients.find(c => c.id === invoiceData.client_id)

    // Recalculate totals
    const calc = demoStore.calculateVat({
      calculation_mode: invoiceData.calculation_mode || 'EXCLUSIVE',
      client_id: invoiceData.client_id,
      items: invoiceData.line_items || [],
    })

    const line_items: LineItem[] = calc.items.map((it: any, index: number) => ({
      id: it.id || `item-${Date.now()}-${index}`,
      description: it.description || '',
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      vat_rate: it.vat_rate || '21',
      vat_amount: Number(it.vat_amount) || 0,
      line_total_excl: Number(it.line_total_excl) || 0,
      line_total_incl: Number(it.line_total_incl) || 0,
      sort_order: index + 1,
    }))

    const subtotalExcl = Number(calc.subtotal_excl ?? invoiceData.subtotal_excl ?? invoiceData.subtotal_excl_vat ?? 0)
    const totalVat = Number(calc.total_vat ?? invoiceData.total_vat ?? invoiceData.total_vat_amount ?? 0)
    const totalIncl = Number(calc.total_incl ?? invoiceData.total_incl ?? invoiceData.total_incl_vat ?? (subtotalExcl + totalVat))

    if (invoiceData.id) {
      const idx = list.findIndex(i => i.id === invoiceData.id || i.invoice_number === invoiceData.invoice_number)
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...invoiceData,
          client: client || list[idx].client,
          line_items: line_items.length > 0 ? line_items : list[idx].line_items,
          subtotal_excl_vat: subtotalExcl,
          subtotal_excl: subtotalExcl,
          total_vat_amount: totalVat,
          total_vat: totalVat,
          total_incl_vat: totalIncl,
          total_incl: totalIncl,
          updated_at: new Date().toISOString(),
        }
        setStored(STORAGE_KEYS.INVOICES, list)
        return list[idx]
      }
    }

    const settings = demoStore.getSettings()
    const seq = settings.next_invoice_sequence || 1
    const invoiceNum = invoiceData.invoice_number || `${settings.invoice_prefix}${String(seq).padStart(4, '0')}`
    if (!invoiceData.invoice_number) {
      demoStore.saveSettings({ next_invoice_sequence: seq + 1 })
    }

    const newInv: Invoice = {
      id: invoiceData.id || `inv-${Date.now()}`,
      invoice_number: invoiceNum,
      client_id: invoiceData.client_id,
      client,
      issue_date: invoiceData.issue_date || new Date().toISOString().slice(0, 10),
      delivery_date: invoiceData.delivery_date,
      due_date: invoiceData.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: invoiceData.status || 'DRAFT',
      calculation_mode: invoiceData.calculation_mode || 'EXCLUSIVE',
      subtotal_excl_vat: subtotalExcl,
      subtotal_excl: subtotalExcl,
      total_vat_amount: totalVat,
      total_vat: totalVat,
      total_incl_vat: totalIncl,
      total_incl: totalIncl,
      amount_paid: Number(invoiceData.amount_paid || 0),
      payment_reference: invoiceData.payment_reference || `RF${Math.floor(10 + Math.random() * 89)} ${invoiceNum.replace('-', ' ')}`,
      notes: invoiceData.notes || settings.invoice_notes_default,
      line_items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    list.unshift(newInv)
    setStored(STORAGE_KEYS.INVOICES, list)
    return newInv
  },
  deleteInvoice: (id: string): void => {
    const list = demoStore.getInvoices().filter(i => i.id !== id)
    setStored(STORAGE_KEYS.INVOICES, list)
  },
  clearAllInvoices: (): void => {
    setStored(STORAGE_KEYS.INVOICES, [])
  },

  getExpenses: (): Expense[] => getStored(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES),
  saveExpense: (exp: any): Expense => {
    const list = demoStore.getExpenses()
    const excl = Number(exp.amount_excl_vat) || 0
    let vatRatePct = 0
    if (exp.vat_rate === '21') vatRatePct = 0.21
    else if (exp.vat_rate === '9') vatRatePct = 0.09
    const vatAmount = Math.round(excl * vatRatePct * 100) / 100
    const incl = Math.round((excl + vatAmount) * 100) / 100

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      vendor_name: exp.vendor_name || 'Leverancier',
      expense_date: exp.expense_date || new Date().toISOString().slice(0, 10),
      category: exp.category || 'OTHER',
      amount_excl_vat: excl,
      vat_rate: exp.vat_rate || '21',
      vat_amount: vatAmount,
      amount_incl_vat: incl,
      description: exp.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    list.unshift(newExp)
    setStored(STORAGE_KEYS.EXPENSES, list)
    return newExp
  },
  deleteExpense: (id: string): void => {
    const list = demoStore.getExpenses().filter(e => e.id !== id)
    setStored(STORAGE_KEYS.EXPENSES, list)
    const bankList = demoStore.getBankTransactions()
    let changed = false
    bankList.forEach(t => {
      if (t.matched_expense_id === id) {
        t.matched_expense_id = undefined
        t.reconciliation_status = 'UNMATCHED'
        changed = true
      }
    })
    if (changed) setStored(STORAGE_KEYS.BANK, bankList)
  },

  getBankTransactions: (): BankTransaction[] => getStored(STORAGE_KEYS.BANK, INITIAL_BANK),
  saveBankTransactions: (txs: any[]): void => {
    const list = demoStore.getBankTransactions()
    const normalized: BankTransaction[] = txs.map(t => {
      const isDebit = t.type === 'DEBIT' || t.transaction_type === 'DEBIT'
      const date = t.transaction_date || t.value_date || new Date().toISOString().slice(0, 10)
      const name = t.counterpart_name || t.contra_account_name || ''
      const iban = t.counterpart_iban || t.contra_account_iban || ''
      const ref = t.remittance_reference || t.raw_reference || t.description || ''

      return {
        id: t.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        transaction_date: date,
        value_date: date,
        type: isDebit ? 'DEBIT' : 'CREDIT',
        transaction_type: isDebit ? 'DEBIT' : 'CREDIT',
        amount: Number(t.amount),
        currency: t.currency || 'EUR',
        counterpart_name: name,
        contra_account_name: name,
        counterpart_iban: iban,
        contra_account_iban: iban,
        remittance_reference: ref,
        raw_reference: ref,
        description: t.description || ref,
        reconciliation_status: t.reconciliation_status || 'UNMATCHED',
        matched_invoice_id: t.matched_invoice_id,
        matched_expense_id: t.matched_expense_id,
        raw_hash: t.raw_hash,
        imported_at: t.imported_at || new Date().toISOString(),
      }
    })
    // Append or update by raw_hash or id
    const hashSet = new Set(list.map(t => t.raw_hash || t.id))
    const newItems = normalized.filter(t => !hashSet.has(t.raw_hash || t.id))
    const combined = [...newItems, ...list]
    setStored(STORAGE_KEYS.BANK, combined)
  },
  clearBankTransactions: (): void => {
    setStored(STORAGE_KEYS.BANK, [])
  },
  matchBankTransaction: (bankId: string, invoiceId: string): void => {
    const list = demoStore.getBankTransactions()
    const tx = list.find(t => t.id === bankId)
    if (tx) {
      tx.reconciliation_status = 'MATCHED'
      tx.matched_invoice_id = invoiceId
      tx.matched_expense_id = undefined
      setStored(STORAGE_KEYS.BANK, list)
    }
    const invoices = demoStore.getInvoices()
    const inv = invoices.find(i => i.id === invoiceId)
    if (inv) {
      inv.status = 'PAID'
      inv.paid_at = new Date().toISOString()
      inv.amount_paid = inv.total_incl_vat
      setStored(STORAGE_KEYS.INVOICES, invoices)
    }
  },
  matchBankTransactionToExpense: (bankId: string, expenseId: string): void => {
    const list = demoStore.getBankTransactions()
    const tx = list.find(t => t.id === bankId)
    if (tx) {
      tx.reconciliation_status = 'MATCHED'
      tx.matched_expense_id = expenseId
      tx.matched_invoice_id = undefined
      setStored(STORAGE_KEYS.BANK, list)
    }
  },
  unmatchBankTransaction: (bankId: string): void => {
    const list = demoStore.getBankTransactions()
    const tx = list.find(t => t.id === bankId)
    if (tx) {
      tx.reconciliation_status = 'UNMATCHED'
      tx.matched_invoice_id = undefined
      tx.matched_expense_id = undefined
      tx.match_score = undefined
      setStored(STORAGE_KEYS.BANK, list)
    }
  },

  // Dual-mode VAT calculation matching backend logic
  calculateVat: (data: { calculation_mode: CalcMode; client_id?: string; items: any[] }) => {
    const isInclusive = data.calculation_mode === 'INCLUSIVE'
    const clients = demoStore.getClients()
    const client = clients.find(c => c.id === data.client_id)
    const isEuReverse = client && client.country_code !== 'NL' && client.vat_number

    let subtotalExcl = 0
    let totalVat = 0
    let totalIncl = 0

    const computedItems = (data.items || []).map(item => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unit_price) || 0
      const rateStr: VATRate = isEuReverse ? 'REVERSE_CHARGE' : (item.vat_rate || '21')

      let vatPct = 0
      if (rateStr === '21') vatPct = 0.21
      else if (rateStr === '9') vatPct = 0.09
      else vatPct = 0.0

      let lineExcl = 0
      let lineVat = 0
      let lineIncl = 0

      if (isInclusive && vatPct > 0) {
        lineIncl = Math.round(qty * price * 100) / 100
        lineExcl = Math.round((lineIncl / (1 + vatPct)) * 100) / 100
        lineVat = Math.round((lineIncl - lineExcl) * 100) / 100
      } else {
        lineExcl = Math.round(qty * price * 100) / 100
        lineVat = Math.round(lineExcl * vatPct * 100) / 100
        lineIncl = Math.round((lineExcl + lineVat) * 100) / 100
      }

      subtotalExcl += lineExcl
      totalVat += lineVat
      totalIncl += lineIncl

      return {
        ...item,
        vat_rate: rateStr,
        line_total_excl: lineExcl,
        vat_amount: lineVat,
        line_total_incl: lineIncl,
      }
    })

    return {
      subtotal_excl: Math.round(subtotalExcl * 100) / 100,
      total_vat: Math.round(totalVat * 100) / 100,
      total_incl: Math.round(totalIncl * 100) / 100,
      items: computedItems,
    }
  },

  getKPIs: (): DashboardKPIs => {
    const invoices = demoStore.getInvoices()
    const expenses = demoStore.getExpenses()

    const outstanding = invoices
      .filter(i => i.status === 'SENT')
      .reduce((s, i) => s + (i.total_incl_vat - (i.amount_paid || 0)), 0)

    const overdue = invoices
      .filter(i => i.status === 'OVERDUE')
      .reduce((s, i) => s + (i.total_incl_vat - (i.amount_paid || 0)), 0)

    const vatLiability = invoices
      .filter(i => ['SENT', 'PAID'].includes(i.status))
      .reduce((s, i) => s + i.total_vat_amount, 0) -
      expenses.reduce((s, e) => s + e.vat_amount, 0)

    const paidThisMonth = invoices
      .filter(i => i.status === 'PAID')
      .reduce((s, i) => s + (i.amount_paid || i.total_incl_vat), 0)

    const expensesTotal = expenses.reduce((s, e) => s + e.amount_incl_vat, 0)

    return {
      outstanding_revenue: Math.round(outstanding * 100) / 100,
      overdue_amount: Math.round(overdue * 100) / 100,
      projected_vat_liability: Math.max(0, Math.round(vatLiability * 100) / 100),
      total_invoices_this_year: invoices.length,
      paid_this_month: Math.round(paidThisMonth * 100) / 100,
      expenses_this_quarter: Math.round(expensesTotal * 100) / 100,
    }
  },

  getBtwAangifte: (quarter = 'Q3', year = '2026'): BtwAangifte => {
    const invoices = demoStore.getInvoices()
    const expenses = demoStore.getExpenses()

    let t21 = 0, v21 = 0
    let t9 = 0, v9 = 0
    let t3b = 0

    for (const inv of invoices) {
      for (const item of inv.line_items) {
        if (item.vat_rate === '21') {
          t21 += item.line_total_excl
          v21 += item.vat_amount
        } else if (item.vat_rate === '9') {
          t9 += item.line_total_excl
          v9 += item.vat_amount
        } else if (item.vat_rate === 'REVERSE_CHARGE') {
          t3b += item.line_total_excl
        }
      }
    }

    const voorbelasting = Math.round(expenses.reduce((s, e) => s + e.vat_amount, 0) * 100) / 100
    const totalOutputTax = Math.round((v21 + v9) * 100) / 100
    const teBetalen = Math.round((totalOutputTax - voorbelasting) * 100) / 100

    return {
      quarter: `${year}-${quarter}`,
      start_date: '2026-07-01',
      end_date: '2026-09-30',
      rubrics: {
        '1a': { code: '1a', description: 'Leveringen/diensten belast met hoog tarief (21%)', turnover: Math.round(t21), tax: Math.round(v21) },
        '1b': { code: '1b', description: 'Leveringen/diensten belast met laag tarief (9%)', turnover: Math.round(t9), tax: Math.round(v9) },
        '1c': { code: '1c', description: 'Leveringen/diensten belast met overige tarieven behalve 0%', turnover: 0, tax: 0 },
        '3a': { code: '3a', description: 'Leveringen naar landen buiten de EU (uitvoer)', turnover: 0, tax: 0 },
        '3b': { code: '3b', description: 'Leveringen naar/diensten in landen binnen de EU', turnover: Math.round(t3b), tax: 0 },
        '5b': { code: '5b', description: 'Voorbelasting (btw op zakelijke kosten)', turnover: 0, tax: voorbelasting },
      },
      voorbelasting,
      te_betalen: teBetalen,
    }
  },

  // ── Recurring Schedules ──────────────────────────────────────────────────
  getRecurringSchedules: (): RecurringSchedule[] => {
    const list = getStored(STORAGE_KEYS.RECURRING, INITIAL_RECURRING)
    const clients = demoStore.getClients()
    return list.map(rec => ({
      ...rec,
      client: clients.find(c => c.id === rec.client_id),
    }))
  },

  saveRecurringSchedule: (scheduleData: Partial<RecurringSchedule>): RecurringSchedule => {
    const list = getStored(STORAGE_KEYS.RECURRING, INITIAL_RECURRING)
    const clients = demoStore.getClients()
    const client = clients.find(c => c.id === scheduleData.client_id)

    if (scheduleData.id) {
      const idx = list.findIndex(s => s.id === scheduleData.id)
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...scheduleData,
          client: client || list[idx].client,
          updated_at: new Date().toISOString(),
        } as RecurringSchedule
        setStored(STORAGE_KEYS.RECURRING, list)
        return list[idx]
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const newSchedule: RecurringSchedule = {
      id: `rec-${Date.now()}`,
      name: scheduleData.name || 'Herhaalschema',
      client_id: scheduleData.client_id || '',
      client,
      frequency: scheduleData.frequency || 'MONTHLY',
      start_date: scheduleData.start_date || today,
      next_run_date: scheduleData.next_run_date || today,
      payment_term_days: Number(scheduleData.payment_term_days) || 14,
      auto_send_email: Boolean(scheduleData.auto_send_email),
      is_active: scheduleData.is_active ?? true,
      notes_template: scheduleData.notes_template || '',
      calculation_mode: scheduleData.calculation_mode || 'EXCLUSIVE',
      line_items_template: scheduleData.line_items_template || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    list.unshift(newSchedule)
    setStored(STORAGE_KEYS.RECURRING, list)
    return newSchedule
  },

  deleteRecurringSchedule: (id: string): void => {
    const list = getStored(STORAGE_KEYS.RECURRING, INITIAL_RECURRING).filter(s => s.id !== id)
    setStored(STORAGE_KEYS.RECURRING, list)
  },

  triggerRecurringSchedule: (id: string): { success: boolean; invoice_number: string; invoice_id: string } => {
    const schedules = demoStore.getRecurringSchedules()
    const sched = schedules.find(s => s.id === id)
    if (!sched) throw new Error('Schema niet gevonden')

    const clients = demoStore.getClients()
    const client = clients.find(c => c.id === sched.client_id) || sched.client

    const today = new Date().toISOString().slice(0, 10)
    const termDays = sched.payment_term_days || 14
    const dueDate = new Date(Date.now() + termDays * 864e5).toISOString().slice(0, 10)

    const items = (sched.line_items_template && sched.line_items_template.length > 0)
      ? sched.line_items_template
      : [{ description: sched.name, quantity: 1, unit_price: 150, vat_rate: '21' }]

    // Generate a real invoice in the database / demoStore
    const createdInvoice = demoStore.saveInvoice({
      client_id: sched.client_id,
      client,
      issue_date: today,
      due_date: dueDate,
      calculation_mode: sched.calculation_mode || 'EXCLUSIVE',
      status: sched.auto_send_email ? 'SENT' : 'DRAFT',
      notes: sched.notes_template || `Gegenereerd uit herhaalschema "${sched.name}"`,
      line_items: items,
    })

    // Advance next_run_date
    const nextDate = new Date(sched.next_run_date || today)
    if (sched.frequency === 'WEEKLY') {
      nextDate.setDate(nextDate.getDate() + 7)
    } else if (sched.frequency === 'QUARTERLY') {
      nextDate.setMonth(nextDate.getMonth() + 3)
    } else if (sched.frequency === 'YEARLY') {
      nextDate.setFullYear(nextDate.getFullYear() + 1)
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1)
    }

    demoStore.saveRecurringSchedule({
      id: sched.id,
      next_run_date: nextDate.toISOString().slice(0, 10),
    })

    return {
      success: true,
      invoice_number: createdInvoice.invoice_number,
      invoice_id: createdInvoice.id,
    }
  },

  getQuotations: (): Quotation[] => {
    return getStored(STORAGE_KEYS.QUOTATIONS, INITIAL_QUOTATIONS)
  },
  getQuotation: (id: string): Quotation | undefined => {
    const list = demoStore.getQuotations()
    return list.find(q => q.id === id)
  },
  saveQuotation: (quoteData: Partial<Quotation>): Quotation => {
    const list = demoStore.getQuotations()
    const clients = demoStore.getClients()
    const client = clients.find(c => c.id === quoteData.client_id) || quoteData.client

    if (quoteData.id) {
      const idx = list.findIndex(q => q.id === quoteData.id)
      if (idx >= 0) {
        const updated: Quotation = {
          ...list[idx],
          ...quoteData,
          client: client || list[idx].client,
          updated_at: new Date().toISOString(),
        } as Quotation
        list[idx] = updated
        setStored(STORAGE_KEYS.QUOTATIONS, list)
        return updated
      }
    }

    const nextSeq = list.length + 1
    const pad = String(nextSeq).padStart(3, '0')
    const quoteNum = quoteData.quotation_number || `OFF-2026-${pad}`

    const newQuote: Quotation = {
      id: `quote-${Date.now()}`,
      quotation_number: quoteNum,
      client_id: quoteData.client_id || '',
      client,
      issue_date: quoteData.issue_date || new Date().toISOString().slice(0, 10),
      valid_until_date: quoteData.valid_until_date || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      status: quoteData.status || 'DRAFT',
      calculation_mode: quoteData.calculation_mode || 'EXCLUSIVE',
      subtotal_excl: Number(quoteData.subtotal_excl) || 0,
      total_vat: Number(quoteData.total_vat) || 0,
      total_amount: Number(quoteData.total_amount) || 0,
      notes: quoteData.notes || '',
      disclaimer: quoteData.disclaimer || 'Deze offerte is 30 dagen geldig na dagtekening. Na akkoord start het project binnen 2 weken.',
      line_items: quoteData.line_items || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...quoteData,
    } as Quotation

    list.unshift(newQuote)
    setStored(STORAGE_KEYS.QUOTATIONS, list)
    return newQuote
  },
  deleteQuotation: (id: string): void => {
    const list = demoStore.getQuotations()
    setStored(STORAGE_KEYS.QUOTATIONS, list.filter(q => q.id !== id))
  },
  signQuotationPublicly: (id: string, signatureDataUrl: string, signedByName: string): Quotation => {
    const list = demoStore.getQuotations()
    const quote = list.find(q => q.id === id)
    if (!quote) throw new Error('Offerte niet gevonden')
    quote.signature_data_url = signatureDataUrl
    quote.signed_by_name = signedByName
    quote.signed_at = new Date().toISOString()
    quote.status = 'ACCEPTED'
    quote.updated_at = new Date().toISOString()
    setStored(STORAGE_KEYS.QUOTATIONS, list)
    return quote
  },
  convertQuotationToInvoice: (id: string): { success: boolean; invoice_id: string; invoice_number: string } => {
    const list = demoStore.getQuotations()
    const quote = list.find(q => q.id === id)
    if (!quote) throw new Error('Offerte niet gevonden')

    const today = new Date().toISOString().slice(0, 10)
    const due14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)

    const newInvoice = demoStore.saveInvoice({
      client_id: quote.client_id,
      client: quote.client,
      issue_date: today,
      delivery_date: today,
      due_date: due14,
      calculation_mode: quote.calculation_mode || 'EXCLUSIVE',
      status: 'DRAFT',
      notes: `Gegenereerd uit geaccepteerde offerte ${quote.quotation_number}.\n${quote.notes || ''}`.trim(),
      line_items: quote.line_items,
    })

    quote.status = 'CONVERTED'
    quote.converted_invoice_id = newInvoice.id
    quote.updated_at = new Date().toISOString()
    setStored(STORAGE_KEYS.QUOTATIONS, list)

    return {
      success: true,
      invoice_id: newInvoice.id,
      invoice_number: newInvoice.invoice_number,
    }
  },
}

export const INITIAL_QUOTATIONS: Quotation[] = [
  {
    id: 'quote-1',
    quotation_number: 'OFF-2026-001',
    client_id: 'client-1',
    client: INITIAL_CLIENTS[0],
    issue_date: '2026-09-01',
    valid_until_date: '2026-10-01',
    status: 'ACCEPTED',
    calculation_mode: 'EXCLUSIVE',
    subtotal_excl: 4500.00,
    total_vat: 945.00,
    total_amount: 5445.00,
    notes: 'Offerte voor herinrichting bedrijfsnetwerk en implementatie cloudoplossing.',
    disclaimer: 'Deze offerte is 30 dagen geldig na dagtekening. Na akkoord start het project binnen 2 weken.',
    signed_by_name: 'Daan van Dijk',
    signed_at: '2026-09-08T11:20:00Z',
    signature_data_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 40 Q 50 10, 90 35 T 180 25" fill="none" stroke="%234f46e5" stroke-width="3"/></svg>',
    line_items: [
      {
        id: 'qitem-1-1',
        description: 'Cloud Infrastructure Setup & Security Hardening',
        quantity: 30,
        unit_price: 95.00,
        vat_rate: '21',
        vat_amount: 598.50,
        line_total_excl: 2850.00,
        line_total_incl: 3448.50,
        sort_order: 1,
      },
      {
        id: 'qitem-1-2',
        description: 'Migratie bestaande databases naar PostgreSQL',
        quantity: 15,
        unit_price: 110.00,
        vat_rate: '21',
        vat_amount: 346.50,
        line_total_excl: 1650.00,
        line_total_incl: 1996.50,
        sort_order: 2,
      },
    ],
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-08T11:20:00Z',
  },
  {
    id: 'quote-2',
    quotation_number: 'OFF-2026-002',
    client_id: 'client-2',
    client: INITIAL_CLIENTS[1],
    issue_date: '2026-09-15',
    valid_until_date: '2026-10-15',
    status: 'SENT',
    calculation_mode: 'EXCLUSIVE',
    subtotal_excl: 2400.00,
    total_vat: 504.00,
    total_amount: 2904.00,
    notes: 'Website UI/UX herontwerp met mobiele optimalisatie en PWA-ondersteuning.',
    disclaimer: 'Prijzen zijn exclusief btw. Betaling in 2 termijnen (50% bij aanvang, 50% bij oplevering).',
    line_items: [
      {
        id: 'qitem-2-1',
        description: 'UI/UX Design in Figma (Desktop & Mobile)',
        quantity: 20,
        unit_price: 80.00,
        vat_rate: '21',
        vat_amount: 336.00,
        line_total_excl: 1600.00,
        line_total_incl: 1936.00,
        sort_order: 1,
      },
      {
        id: 'qitem-2-2',
        description: 'Frontend implementatie met React & Tailwind',
        quantity: 10,
        unit_price: 80.00,
        vat_rate: '21',
        vat_amount: 168.00,
        line_total_excl: 800.00,
        line_total_incl: 968.00,
        sort_order: 2,
      },
    ],
    created_at: '2026-09-15T14:00:00Z',
    updated_at: '2026-09-15T14:30:00Z',
  },
  {
    id: 'quote-3',
    quotation_number: 'OFF-2026-003',
    client_id: 'client-3',
    client: INITIAL_CLIENTS[2],
    issue_date: '2026-09-20',
    valid_until_date: '2026-10-20',
    status: 'DRAFT',
    calculation_mode: 'EXCLUSIVE',
    subtotal_excl: 1850.00,
    total_vat: 388.50,
    total_amount: 2238.50,
    notes: 'Kwartaalonderhoud en SLA monitoring voor webapplicaties.',
    disclaimer: 'Geldig gedurende 30 dagen.',
    line_items: [
      {
        id: 'qitem-3-1',
        description: 'SLA Monitoring & Security Updates Q4 2026',
        quantity: 1,
        unit_price: 1850.00,
        vat_rate: '21',
        vat_amount: 388.50,
        line_total_excl: 1850.00,
        line_total_incl: 2238.50,
        sort_order: 1,
      },
    ],
    created_at: '2026-09-20T09:15:00Z',
    updated_at: '2026-09-20T09:15:00Z',
  },
]

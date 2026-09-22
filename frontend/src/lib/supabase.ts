/**
 * AliBirds Supabase Client & Data Access Layer
 *
 * Credentials come from Netlify environment variables (set ONCE by the app owner).
 * Users never see or touch any API keys — they just log in with email + password.
 */
import { createClient } from '@supabase/supabase-js'
import { Invoice, CalcMode, BusinessSettings, Expense, Client } from './types'

export function dbToSettings(row: any, userMetadata?: any): BusinessSettings {
  if (!row) {
    return {
      id: '',
      company_name: userMetadata?.company_name || '',
      trade_name: userMetadata?.trade_name || userMetadata?.company_name || '',
      kvk_number: '',
      btw_id: '',
      iban: '',
      bic: '',
      address_street: '',
      address_city: '',
      address_postcode: '',
      address_country: 'NL',
      default_payment_term_days: 14,
      invoice_prefix: '2026-',
      next_invoice_sequence: 1,
      invoice_notes_default: userMetadata?.invoice_notes_default || 'Graag betalen binnen de gestelde termijn o.v.v. het factuurnummer.',
      accent_color: '#4f46e5',
      font_family: 'Inter',
      payment_link: userMetadata?.payment_link || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return {
    id: row.id || '',
    company_name: row.company_name || userMetadata?.company_name || '',
    trade_name: row.trading_name || row.trade_name || userMetadata?.trade_name || row.company_name || '',
    kvk_number: row.kvk_number || '',
    btw_id: row.vat_number || row.btw_id || '',
    iban: row.iban || '',
    bic: row.bic || '',
    address_street: row.address_street || '',
    address_city: row.address_city || '',
    address_postcode: row.address_postcode || '',
    address_country: row.country_code || row.address_country || 'NL',
    phone: row.phone || '',
    email: row.email || '',
    website: row.website || '',
    logo_url: row.logo_base64 || row.logo_url || undefined,
    accent_color: row.accent_color || '#4f46e5',
    font_family: row.font_family || 'Inter',
    invoice_prefix: row.invoice_prefix || '2026-',
    default_payment_term_days: Number(row.default_payment_term_days) || 14,
    next_invoice_sequence: Number(row.next_invoice_sequence) || 1,
    invoice_notes_default: row.invoice_notes_default || userMetadata?.invoice_notes_default || 'Graag betalen binnen de gestelde termijn o.v.v. het factuurnummer.',
    payment_link: row.payment_link || userMetadata?.payment_link || '',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  }
}

export function settingsToDb(settings: any) {
  const result: any = {}

  if (settings.company_name !== undefined) result.company_name = settings.company_name
  if (settings.trade_name !== undefined || settings.trading_name !== undefined) {
    result.trading_name = settings.trade_name || settings.trading_name || null
  }
  if (settings.kvk_number !== undefined) result.kvk_number = settings.kvk_number
  if (settings.btw_id !== undefined || settings.vat_number !== undefined) {
    result.vat_number = settings.btw_id || settings.vat_number || null
  }
  if (settings.iban !== undefined) result.iban = settings.iban
  if (settings.bic !== undefined) result.bic = settings.bic
  if (settings.address_street !== undefined) result.address_street = settings.address_street
  if (settings.address_city !== undefined) result.address_city = settings.address_city
  if (settings.address_postcode !== undefined) result.address_postcode = settings.address_postcode
  if (settings.address_country !== undefined || settings.country_code !== undefined) {
    result.country_code = settings.address_country || settings.country_code || 'NL'
  }
  if (settings.email !== undefined) result.email = settings.email
  if (settings.phone !== undefined) result.phone = settings.phone
  if (settings.website !== undefined) result.website = settings.website
  if (settings.logo_url !== undefined || settings.logo_base64 !== undefined) {
    result.logo_base64 = settings.logo_url || settings.logo_base64 || null
  }
  if (settings.accent_color !== undefined) result.accent_color = settings.accent_color
  if (settings.invoice_prefix !== undefined) result.invoice_prefix = settings.invoice_prefix
  if (settings.default_payment_term_days !== undefined) {
    result.default_payment_term_days = Number(settings.default_payment_term_days) || 14
  }
  if (settings.next_invoice_sequence !== undefined) {
    result.next_invoice_sequence = Number(settings.next_invoice_sequence) || 1
  }
  if (settings.default_vat_rate !== undefined) result.default_vat_rate = settings.default_vat_rate
  if (settings.invoice_notes_default !== undefined) result.invoice_notes_default = settings.invoice_notes_default
  if (settings.payment_link !== undefined) result.payment_link = settings.payment_link || null
  if (settings.font_family !== undefined) result.font_family = settings.font_family

  return result
}

export function dbToExpense(row: any): Expense {
  return {
    id: row.id,
    vendor_name: row.vendor || row.vendor_name || 'Onbekend',
    expense_date: row.date || row.expense_date || '',
    category: row.category || 'Algemeen',
    amount_excl_vat: Number(row.amount_excl ?? row.amount_excl_vat ?? 0),
    vat_rate: String(row.vat_rate || '21'),
    vat_amount: Number(row.vat_amount ?? 0),
    amount_incl_vat: Number(row.amount_incl ?? row.amount_incl_vat ?? 0),
    description: row.description || '',
    receipt_file_path: row.receipt_path || row.receipt_file_path || undefined,
    notes: row.notes || '',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  }
}

export function expenseToDb(exp: any) {
  const excl = Number(exp.amount_excl_vat ?? exp.amount_excl ?? 0)
  const vat = Number(exp.vat_amount ?? 0)
  const incl = Number(exp.amount_incl_vat ?? exp.amount_incl ?? (excl + vat))

  return {
    date: exp.expense_date || exp.date || new Date().toISOString().slice(0, 10),
    vendor: exp.vendor_name || exp.vendor || 'Onbekend',
    description: exp.description || exp.vendor_name || 'Uitgave',
    category: exp.category || 'Algemeen',
    amount_excl: excl,
    vat_rate: String(exp.vat_rate || '21'),
    vat_amount: vat,
    amount_incl: incl,
    receipt_path: exp.receipt_file_path || exp.receipt_path || null,
    payment_method: exp.payment_method || 'BANK',
    is_deductible: exp.is_deductible ?? true,
  }
}

function dbToInvoice(row: any): Invoice {
  const lineItems = (row.line_items || []).map((li: any) => ({
    id: li.id,
    description: li.description || '',
    quantity: Number(li.quantity) || 1,
    unit_price: Number(li.unit_price) || 0,
    vat_rate: String(li.vat_rate || '21'),
    vat_amount: Number(li.vat_amount) || 0,
    line_total_excl: Number(li.line_total_excl ?? li.total_excl_vat ?? 0),
    line_total_incl: Number(li.line_total_incl ?? li.total_incl_vat ?? 0),
    sort_order: li.position || 0,
  }))

  const subtotalExcl = Number(
    row.subtotal_excl ??
    row.subtotal_excl_vat ??
    lineItems.reduce((s, it) => s + (Number(it.line_total_excl) || 0), 0)
  )
  const totalVat = Number(
    row.total_vat ??
    row.total_vat_amount ??
    lineItems.reduce((s, it) => s + (Number(it.vat_amount) || 0), 0)
  )
  const totalIncl = Number(
    row.total_incl ??
    row.total_incl_vat ??
    (subtotalExcl + totalVat)
  )

  // PostgREST embeds foreign tables as arrays [ { ... } ] or objects { ... }
  let clientObj: any = undefined
  if (row.client && typeof row.client === 'object') {
    clientObj = Array.isArray(row.client) ? (row.client[0] || undefined) : row.client
  } else if (row.clients && typeof row.clients === 'object') {
    clientObj = Array.isArray(row.clients) ? (row.clients[0] || undefined) : row.clients
  }

  return {
    id: row.id,
    invoice_number: row.invoice_number,
    client_id: row.client_id || undefined,
    client: clientObj,
    issue_date: row.issue_date,
    due_date: row.due_date,
    delivery_date: row.delivery_date || undefined,
    status: row.status || 'DRAFT',
    calculation_mode: (row.calc_mode || row.calculation_mode || 'EXCLUSIVE') as CalcMode,
    subtotal_excl_vat: subtotalExcl,
    subtotal_excl: subtotalExcl,
    total_vat_amount: totalVat,
    total_vat: totalVat,
    total_incl_vat: totalIncl,
    total_incl: totalIncl,
    amount_paid: Number(row.amount_paid ?? (row.status === 'PAID' ? totalIncl : 0)),
    payment_reference: row.reference || row.payment_reference || '',
    notes: row.notes || '',
    pdf_path: row.pdf_path || undefined,
    payment_link: row.payment_link || undefined,
    sent_at: row.sent_at || undefined,
    paid_at: row.paid_at || undefined,
    line_items: lineItems,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function invoiceToDb(inv: any) {
  const subtotalExcl = Number(inv.subtotal_excl ?? inv.subtotal_excl_vat ?? 0)
  const totalVat = Number(inv.total_vat ?? inv.total_vat_amount ?? 0)
  const totalIncl = Number(inv.total_incl ?? inv.total_incl_vat ?? (subtotalExcl + totalVat))

  // Validate if client_id is a valid UUID before sending to PostgreSQL UUID column
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validClientId = (inv.client_id && typeof inv.client_id === 'string' && isUuid.test(inv.client_id))
    ? inv.client_id
    : null

  return {
    invoice_number: inv.invoice_number || `FACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    client_id: validClientId,
    issue_date: inv.issue_date || new Date().toISOString().slice(0, 10),
    due_date: inv.due_date || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    delivery_date: inv.delivery_date || null,
    calc_mode: inv.calc_mode || inv.calculation_mode || 'EXCLUSIVE',
    status: inv.status || 'DRAFT',
    reference: inv.reference || inv.payment_reference || null,
    notes: inv.notes || null,
    payment_terms: inv.payment_terms || null,
    pdf_path: inv.pdf_path || null,
    subtotal_excl: subtotalExcl,
    total_vat: totalVat,
    total_incl: totalIncl,
    is_reverse_charge: inv.is_reverse_charge || inv.line_items?.some((i: any) => i.vat_rate === 'REVERSE_CHARGE') || false,
    sent_at: inv.sent_at || (inv.status === 'SENT' ? new Date().toISOString() : null),
    paid_at: inv.paid_at || (inv.status === 'PAID' ? (inv.issue_date ? new Date(inv.issue_date).toISOString() : new Date().toISOString()) : null),
  }
}

const STORAGE_KEY_CONFIG = 'alibirds_supabase_config'

// Supabase credentials must be set as environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// For Netlify: set these in Site Settings → Environment Variables
// For local dev: add to frontend/.env.local
function getCredentials(): { url: string; key: string } {
  // 1. Environment variables (primary source — always preferred)
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL as string) || ''
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || ''
  if (envUrl && envKey && envUrl.startsWith('https://') && !envUrl.includes('placeholder')) {
    return { url: envUrl.trim().replace(/\/+$/, ''), key: envKey.trim() }
  }

  // 2. Previously stored in browser localStorage (if overridden)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.url && parsed.anonKey && parsed.url.startsWith('https://')) {
          return { url: parsed.url.trim().replace(/\/+$/, ''), key: parsed.anonKey.trim() }
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. No credentials found — return empty (Supabase client will fail to connect, which is preferable
  //    to silently using someone else's credentials)
  console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.')
  return { url: '', key: '' }
}

const creds = getCredentials()

export function isSupabaseConfigured(): boolean {
  return true
}

const safeUrl = creds.url
const safeKey = creds.key

// Single shared client — auth session is persisted automatically by the SDK
export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Supabase Data Access Object
 * All queries are automatically scoped to the logged-in user via RLS.
 */
export const supabaseDb = {

  // ── Invoices ───────────────────────────────────────────────────────────────
  getInvoices: async () => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('invoices')
      .select('*, client:clients(*), line_items:invoice_line_items(*)')
      .order('issue_date', { ascending: false })
    if (error) throw error
    if (!data) return []
    return data.map(dbToInvoice)
  },

  getInvoice: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('invoices')
      .select('*, client:clients(*), line_items:invoice_line_items(*)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return dbToInvoice(data)
  },

  saveInvoice: async (invoiceData: any, items: any[] = []) => {
    if (!isSupabaseConfigured()) return null
    const dbPayload = invoiceToDb(invoiceData)
    const lineItems = (items && items.length > 0) ? items : (invoiceData.line_items || [])
    const id = invoiceData.id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    let invoiceId: string

    if (id && typeof id === 'string' && isUuid.test(id)) {
      const { data, error } = await supabase
        .from('invoices')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      invoiceId = data.id
      // Replace all line items
      await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId)
    } else {
      let insertRes = await supabase
        .from('invoices')
        .insert(dbPayload)
        .select()
        .single()

      if (insertRes.error) {
        // If unique constraint violation on invoice_number, retry with unique sequence
        if (insertRes.error.code === '23505' || insertRes.error.message?.includes('duplicate key') || insertRes.error.message?.includes('unique')) {
          const uniqueNum = `${dbPayload.invoice_number}-${Math.floor(100 + Math.random() * 900)}`
          insertRes = await supabase
            .from('invoices')
            .insert({ ...dbPayload, invoice_number: uniqueNum })
            .select()
            .single()
        }
      }

      if (insertRes.error) throw insertRes.error
      invoiceId = insertRes.data.id
    }

    if (lineItems && lineItems.length > 0) {
      const lineRows = lineItems.map((it: any, idx: number) => {
        const qty = Number(it.quantity) || 1
        const price = Number(it.unit_price) || 0
        const rateNum = it.vat_rate === 'REVERSE_CHARGE' ? 0 : (Number(it.vat_rate) || 0)
        const excl = Number(it.line_total_excl ?? it.total_excl_vat ?? (qty * price)) || 0
        let vat = Number(it.vat_amount ?? it.total_vat ?? 0)
        if (!vat && rateNum > 0 && excl > 0) {
          vat = Math.round(excl * (rateNum / 100) * 100) / 100
        }
        const incl = Number(it.line_total_incl ?? it.total_incl_vat ?? (excl + vat)) || excl

        return {
          invoice_id: invoiceId,
          position: idx,
          description: it.description || `Item ${idx + 1}`,
          quantity: qty,
          unit_price: price || excl,
          vat_rate: String(it.vat_rate || '21'),
          vat_amount: vat,
          line_total_excl: excl,
          line_total_incl: incl,
        }
      })
      const { error: liError } = await supabase.from('invoice_line_items').insert(lineRows)
      if (liError) {
        console.warn('Supabase invoice_line_items insert error:', liError)
      }
    }

    return await supabaseDb.getInvoice(invoiceId)
  },

  deleteInvoice: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    try {
      // 1. Unlink bank transactions
      await supabase.from('bank_transactions').update({ matched_invoice_id: null }).eq('matched_invoice_id', id)
      // 2. Delete invoice line items first to prevent FK violation
      await supabase.from('invoice_line_items').delete().eq('invoice_id', id)
      // 3. Delete invoice
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      console.warn('Supabase deleteInvoice warning:', err)
      throw err
    }
    return true
  },

  clearAllInvoices: async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bank_transactions').update({ matched_invoice_id: null }).neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('invoice_line_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      } catch (err) {
        console.warn('Supabase clearAllInvoices warning:', err)
      }
    }
    return true
  },

  // ── Clients ────────────────────────────────────────────────────────────────
  getClients: async () => {
    if (!isSupabaseConfigured()) return null
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('Supabase getClients error:', err)
      return null
    }
  },

  saveClient: async (clientData: any) => {
    if (!isSupabaseConfigured()) return null
    const { id, created_at, updated_at, ...rawFields } = clientData
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    const fields: any = {
      name: rawFields.name || '',
      contact_person: rawFields.contact_person || null,
      email: rawFields.email || null,
      phone: rawFields.phone || null,
      vat_number: rawFields.vat_number || null,
      kvk_number: rawFields.kvk_number || null,
      billing_address_street: rawFields.billing_address_street || null,
      billing_address_city: rawFields.billing_address_city || null,
      billing_address_postcode: rawFields.billing_address_postcode || null,
      country_code: rawFields.country_code || rawFields.billing_address_country || 'NL',
      default_payment_term_days: Number(rawFields.default_payment_term_days) || 14,
      notes: rawFields.notes || null,
      is_active: rawFields.is_active ?? true,
    }

    if (id && typeof id === 'string' && isUuid.test(id)) {
      const { data, error } = await supabase
        .from('clients')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert(fields)
        .select()
        .single()
      if (error) throw error
      return data
    }
  },

  deleteClient: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // ── Expenses ───────────────────────────────────────────────────────────────
  getExpenses: async () => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
    if (error) throw error
    if (!data) return []
    return data.map(dbToExpense)
  },

  saveExpense: async (expenseData: any) => {
    if (!isSupabaseConfigured()) return null
    const dbPayload = expenseToDb(expenseData)
    const id = expenseData.id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (id && typeof id === 'string' && isUuid.test(id)) {
      const { data, error } = await supabase
        .from('expenses')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return dbToExpense(data)
    } else {
      const { data, error } = await supabase
        .from('expenses')
        .insert(dbPayload)
        .select()
        .single()
      if (error) throw error
      return dbToExpense(data)
    }
  },

  deleteExpense: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // ── Business Settings ──────────────────────────────────────────────────────
  getSettings: async (): Promise<BusinessSettings | null> => {
    if (!isSupabaseConfigured()) return null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userMetadata = session?.user?.user_metadata || {}

      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (error) {
        console.warn('Supabase getSettings query warning:', error)
      }

      if (!data && !session?.user) {
        return null
      }

      return dbToSettings(data, userMetadata)
    } catch (err) {
      console.warn('Supabase getSettings error:', err)
      return null
    }
  },

  saveSettings: async (settingsData: Partial<BusinessSettings>): Promise<BusinessSettings | null> => {
    if (!isSupabaseConfigured()) return null

    // 1. Get current user session
    const { data: { session } } = await supabase.auth.getSession()
    const userMetadata = session?.user?.user_metadata || {}

    // 2. Synchronize user metadata across all devices via Supabase Auth
    try {
      await supabase.auth.updateUser({
        data: {
          company_name: settingsData.company_name || userMetadata.company_name,
          trade_name: settingsData.trade_name || settingsData.company_name || userMetadata.trade_name,
          payment_link: settingsData.payment_link !== undefined ? settingsData.payment_link : userMetadata.payment_link,
          invoice_notes_default: settingsData.invoice_notes_default !== undefined ? settingsData.invoice_notes_default : userMetadata.invoice_notes_default,
          is_onboarded: true,
        },
      })
    } catch (authErr) {
      console.warn('Could not update user metadata:', authErr)
    }

    // 3. Map to safe database columns (strictly valid PostgreSQL table columns)
    const dbPayload = settingsToDb(settingsData)

    try {
      const current = await supabase
        .from('business_settings')
        .select('id')
        .limit(1)
        .maybeSingle()

      let savedRow: any = null

      if (current.data && current.data.id) {
        const { data, error } = await supabase
          .from('business_settings')
          .update(dbPayload)
          .eq('id', current.data.id)
          .select()
          .single()
        if (error) throw error
        savedRow = data
      } else {
        const { data, error } = await supabase
          .from('business_settings')
          .insert(dbPayload)
          .select()
          .single()
        if (error) throw error
        savedRow = data
      }

      return dbToSettings(savedRow, {
        ...userMetadata,
        ...settingsData,
      })
    } catch (dbErr) {
      console.warn('Supabase saveSettings DB warning, returning metadata-synced settings:', dbErr)
      return dbToSettings(null, {
        ...userMetadata,
        ...settingsData,
      })
    }
  },

  // ── Bank Transactions (MT940) ──────────────────────────────────────────────
  getBankTransactions: async () => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .order('value_date', { ascending: false })
    if (error) throw error
    if (!data) return []

    return data.map(row => {
      const isDebit = row.transaction_type === 'DEBIT'
      const date = row.value_date || row.entry_date || ''
      const name = row.contra_account_name || ''
      const iban = row.contra_account_iban || ''
      const ref = row.raw_reference || row.description || ''

      return {
        id: row.id,
        transaction_date: date,
        value_date: date,
        type: (isDebit ? 'DEBIT' : 'CREDIT') as 'CREDIT' | 'DEBIT',
        transaction_type: (isDebit ? 'DEBIT' : 'CREDIT') as 'CREDIT' | 'DEBIT',
        amount: Number(row.amount),
        currency: row.currency || 'EUR',
        counterpart_name: name,
        contra_account_name: name,
        counterpart_iban: iban,
        contra_account_iban: iban,
        remittance_reference: ref,
        raw_reference: ref,
        description: row.description || ref,
        reconciliation_status: row.reconciliation_status || 'UNMATCHED',
        matched_invoice_id: row.matched_invoice_id,
        match_score: row.match_score,
        imported_at: row.created_at,
      }
    })
  },

  saveBankTransactions: async (transactions: any[]) => {
    if (!isSupabaseConfigured()) return null
    if (!transactions.length) return []

    const dbRows = transactions.map(t => {
      const isDebit = t.type === 'DEBIT' || t.transaction_type === 'DEBIT'
      return {
        value_date: t.transaction_date || t.value_date || new Date().toISOString().slice(0, 10),
        transaction_type: isDebit ? 'DEBIT' : 'CREDIT',
        amount: Number(t.amount),
        currency: t.currency || 'EUR',
        contra_account_iban: t.counterpart_iban || t.contra_account_iban || null,
        contra_account_name: t.counterpart_name || t.contra_account_name || null,
        description: t.description || t.remittance_reference || null,
        raw_reference: t.remittance_reference || t.raw_reference || null,
        reconciliation_status: t.reconciliation_status || 'UNMATCHED',
        matched_invoice_id: t.matched_invoice_id || null,
        raw_hash: t.raw_hash || null,
      }
    })

    const { data, error } = await supabase
      .from('bank_transactions')
      .upsert(dbRows, { onConflict: 'user_id,raw_hash' })
      .select()
    if (error) {
      console.warn('Supabase upsert bank_transactions error:', error)
      const { data: insData } = await supabase.from('bank_transactions').insert(dbRows).select()
      return insData || transactions
    }
    return data
  },

  matchBankTransaction: async (txId: string, invoiceId: string) => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('bank_transactions')
      .update({
        matched_invoice_id: invoiceId,
        reconciliation_status: 'MATCHED',
      })
      .eq('id', txId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  unmatchBankTransaction: async (txId: string) => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('bank_transactions')
      .update({
        matched_invoice_id: null,
        reconciliation_status: 'UNMATCHED',
        match_score: null,
      })
      .eq('id', txId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // ── Recurring Schedules ──────────────────────────────────────────────────
  getRecurringSchedules: async () => {
    if (!isSupabaseConfigured()) return null
    try {
      const { data, error } = await supabase
        .from('recurring_schedules')
        .select('*, client:clients(*)')
        .order('next_run_date', { ascending: true })
      if (error) throw error
      if (!data) return []
      return data.map(row => {
        let client = undefined
        if (row.client && typeof row.client === 'object') {
          client = Array.isArray(row.client) ? (row.client[0] || undefined) : row.client
        }
        return {
          ...row,
          client,
        }
      })
    } catch (err) {
      console.warn('Supabase getRecurringSchedules notice:', err)
      return null
    }
  },

  saveRecurringSchedule: async (schedData: any) => {
    if (!isSupabaseConfigured()) return null
    const { id, client, created_at, updated_at, ...fields } = schedData
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    const dbRow = {
      ...fields,
      client_id: (fields.client_id && isUuid.test(fields.client_id)) ? fields.client_id : null,
      line_items_template: fields.line_items_template || [],
    }

    try {
      if (id && typeof id === 'string' && isUuid.test(id)) {
        const { data, error } = await supabase
          .from('recurring_schedules')
          .update(dbRow)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('recurring_schedules')
          .insert(dbRow)
          .select()
          .single()
        if (error) throw error
        return data
      }
    } catch (err) {
      console.warn('Supabase saveRecurringSchedule notice:', err)
      return null
    }
  },

  deleteRecurringSchedule: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    try {
      const { error } = await supabase.from('recurring_schedules').delete().eq('id', id)
      if (error) throw error
      return true
    } catch (err) {
      console.warn('Supabase deleteRecurringSchedule notice:', err)
      return null
    }
  },
}

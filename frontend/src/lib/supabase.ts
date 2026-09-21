/**
 * AliBirds Supabase Client & Data Access Layer
 *
 * Credentials come from Netlify environment variables (set ONCE by the app owner).
 * Users never see or touch any API keys — they just log in with email + password.
 */
import { createClient } from '@supabase/supabase-js'
import { Invoice, CalcMode } from './types'

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

  const subtotalExcl = Number(row.subtotal_excl ?? row.subtotal_excl_vat ?? 0)
  const totalVat = Number(row.total_vat ?? row.total_vat_amount ?? 0)
  const totalIncl = Number(row.total_incl ?? row.total_incl_vat ?? (subtotalExcl + totalVat))

  return {
    id: row.id,
    invoice_number: row.invoice_number,
    client_id: row.client_id || undefined,
    client: row.client || undefined,
    issue_date: row.issue_date,
    due_date: row.due_date,
    delivery_date: row.delivery_date || undefined,
    status: row.status || 'DRAFT',
    calculation_mode: (row.calc_mode || row.calculation_mode || 'EXCLUSIVE') as CalcMode,
    subtotal_excl_vat: subtotalExcl,
    total_vat_amount: totalVat,
    total_incl_vat: totalIncl,
    amount_paid: Number(row.amount_paid ?? (row.status === 'PAID' ? totalIncl : 0)),
    payment_reference: row.reference || row.payment_reference || '',
    notes: row.notes || '',
    pdf_path: row.pdf_path || undefined,
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

  return {
    invoice_number: inv.invoice_number,
    client_id: (inv.client_id && inv.client_id !== 'NEW') ? inv.client_id : null,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
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

// Built-in default production Supabase instance — zero setup required by end users
const DEFAULT_URL = 'https://gnizaskjsgxwgdirzrrf.supabase.co'
const DEFAULT_KEY = 'sb_publishable_lxxsKIS_pObg-cS-pXQrxw_vHqy2dG3'

function getCredentials(): { url: string; key: string } {
  // 1. Environment variables (if overridden)
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''
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

  // 3. Default production instance
  return { url: DEFAULT_URL, key: DEFAULT_KEY }
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
  // ── Clients ────────────────────────────────────────────────────────────────
  getClients: async () => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  saveClient: async (clientData: any) => {
    if (!isSupabaseConfigured()) return null
    const { id, ...fields } = clientData

    if (id && id.length > 20) {
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

    let invoiceId: string

    if (id && id.length > 20 && !id.startsWith('inv-demo')) {
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
      const { data, error } = await supabase
        .from('invoices')
        .insert(dbPayload)
        .select()
        .single()
      if (error) throw error
      invoiceId = data.id
    }

    if (lineItems && lineItems.length > 0) {
      const lineRows = lineItems.map((it: any, idx: number) => {
        const qty = Number(it.quantity) || 1
        const price = Number(it.unit_price) || 0
        const excl = Number(it.line_total_excl ?? it.total_excl_vat ?? (qty * price)) || 0
        const vat = Number(it.vat_amount ?? it.total_vat ?? 0)
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
    }
    demoStore.deleteInvoice(id)
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
    demoStore.clearAllInvoices()
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
    const { id, created_at, updated_at, ...fields } = clientData

    if (id && typeof id === 'string' && id.length > 20) {
      const { data, error } = await supabase
        .from('clients')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      demoStore.saveClient(data)
      return data
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert(fields)
        .select()
        .single()
      if (error) throw error
      demoStore.saveClient(data)
      return data
    }
  },

  deleteClient: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
    demoStore.deleteClient(id)
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
    return data
  },

  saveExpense: async (expenseData: any) => {
    if (!isSupabaseConfigured()) return null
    const { id, ...fields } = expenseData

    if (id && id.length > 20) {
      const { data, error } = await supabase
        .from('expenses')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('expenses')
        .insert(fields)
        .select()
        .single()
      if (error) throw error
      return data
    }
  },

  deleteExpense: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // ── Business Settings ──────────────────────────────────────────────────────
  getSettings: async () => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  },

  saveSettings: async (settingsData: any) => {
    if (!isSupabaseConfigured()) return null
    const current = await supabaseDb.getSettings()

    if (current && current.id) {
      const { data, error } = await supabase
        .from('business_settings')
        .update(settingsData)
        .eq('id', current.id)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('business_settings')
        .insert(settingsData)
        .select()
        .single()
      if (error) throw error
      return data
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
}

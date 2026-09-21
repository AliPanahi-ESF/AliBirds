/**
 * AliBirds Supabase Client & Data Access Layer
 *
 * Credentials come from Netlify environment variables (set ONCE by the app owner).
 * Users never see or touch any API keys — they just log in with email + password.
 */
import { createClient } from '@supabase/supabase-js'

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
    return data
  },

  getInvoice: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase
      .from('invoices')
      .select('*, client:clients(*), line_items:invoice_line_items(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  saveInvoice: async (invoiceData: any, items: any[] = []) => {
    if (!isSupabaseConfigured()) return null
    const { client: _c, line_items: _l, id, ...cleanInvoice } = invoiceData

    let invoiceId: string

    if (id && id.length > 20) {
      const { data, error } = await supabase
        .from('invoices')
        .update(cleanInvoice)
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
        .insert(cleanInvoice)
        .select()
        .single()
      if (error) throw error
      invoiceId = data.id
    }

    if (items && items.length > 0) {
      const lineRows = items.map((it, idx) => ({
        invoice_id: invoiceId,
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        vat_amount: it.vat_amount,
        line_total_excl: it.line_total_excl,
        line_total_incl: it.line_total_incl,
      }))
      const { error: liError } = await supabase.from('invoice_line_items').insert(lineRows)
      if (liError) throw liError
    }

    // Return the full invoice with relations
    return supabaseDb.getInvoice(invoiceId)
  },

  deleteInvoice: async (id: string) => {
    if (!isSupabaseConfigured()) return null
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) throw error
    return true
  },

  clearAllInvoices: async () => {
    if (!isSupabaseConfigured()) return null
    // RLS ensures only the current user's invoices are deleted
    const { error } = await supabase
      .from('invoices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
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
}

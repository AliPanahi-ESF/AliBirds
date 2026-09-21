/**
 * AliBirds Supabase Client & PostgREST Helper
 * Provides direct connection to free Supabase PostgreSQL database without server dependencies.
 */
import axios from 'axios'

const STORAGE_KEY_CONFIG = 'alibirds_supabase_config'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function getSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.url && parsed.anonKey) {
        return parsed
      }
    }
    const envUrl = import.meta.env.VITE_SUPABASE_URL
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (envUrl && envKey) {
      return { url: envUrl, anonKey: envKey }
    }
  } catch {
    // fallback
  }
  return null
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '')
  const cleanKey = anonKey.trim()
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }))
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_CONFIG)
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseConfig()
  return !!(cfg && cfg.url && cfg.anonKey)
}

/**
 * Creates an Axios instance targeted at the Supabase PostgREST endpoint
 */
function getSupabaseHttp() {
  const cfg = getSupabaseConfig()
  if (!cfg) return null

  return axios.create({
    baseURL: `${cfg.url}/rest/v1`,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    timeout: 6000,
  })
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseHttp()
  if (!client) {
    return { ok: false, message: 'Geen Supabase URL of Anon Key geconfigureerd.' }
  }

  try {
    const res = await client.get('/business_settings?limit=1')
    if (res.status === 200) {
      return { ok: true, message: 'Verbinding met Supabase succesvol tot stand gebracht!' }
    }
    return { ok: false, message: `Onverwachte status: ${res.status}` }
  } catch (err: any) {
    return {
      ok: false,
      message: err.response?.data?.message || err.message || 'Kan geen verbinding maken met Supabase.',
    }
  }
}

/**
 * Supabase Data Access Object
 */
export const supabaseDb = {
  // Clients
  getClients: async () => {
    const client = getSupabaseHttp()
    if (!client) return null
    const res = await client.get('/clients?order=created_at.desc')
    return res.data
  },
  saveClient: async (data: any) => {
    const client = getSupabaseHttp()
    if (!client) return null
    if (data.id && data.id.length > 20) {
      const res = await client.patch(`/clients?id=eq.${data.id}`, data)
      return res.data?.[0] || data
    } else {
      const { id, ...createData } = data
      const res = await client.post('/clients', createData)
      return res.data?.[0] || data
    }
  },
  deleteClient: async (id: string) => {
    const client = getSupabaseHttp()
    if (!client) return null
    await client.delete(`/clients?id=eq.${id}`)
    return true
  },

  // Invoices
  getInvoices: async () => {
    const client = getSupabaseHttp()
    if (!client) return null
    const res = await client.get('/invoices?select=*,client:clients(*),line_items:invoice_line_items(*)&order=issue_date.desc')
    return res.data
  },
  getInvoice: async (id: string) => {
    const client = getSupabaseHttp()
    if (!client) return null
    const res = await client.get(`/invoices?id=eq.${id}&select=*,client:clients(*),line_items:invoice_line_items(*)`)
    return res.data?.[0] || null
  },
  saveInvoice: async (invoiceData: any, items: any[] = []) => {
    const client = getSupabaseHttp()
    if (!client) return null

    let invoice = null
    const { client: _c, line_items: _l, id, ...cleanInvoice } = invoiceData

    if (id && id.length > 20) {
      const res = await client.patch(`/invoices?id=eq.${id}`, cleanInvoice)
      invoice = res.data?.[0]
      // Replace line items
      await client.delete(`/invoice_line_items?invoice_id=eq.${id}`)
    } else {
      const res = await client.post('/invoices', cleanInvoice)
      invoice = res.data?.[0]
    }

    if (invoice && items && items.length > 0) {
      const lineRows = items.map((it, idx) => ({
        invoice_id: invoice.id,
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        vat_amount: it.vat_amount,
        line_total_excl: it.line_total_excl,
        line_total_incl: it.line_total_incl,
      }))
      await client.post('/invoice_line_items', lineRows)
    }

    return invoice
  },

  // Expenses
  getExpenses: async () => {
    const client = getSupabaseHttp()
    if (!client) return null
    const res = await client.get('/expenses?order=date.desc')
    return res.data
  },
  saveExpense: async (data: any) => {
    const client = getSupabaseHttp()
    if (!client) return null
    if (data.id && data.id.length > 20) {
      const res = await client.patch(`/expenses?id=eq.${data.id}`, data)
      return res.data?.[0] || data
    } else {
      const { id, ...createData } = data
      const res = await client.post('/expenses', createData)
      return res.data?.[0] || data
    }
  },
  deleteExpense: async (id: string) => {
    const client = getSupabaseHttp()
    if (!client) return null
    await client.delete(`/expenses?id=eq.${id}`)
    return true
  },

  // Business Settings
  getSettings: async () => {
    const client = getSupabaseHttp()
    if (!client) return null
    const res = await client.get('/business_settings?limit=1')
    return res.data?.[0] || null
  },
  saveSettings: async (settingsData: any) => {
    const client = getSupabaseHttp()
    if (!client) return null
    const current = await supabaseDb.getSettings()
    if (current && current.id) {
      const res = await client.patch(`/business_settings?id=eq.${current.id}`, settingsData)
      return res.data?.[0] || settingsData
    } else {
      const res = await client.post('/business_settings', settingsData)
      return res.data?.[0] || settingsData
    }
  },
}

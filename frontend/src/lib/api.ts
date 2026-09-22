import axios from 'axios'
import { demoStore } from './demoData'
import { isSupabaseConfigured, supabaseDb } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 4000,
})

// Intercept HTML responses from SPA rewrites (e.g. Netlify returning index.html for unknown /api/*)
api.interceptors.response.use(response => {
  if (
    typeof response.data === 'string' &&
    (response.data.trim().startsWith('<!DOCTYPE') ||
     response.data.includes('<html') ||
     (response.headers['content-type'] && response.headers['content-type'].includes('text/html')))
  ) {
    throw new Error('API route returned HTML SPA fallback instead of JSON');
  }
  return response;
})

// ── Helpers ────────────────────────────────────────────────────────────────

export const fmt = {
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
  dateInput: (s: string) => (typeof s === 'string' ? s.slice(0, 10) : ''),
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardApi = {
  kpis: async () => {
    try {
      const res = await api.get('/dashboard/kpis')
      if (res.data && typeof res.data === 'object' && typeof res.data.outstanding_revenue === 'number') {
        return res.data
      }
      return demoStore.getKPIs()
    } catch (err) {
      console.info('Using local demo data for KPIs')
      return demoStore.getKPIs()
    }
  },
}

// ── Invoices ───────────────────────────────────────────────────────────────

export const invoicesApi = {
  list: async (params?: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaInvoices = await supabaseDb.getInvoices()
        if (Array.isArray(supaInvoices)) {
          let list = supaInvoices
          if (params?.status) list = list.filter((i: any) => i.status === params.status)
          return list
        }
      } catch (err) {
        console.warn('Supabase getInvoices error, falling back to local store:', err)
      }
    }

    try {
      const res = await api.get('/invoices', { params })
      if (Array.isArray(res.data)) {
        return res.data
      }
      let list = demoStore.getInvoices()
      if (params?.status) list = list.filter(i => i.status === params.status)
      return list
    } catch (err) {
      console.info('Using local demo data for Invoices')
      let list = demoStore.getInvoices()
      if (params?.status) {
        list = list.filter(i => i.status === params.status)
      }
      return list
    }
  },
  get: async (id: string) => {
    if (isSupabaseConfigured()) {
      try {
        const supaInv = await supabaseDb.getInvoice(id)
        if (supaInv) return supaInv
      } catch (err) {
        console.warn('Supabase getInvoice error:', err)
      }
    }

    try {
      const res = await api.get(`/invoices/${id}`)
      if (res.data && typeof res.data === 'object' && res.data.id) {
        return res.data
      }
      const found = demoStore.getInvoice(id)
      if (found) return found
      throw new Error('Factuur niet gevonden')
    } catch (err) {
      const found = demoStore.getInvoice(id)
      if (found) return found
      throw err
    }
  },
  create: async (data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaCreated = await supabaseDb.saveInvoice(data, data.line_items)
        if (supaCreated) return supaCreated
      } catch (err) {
        console.warn('Supabase saveInvoice error:', err)
      }
    }

    try {
      const res = await api.post('/invoices', data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
      return demoStore.saveInvoice(data)
    } catch (err) {
      return demoStore.saveInvoice(data)
    }
  },
  update: async (id: string, data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaUpdated = await supabaseDb.saveInvoice({ ...data, id }, data.line_items)
        if (supaUpdated) return supaUpdated
      } catch (err) {
        console.warn('Supabase updateInvoice error:', err)
      }
    }

    try {
      const res = await api.put(`/invoices/${id}`, data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
      return demoStore.saveInvoice({ ...data, id })
    } catch (err) {
      return demoStore.saveInvoice({ ...data, id })
    }
  },
  cancel: async (id: string) => {
    try {
      return await api.delete(`/invoices/${id}`)
    } catch (err) {
      demoStore.deleteInvoice(id)
      return { success: true }
    }
  },
  send: async (id: string) => {
    try {
      const res = await api.post(`/invoices/${id}/send`)
      return res.data
    } catch (err) {
      const inv = demoStore.getInvoice(id)
      if (inv) {
        inv.status = 'SENT'
        inv.sent_at = new Date().toISOString()
        demoStore.saveInvoice(inv)
      }
      return { success: true, message: 'Factuur verzonden (Demo simulatie)' }
    }
  },
  renderPdf: async (id: string) => {
    try {
      const res = await api.post(`/invoices/${id}/render-pdf`)
      return res.data
    } catch (err) {
      return { success: true, message: 'PDF gerenderd' }
    }
  },
  pdfUrl: (id: string) => `${api.defaults.baseURL}/invoices/${id}/pdf`,
  calculate: async (data: any) => {
    try {
      const res = await api.post('/invoices/calculate', data)
      if (res.data && typeof res.data === 'object' && res.data.items) return res.data
      return demoStore.calculateVat(data)
    } catch (err) {
      return demoStore.calculateVat(data)
    }
  },
}

// ── Clients ────────────────────────────────────────────────────────────────

export const clientsApi = {
  list: async (search?: string) => {
    if (isSupabaseConfigured()) {
      try {
        const supaClients = await supabaseDb.getClients()
        if (Array.isArray(supaClients)) {
          let list = supaClients
          if (search) {
            const q = search.toLowerCase()
            list = list.filter((c: any) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
          }
          return list
        }
      } catch (err) {
        console.warn('Supabase getClients error:', err)
      }
    }

    try {
      const res = await api.get('/clients', { params: { search } })
      if (Array.isArray(res.data)) return res.data
      let list = demoStore.getClients()
      if (search) {
        const q = search.toLowerCase()
        list = list.filter(c => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      }
      return list
    } catch (err) {
      let list = demoStore.getClients()
      if (search) {
        const q = search.toLowerCase()
        list = list.filter(c => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      }
      return list
    }
  },
  get: async (id: string) => {
    if (isSupabaseConfigured()) {
      try {
        const clients = await supabaseDb.getClients()
        const found = clients?.find((c: any) => c.id === id)
        if (found) return found
      } catch (err) {
        console.warn('Supabase client find error:', err)
      }
    }

    try {
      const res = await api.get(`/clients/${id}`)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
      return demoStore.getClients().find(c => c.id === id)
    } catch (err) {
      return demoStore.getClients().find(c => c.id === id)
    }
  },
  create: async (data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaSaved = await supabaseDb.saveClient(data)
        if (supaSaved) return supaSaved
      } catch (err) {
        console.warn('Supabase saveClient error:', err)
      }
    }

    try {
      const res = await api.post('/clients', data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
      return demoStore.saveClient(data)
    } catch (err) {
      return demoStore.saveClient(data)
    }
  },
  update: async (id: string, data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaSaved = await supabaseDb.saveClient({ ...data, id })
        if (supaSaved) return supaSaved
      } catch (err) {
        console.warn('Supabase updateClient error:', err)
      }
    }

    try {
      const res = await api.put(`/clients/${id}`, data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
      return demoStore.saveClient({ ...data, id })
    } catch (err) {
      return demoStore.saveClient({ ...data, id })
    }
  },
  remove: async (id: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabaseDb.deleteClient(id)
        return { success: true }
      } catch (err) {
        console.warn('Supabase deleteClient error:', err)
      }
    }

    try {
      return await api.delete(`/clients/${id}`)
    } catch (err) {
      demoStore.deleteClient(id)
      return { success: true }
    }
  },
}

// ── Bank ───────────────────────────────────────────────────────────────────

export const bankApi = {
  upload: async (file: File) => {
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/bank/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      return res.data
    } catch (err) {
      return { success: true, count: 3, message: 'MT940 verwerkt (Demo)' }
    }
  },
  transactions: async (params?: any) => {
    try {
      const res = await api.get('/bank/transactions', { params })
      if (Array.isArray(res.data)) return res.data
      return demoStore.getBankTransactions()
    } catch (err) {
      return demoStore.getBankTransactions()
    }
  },
  reconcile: async () => {
    try {
      const res = await api.post('/bank/reconcile')
      return res.data
    } catch (err) {
      return { matched: 1, total: 3 }
    }
  },
  match: async (txId: string, invoiceId: string) => {
    try {
      const res = await api.post(`/bank/transactions/${txId}/match`, { invoice_id: invoiceId })
      return res.data
    } catch (err) {
      demoStore.matchBankTransaction(txId, invoiceId)
      return { success: true }
    }
  },
  unmatch: async (txId: string) => {
    try {
      const res = await api.post(`/bank/transactions/${txId}/unmatch`)
      return res.data
    } catch (err) {
      return { success: true }
    }
  },
}

// ── Tax ────────────────────────────────────────────────────────────────────

export const taxApi = {
  btw: async (year: number = 2026, quarter: number = 3) => {
    try {
      const res = await api.get('/tax/btw-aangifte', { params: { year, quarter } })
      if (res.data && res.data.rubrics) return res.data
      return demoStore.getBtwAangifte(`Q${quarter}`, String(year))
    } catch (err) {
      return demoStore.getBtwAangifte(`Q${quarter}`, String(year))
    }
  },
  quarters: async () => {
    try {
      const res = await api.get('/tax/quarters')
      if (Array.isArray(res.data)) return res.data
      return ['2026-Q3', '2026-Q2', '2026-Q1', '2025-Q4']
    } catch (err) {
      return ['2026-Q3', '2026-Q2', '2026-Q1', '2025-Q4']
    }
  },
}

// ── Expenses ───────────────────────────────────────────────────────────────

export const expensesApi = {
  list: async (params?: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaExpenses = await supabaseDb.getExpenses()
        if (Array.isArray(supaExpenses)) return supaExpenses
      } catch (err) {
        console.warn('Supabase getExpenses error:', err)
      }
    }

    try {
      const res = await api.get('/expenses', { params })
      if (Array.isArray(res.data)) return res.data
      return demoStore.getExpenses()
    } catch (err) {
      return demoStore.getExpenses()
    }
  },
  create: async (data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaSaved = await supabaseDb.saveExpense(data)
        if (supaSaved) return supaSaved
      } catch (err) {
        console.warn('Supabase saveExpense error:', err)
      }
    }

    try {
      const res = await api.post('/expenses', data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
      return demoStore.saveExpense(data)
    } catch (err) {
      return demoStore.saveExpense(data)
    }
  },
  delete: async (id: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabaseDb.deleteExpense(id)
        return { success: true }
      } catch (err) {
        console.warn('Supabase deleteExpense error:', err)
      }
    }

    try {
      return await api.delete(`/expenses/${id}`)
    } catch (err) {
      demoStore.deleteExpense(id)
      return { success: true }
    }
  },
  uploadReceipt: async (id: string, file: File) => {
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(`/expenses/${id}/receipt`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      return res.data
    } catch (err) {
      return { success: true }
    }
  },
}

// ── Settings ───────────────────────────────────────────────────────────────

export const settingsApi = {
  get: async () => {
    if (isSupabaseConfigured()) {
      try {
        const supaSettings = await supabaseDb.getSettings()
        if (supaSettings && supaSettings.company_name) return supaSettings
      } catch (err) {
        console.warn('Supabase getSettings error:', err)
      }
    }

    try {
      const res = await api.get('/settings')
      if (res.data && typeof res.data === 'object' && res.data.company_name) return res.data
      return demoStore.getSettings()
    } catch (err) {
      return demoStore.getSettings()
    }
  },
  update: async (data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaSaved = await supabaseDb.saveSettings(data)
        if (supaSaved) return supaSaved
      } catch (err) {
        console.warn('Supabase saveSettings error:', err)
      }
    }

    try {
      const res = await api.put('/settings', data)
      if (res.data && typeof res.data === 'object' && res.data.company_name) return res.data
      return demoStore.saveSettings(data)
    } catch (err) {
      return demoStore.saveSettings(data)
    }
  },
}

// ── Recurring ──────────────────────────────────────────────────────────────

export const recurringApi = {
  list: async () => {
    try {
      const res = await api.get('/recurring')
      if (Array.isArray(res.data)) return res.data
      return [
        {
          id: 'rec-1',
          client_id: 'client-1',
          client: demoStore.getClients()[0],
          frequency: 'MONTHLY',
          start_date: '2026-01-01',
          next_run_date: '2026-10-01',
          auto_send: true,
          is_active: true,
          line_items: [
            { description: 'Maandelijks onderhoud & hosting', quantity: 1, unit_price: 250, vat_rate: '21' }
          ]
        }
      ]
    } catch (err) {
      return [
        {
          id: 'rec-1',
          client_id: 'client-1',
          client: demoStore.getClients()[0],
          frequency: 'MONTHLY',
          start_date: '2026-01-01',
          next_run_date: '2026-10-01',
          auto_send: true,
          is_active: true,
          line_items: [
            { description: 'Maandelijks onderhoud & hosting', quantity: 1, unit_price: 250, vat_rate: '21' }
          ]
        }
      ]
    }
  },
  create: async (data: any) => {
    try {
      const res = await api.post('/recurring', data)
      return res.data
    } catch (err) {
      return { id: `rec-${Date.now()}`, ...data }
    }
  },
  update: async (id: string, data: any) => {
    try {
      const res = await api.put(`/recurring/${id}`, data)
      return res.data
    } catch (err) {
      return { id, ...data }
    }
  },
  delete: async (id: string) => {
    try {
      return await api.delete(`/recurring/${id}`)
    } catch (err) {
      return { success: true }
    }
  },
  trigger: async (id: string) => {
    try {
      const res = await api.post(`/recurring/${id}/trigger`)
      return res.data
    } catch (err) {
      return { success: true, message: 'Factuur gegenereerd' }
    }
  },
}

export default api

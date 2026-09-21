import axios from 'axios'
import { demoStore } from './demoData'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 4000,
})

// ── Helpers ────────────────────────────────────────────────────────────────

export const fmt = {
  currency: (n: number = 0) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0),
  date: (s: string) => {
    if (!s) return ''
    try {
      return new Date(s).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return s
    }
  },
  dateInput: (s: string) => s?.slice(0, 10) ?? '',
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardApi = {
  kpis: async () => {
    try {
      const res = await api.get('/dashboard/kpis')
      return res.data
    } catch (err) {
      console.info('Using local demo data for KPIs')
      return demoStore.getKPIs()
    }
  },
}

// ── Invoices ───────────────────────────────────────────────────────────────

export const invoicesApi = {
  list: async (params?: any) => {
    try {
      const res = await api.get('/invoices', { params })
      return res.data
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
    try {
      const res = await api.get(`/invoices/${id}`)
      return res.data
    } catch (err) {
      const found = demoStore.getInvoice(id)
      if (found) return found
      throw err
    }
  },
  create: async (data: any) => {
    try {
      const res = await api.post('/invoices', data)
      return res.data
    } catch (err) {
      return demoStore.saveInvoice(data)
    }
  },
  update: async (id: string, data: any) => {
    try {
      const res = await api.put(`/invoices/${id}`, data)
      return res.data
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
      return res.data
    } catch (err) {
      return demoStore.calculateVat(data)
    }
  },
}

// ── Clients ────────────────────────────────────────────────────────────────

export const clientsApi = {
  list: async (search?: string) => {
    try {
      const res = await api.get('/clients', { params: { search } })
      return res.data
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
    try {
      const res = await api.get(`/clients/${id}`)
      return res.data
    } catch (err) {
      return demoStore.getClients().find(c => c.id === id)
    }
  },
  create: async (data: any) => {
    try {
      const res = await api.post('/clients', data)
      return res.data
    } catch (err) {
      return demoStore.saveClient(data)
    }
  },
  update: async (id: string, data: any) => {
    try {
      const res = await api.put(`/clients/${id}`, data)
      return res.data
    } catch (err) {
      return demoStore.saveClient({ ...data, id })
    }
  },
  remove: async (id: string) => {
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
      return res.data
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
      return res.data
    } catch (err) {
      return demoStore.getBtwAangifte(`Q${quarter}`, String(year))
    }
  },
  quarters: async () => {
    try {
      const res = await api.get('/tax/quarters')
      return res.data
    } catch (err) {
      return ['2026-Q3', '2026-Q2', '2026-Q1', '2025-Q4']
    }
  },
}

// ── Expenses ───────────────────────────────────────────────────────────────

export const expensesApi = {
  list: async (params?: any) => {
    try {
      const res = await api.get('/expenses', { params })
      return res.data
    } catch (err) {
      return demoStore.getExpenses()
    }
  },
  create: async (data: any) => {
    try {
      const res = await api.post('/expenses', data)
      return res.data
    } catch (err) {
      return demoStore.saveExpense(data)
    }
  },
  delete: async (id: string) => {
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
    try {
      const res = await api.get('/settings')
      return res.data
    } catch (err) {
      return demoStore.getSettings()
    }
  },
  update: async (data: any) => {
    try {
      const res = await api.put('/settings', data)
      return res.data
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
      return res.data
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

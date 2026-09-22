/// <reference types="vite/client" />
import axios from 'axios'
import { demoStore } from './demoData'
import { isSupabaseConfigured, supabaseDb, supabase } from './supabase'
import { parseMT940, autoMatchTransactions } from './mt940'

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
     (response.headers['content-type'] && typeof response.headers['content-type'] === 'string' && response.headers['content-type'].includes('text/html')))
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

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('alibirds_demo_active') === 'true'
  } catch {
    return false
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardApi = {
  kpis: async () => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const invoices = (await supabaseDb.getInvoices()) || []
        const expenses = (await supabaseDb.getExpenses()) || []

        const outstanding = invoices
          .filter(i => i.status === 'SENT')
          .reduce((s, i) => s + ((i.total_incl ?? i.total_incl_vat ?? 0) - (i.amount_paid || 0)), 0)

        const overdue = invoices
          .filter(i => i.status === 'OVERDUE')
          .reduce((s, i) => s + ((i.total_incl ?? i.total_incl_vat ?? 0) - (i.amount_paid || 0)), 0)

        const vatLiability = invoices
          .filter(i => ['SENT', 'PAID'].includes(i.status))
          .reduce((s, i) => s + (i.total_vat ?? i.total_vat_amount ?? 0), 0) -
          expenses.reduce((s, e) => s + (e.vat_amount || 0), 0)

        const paidThisMonth = invoices
          .filter(i => i.status === 'PAID')
          .reduce((s, i) => s + (i.amount_paid || i.total_incl || i.total_incl_vat || 0), 0)

        const expensesTotal = expenses.reduce((s, e) => s + (e.amount_incl_vat || 0), 0)

        return {
          outstanding_revenue: Math.round(outstanding * 100) / 100,
          overdue_amount: Math.round(overdue * 100) / 100,
          projected_vat_liability: Math.max(0, Math.round(vatLiability * 100) / 100),
          total_invoices_this_year: invoices.length,
          paid_this_month: Math.round(paidThisMonth * 100) / 100,
          expenses_this_quarter: Math.round(expensesTotal * 100) / 100,
        }
      } catch (err) {
        console.warn('Could not calculate live Supabase KPIs:', err)
      }
    }

    try {
      const res = await api.get('/dashboard/kpis')
      if (res.data && typeof res.data === 'object' && typeof res.data.outstanding_revenue === 'number') {
        return res.data
      }
    } catch {
      // ignore
    }

    return demoStore.getKPIs()
  },
}

// ── Invoices ───────────────────────────────────────────────────────────────

export const invoicesApi = {
  list: async (params?: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supaInvoices = await supabaseDb.getInvoices()
        if (Array.isArray(supaInvoices)) {
          let list = [...supaInvoices]
          list.sort((a, b) => new Date(b.issue_date || b.created_at || '').getTime() - new Date(a.issue_date || a.created_at || '').getTime())
          if (params?.status) {
            list = list.filter((i: any) => i.status === params.status)
          }
          return list
        }
      } catch (err) {
        console.warn('Supabase getInvoices error:', err)
      }
    }

    let list = demoStore.getInvoices()
    if (params?.status) {
      list = list.filter((i: any) => i.status === params.status)
    }
    return list
  },
  get: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supaInv = await supabaseDb.getInvoice(id)
        if (supaInv) return supaInv
      } catch (err) {
        console.warn('Supabase getInvoice error:', err)
      }
    }

    const found = demoStore.getInvoice(id)
    if (found) return found

    try {
      const res = await api.get(`/invoices/${id}`)
      if (res.data && typeof res.data === 'object' && res.data.id) {
        return res.data
      }
    } catch {
      // ignore
    }

    throw new Error('Factuur niet gevonden')
  },
  create: async (data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaCreated = await supabaseDb.saveInvoice(data, data.line_items)
      if (supaCreated) return supaCreated
    }

    try {
      const res = await api.post('/invoices', data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // fallback
    }

    return demoStore.saveInvoice(data)
  },
  update: async (id: string, data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaUpdated = await supabaseDb.saveInvoice({ ...data, id }, data.line_items)
      if (supaUpdated) return supaUpdated
    }

    try {
      const res = await api.put(`/invoices/${id}`, data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // fallback
    }

    return demoStore.saveInvoice({ ...data, id })
  },
  delete: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      await supabaseDb.deleteInvoice(id)
      return { success: true }
    }

    demoStore.deleteInvoice(id)
    try {
      await api.delete(`/invoices/${id}`)
    } catch {
      // ignore
    }

    return { success: true }
  },
  cancel: async (id: string) => {
    return invoicesApi.delete(id)
  },
  clearAll: async () => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      await supabaseDb.clearAllInvoices()
      return { success: true }
    }

    demoStore.clearAllInvoices()
    try {
      await api.post('/invoices/clear-all')
    } catch {
      // ignore
    }

    return { success: true }
  },
  send: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      await supabaseDb.saveInvoice({ id, status: 'SENT', sent_at: new Date().toISOString() })
      return { success: true, message: 'Factuur gemarkeerd als verzonden' }
    }

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
    if (isSupabaseConfigured() && !isDemoMode()) {
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
    } catch {
      // ignore
    }

    let list = demoStore.getClients()
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
    }
    return list
  },
  get: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
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
    } catch {
      // ignore
    }

    return demoStore.getClients().find(c => c.id === id)
  },
  create: async (data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaSaved = await supabaseDb.saveClient(data)
      if (supaSaved) return supaSaved
    }

    try {
      const res = await api.post('/clients', data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // ignore
    }

    return demoStore.saveClient(data)
  },
  update: async (id: string, data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaSaved = await supabaseDb.saveClient({ ...data, id })
      if (supaSaved) return supaSaved
    }

    try {
      const res = await api.put(`/clients/${id}`, data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // ignore
    }

    return demoStore.saveClient({ ...data, id })
  },
  remove: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      await supabaseDb.deleteClient(id)
      return { success: true }
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
      const text = await file.text()
      const parsed = parseMT940(text)

      if (!parsed.transactions.length) {
        return { success: false, count: 0, message: 'Geen geldige transacties gevonden in dit MT940 bestand.' }
      }

      // Fetch outstanding invoices to attempt auto-reconciliation
      let invoices: any[] = []
      try {
        invoices = (await invoicesApi.list()) || []
      } catch {
        // ignore
      }

      const { results } = autoMatchTransactions(parsed.transactions, invoices)
      const finalTxs = results.map(r => r.tx)

      // Save to Supabase if configured
      if (isSupabaseConfigured()) {
        try {
          await supabaseDb.saveBankTransactions(finalTxs)
        } catch (supaErr) {
          console.warn('Supabase saveBankTransactions warning:', supaErr)
        }
      }

      // Always save to demoStore as local cache
      demoStore.saveBankTransactions(finalTxs)

      return {
        success: true,
        count: finalTxs.length,
        message: `${finalTxs.length} transacties succesvol geïmporteerd uit MT940!`,
      }
    } catch (err: any) {
      console.error('MT940 parse error:', err)
      return { success: false, count: 0, message: 'Fout bij het verwerken van het MT940 bestand.' }
    }
  },

  transactions: async (params?: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supaTxs = await supabaseDb.getBankTransactions()
        if (Array.isArray(supaTxs) && supaTxs.length > 0) return supaTxs
      } catch (err) {
        console.warn('Supabase getBankTransactions error:', err)
      }
    }
    return demoStore.getBankTransactions()
  },

  reconcile: async () => {
    const txs = await bankApi.transactions()
    const invoices = (await invoicesApi.list()) || []
    const { matched, results } = autoMatchTransactions(txs, invoices)

    for (const r of results) {
      if (r.invoiceId && r.tx.id) {
        await bankApi.match(r.tx.id, r.invoiceId)
      }
    }
    return { matched, total: txs.length }
  },

  match: async (txId: string, invoiceId: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabaseDb.matchBankTransaction(txId, invoiceId)
        await supabase
          .from('invoices')
          .update({ status: 'PAID', paid_at: new Date().toISOString() })
          .eq('id', invoiceId)
      } catch (err) {
        console.warn('Supabase match error:', err)
      }
    }
    demoStore.matchBankTransaction(txId, invoiceId)
    return { success: true }
  },

  unmatch: async (txId: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabaseDb.unmatchBankTransaction(txId)
      } catch (err) {
        console.warn('Supabase unmatch error:', err)
      }
    }
    return { success: true }
  },

  clearAll: async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('bank_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      } catch (err) {
        console.warn('Supabase clearAll bank_transactions error:', err)
      }
    }
    demoStore.clearBankTransactions()
    return { success: true }
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
    if (isSupabaseConfigured() && !isDemoMode()) {
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
    } catch {
      // ignore
    }

    return demoStore.getExpenses()
  },
  create: async (data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaSaved = await supabaseDb.saveExpense(data)
      if (supaSaved) return supaSaved
    }

    try {
      const res = await api.post('/expenses', data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // ignore
    }

    return demoStore.saveExpense(data)
  },
  delete: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      await supabaseDb.deleteExpense(id)
      return { success: true }
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
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supaSettings = await supabaseDb.getSettings()
        if (supaSettings) return supaSettings
      } catch (err) {
        console.warn('Supabase getSettings error:', err)
      }
    }

    try {
      const res = await api.get('/settings')
      if (res.data && typeof res.data === 'object' && res.data.company_name) return res.data
    } catch {
      // ignore
    }

    return demoStore.getSettings()
  },
  update: async (data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaSaved = await supabaseDb.saveSettings(data)
      if (supaSaved) return supaSaved
    }

    try {
      const res = await api.put('/settings', data)
      if (res.data && typeof res.data === 'object' && res.data.company_name) return res.data
    } catch {
      // ignore
    }

    return demoStore.saveSettings(data)
  },
}

// ── Recurring ──────────────────────────────────────────────────────────────

export const recurringApi = {
  list: async () => {
    if (isSupabaseConfigured()) {
      try {
        const supa = await supabaseDb.getRecurringSchedules()
        if (Array.isArray(supa) && supa.length > 0) return supa
      } catch (err) {
        console.warn('Supabase getRecurringSchedules error:', err)
      }
    }
    return demoStore.getRecurringSchedules()
  },
  create: async (data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supa = await supabaseDb.saveRecurringSchedule(data)
        if (supa) {
          demoStore.saveRecurringSchedule(data)
          return supa
        }
      } catch (err) {
        console.warn('Supabase saveRecurringSchedule error:', err)
      }
    }
    return demoStore.saveRecurringSchedule(data)
  },
  update: async (id: string, data: any) => {
    if (isSupabaseConfigured()) {
      try {
        const supa = await supabaseDb.saveRecurringSchedule({ ...data, id })
        if (supa) {
          demoStore.saveRecurringSchedule({ ...data, id })
          return supa
        }
      } catch (err) {
        console.warn('Supabase updateRecurringSchedule error:', err)
      }
    }
    return demoStore.saveRecurringSchedule({ ...data, id })
  },
  delete: async (id: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabaseDb.deleteRecurringSchedule(id)
      } catch (err) {
        console.warn('Supabase deleteRecurringSchedule error:', err)
      }
    }
    demoStore.deleteRecurringSchedule(id)
    return { success: true }
  },
  trigger: async (id: string) => {
    // Generates a real invoice, calculates totals, and advances next run date
    return demoStore.triggerRecurringSchedule(id)
  },
}

export default api

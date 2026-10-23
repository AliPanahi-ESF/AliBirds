/// <reference types="vite/client" />
import axios from 'axios'
import { demoStore } from './demoData'
import { isSupabaseConfigured, supabaseDb, supabase } from './supabase'
import { parseMT940, autoMatchTransactions } from './mt940'
import { scanReceiptFile } from './ocrScanner'
import { classifySalesReverseChargeRubric, isEuCountry, roundBelastingdienst } from './vatCalculator'
import { BtwAangifte } from './types'

const api = axios.create({
  baseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api',
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
      return []
    }

    if (!isDemoMode()) return []

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

    if (isDemoMode()) {
      const found = demoStore.getInvoice(id)
      if (found) return found
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
      const supaUpdated = await supabaseDb.updateInvoice(id, data, data.line_items)
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
    await invoicesApi.update(id, { status: 'SENT', sent_at: new Date().toISOString() })
    return { success: true, message: 'Factuur gemarkeerd als verzonden' }
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

// ── Quotations & Digital Signatures (Offertes) ──────────────────────────────

export const quotationsApi = {
  list: async (params?: { status?: string }) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supaQuotes = await supabaseDb.getQuotations()
        if (Array.isArray(supaQuotes)) {
          let list = [...supaQuotes]
          if (params?.status) {
            list = list.filter((q: any) => q.status === params.status)
          }
          return list
        }
      } catch (err) {
        console.warn('Supabase getQuotations error:', err)
      }
      return []
    }

    if (!isDemoMode()) return []

    let list = demoStore.getQuotations()
    if (params?.status) {
      list = list.filter((q: any) => q.status === params.status)
    }
    return list
  },

  get: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supaQuote = await supabaseDb.getQuotation(id)
        if (supaQuote) return supaQuote
      } catch (err) {
        console.warn('Supabase getQuotation error:', err)
      }
    }

    if (isDemoMode()) {
      const found = demoStore.getQuotation(id)
      if (found) return found
    }

    try {
      const res = await api.get(`/quotations/${id}`)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // ignore
    }

    throw new Error('Offerte niet gevonden')
  },

  getPublic: async (tokenOrId: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supaQuote = await supabaseDb.getPublicQuotation(tokenOrId)
        if (supaQuote) return supaQuote
      } catch (err) {
        console.warn('Supabase getPublicQuotation error:', err)
      }
    }
    return quotationsApi.get(tokenOrId)
  },

  create: async (data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaCreated = await supabaseDb.saveQuotation(data)
      if (supaCreated) return supaCreated
    }

    try {
      const res = await api.post('/quotations', data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // fallback
    }

    return demoStore.saveQuotation(data)
  },

  update: async (id: string, data: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaUpdated = await supabaseDb.saveQuotation({ ...data, id })
      if (supaUpdated) return supaUpdated
    }

    try {
      const res = await api.put(`/quotations/${id}`, data)
      if (res.data && typeof res.data === 'object' && res.data.id) return res.data
    } catch {
      // fallback
    }

    return demoStore.saveQuotation({ ...data, id })
  },

  delete: async (id: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      await supabaseDb.deleteQuotation(id)
      return { success: true }
    }

    demoStore.deleteQuotation(id)
    try {
      await api.delete(`/quotations/${id}`)
    } catch {
      // ignore
    }

    return { success: true }
  },

  signPublicly: async (id: string, signatureDataUrl: string, signedByName: string) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      const supaSigned = await supabaseDb.signQuotationPublicly(id, signatureDataUrl, signedByName)
      if (supaSigned) return supaSigned
    }

    return demoStore.signQuotationPublicly(id, signatureDataUrl, signedByName)
  },

  convertToInvoice: async (id: string) => {
    const quote = await quotationsApi.get(id)
    if (!quote) throw new Error('Offerte niet gevonden')

    const today = new Date().toISOString().slice(0, 10)
    const due14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)
    const settings = await settingsApi.get()
    const prefix = settings?.invoice_prefix || `${new Date().getFullYear()}-`
    const seq = Number(settings?.next_invoice_sequence) || 1
    const invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`

    const createdInvoice = await invoicesApi.create({
      invoice_number: invoiceNumber,
      client_id: quote.client_id,
      issue_date: today,
      delivery_date: today,
      due_date: due14,
      calculation_mode: quote.calculation_mode || 'EXCLUSIVE',
      status: 'DRAFT',
      notes: `Gegenereerd uit geaccepteerde offerte ${quote.quotation_number}.\n${quote.notes || ''}`.trim(),
      line_items: quote.line_items,
    })

    await quotationsApi.update(id, {
      status: 'CONVERTED',
      converted_invoice_id: createdInvoice.id,
    })

    return {
      success: true,
      invoice_id: createdInvoice.id,
      invoice_number: createdInvoice.invoice_number,
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

      // Fetch outstanding invoices & expenses to attempt auto-reconciliation
      let invoices: any[] = []
      let expenses: any[] = []
      try {
        invoices = (await invoicesApi.list()) || []
        expenses = (await expensesApi.list()) || []
      } catch {
        // ignore
      }

      const { results } = autoMatchTransactions(parsed.transactions, invoices, expenses)
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

      // Automatically connect high-confidence matches (score >= 95: betalingskenmerk or exact invoice number)
      let autoMatchedInvoices = 0
      for (const r of results) {
        if (r.invoiceId && r.tx.id && (r.score ?? 0) >= 95) {
          try {
            await bankApi.match(r.tx.id, r.invoiceId)
            autoMatchedInvoices++
          } catch (mErr) {
            console.warn('Auto reconciliation match error:', mErr)
          }
        }
      }

      const autoNote = autoMatchedInvoices > 0
        ? ` Waarvan ${autoMatchedInvoices} betaling(en) direct automatisch verbonden met facturen via betalingskenmerk!`
        : ''

      return {
        success: true,
        count: finalTxs.length,
        autoMatchedInvoices,
        message: `${finalTxs.length} transacties succesvol verwerkt!${autoNote}`,
      }
    } catch (err: any) {
      console.error('MT940 parse error:', err)
      return { success: false, count: 0, message: 'Fout bij het verwerken van het MT940 bestand.' }
    }
  },

  transactions: async (params?: any) => {
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supaTxs = await supabaseDb.getBankTransactions()
        if (Array.isArray(supaTxs)) return supaTxs
      } catch (err) {
        console.warn('Supabase getBankTransactions error:', err)
      }
      return []
    }
    return isDemoMode() ? demoStore.getBankTransactions() : []
  },

  reconcile: async () => {
    const txs = await bankApi.transactions()
    const invoices = (await invoicesApi.list()) || []
    const expenses = (await expensesApi.list()) || []
    const { matched, results } = autoMatchTransactions(txs, invoices, expenses)

    for (const r of results) {
      if (r.invoiceId && r.tx.id) {
        await bankApi.match(r.tx.id, r.invoiceId)
      } else if (r.expenseId && r.tx.id) {
        await bankApi.matchExpense(r.tx.id, r.expenseId)
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

  matchExpense: async (txId: string, expenseId: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabaseDb.matchBankTransactionToExpense(txId, expenseId)
      } catch (err) {
        console.warn('Supabase matchExpense error:', err)
      }
    }
    demoStore.matchBankTransactionToExpense(txId, expenseId)
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
    demoStore.unmatchBankTransaction(txId)
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
  btw: async (year: number = 2026, quarter: number = 3): Promise<BtwAangifte> => {
    // 1. Determine quarter date bounds
    const qStartMonth = (quarter - 1) * 3 + 1
    const qEndMonth = quarter * 3
    const startStr = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
    const lastDays = [31, quarter === 1 ? (year % 4 === 0 ? 29 : 28) : (quarter === 2 ? 30 : (quarter === 3 ? 30 : 31)), 31]
    const endStr = `${year}-${String(qEndMonth).padStart(2, '0')}-${lastDays[quarter - 1] || 31}`

    try {
      // 2. Fetch live invoices and expenses
      const invoices = (await invoicesApi.list()) || []
      const expenses = (await expensesApi.list()) || []

      let t21 = 0, v21 = 0
      let t9 = 0, v9 = 0
      let t0 = 0
      let t1e = 0
      let t3a = 0
      let t3b = 0
      let t4a = 0, v4a = 0
      let t4b = 0, v4b = 0

      // 1. Sales Invoices
      for (const inv of invoices) {
        if (!['SENT', 'PAID', 'OVERDUE'].includes(inv.status)) continue
        const invDate = inv.issue_date || (inv as any).created_at || ''
        if (invDate < startStr || invDate > endStr) continue

        const clientCountry = inv.client?.country_code
        const clientVat = inv.client?.vat_number

        for (const item of (inv.line_items || [])) {
          const excl = Number(item.line_total_excl ?? ((Number(item.quantity) || 1) * (Number(item.unit_price) || 0))) || 0
          const vat = Number(item.vat_amount || 0)

          if (item.vat_rate === '21') {
            t21 += excl
            v21 += vat
          } else if (item.vat_rate === '9') {
            t9 += excl
            v9 += vat
          } else if (item.vat_rate === '0') {
            if (clientCountry && clientCountry !== 'NL' && !isEuCountry(clientCountry)) {
              t3a += excl
            } else {
              t0 += excl
            }
          } else if (item.vat_rate === 'REVERSE_CHARGE') {
            const rubric = classifySalesReverseChargeRubric(clientCountry, clientVat)
            if (rubric === '3b') {
              t3b += excl
            } else {
              t1e += excl
            }
          }
        }
      }

      // 2. Expenses (Voorbelasting & Foreign Reverse Charge Rubrieken 4a en 4b)
      let domesticVoorbelasting = 0
      for (const exp of expenses) {
        if ((exp as any).is_deductible === false) continue
        const expDate = exp.expense_date || (exp as any).date || (exp as any).created_at || ''
        if (expDate < startStr || expDate > endStr) continue

        const excl = Number(exp.amount_excl_vat || 0)
        const isReverseCharge = exp.vat_rate === 'REVERSE_CHARGE' || exp.category === 'SOFTWARE_EU' || exp.category === 'SOFTWARE_NON_EU'

        if (isReverseCharge) {
          const vendor = ((exp.vendor_name || '') + ' ' + (exp.description || '')).toLowerCase()
          const isNonEu = exp.category === 'SOFTWARE_NON_EU' || vendor.includes('openai') || vendor.includes('aws') || vendor.includes('amazon') || vendor.includes('notion') || vendor.includes('figma') || vendor.includes('us') || vendor.includes('united states')

          const vatOnReverseCharge = Math.round(excl * 21) / 100
          if (isNonEu) {
            t4a += excl
            v4a += vatOnReverseCharge
          } else {
            t4b += excl
            v4b += vatOnReverseCharge
          }
          domesticVoorbelasting += vatOnReverseCharge
        } else {
          domesticVoorbelasting += Number(exp.vat_amount || 0)
        }
      }

      const totalTurnover1e = Math.round((t0 + t1e) * 100) / 100
      const totalOutputTax = Math.round((v21 + v9 + v4a + v4b) * 100) / 100
      const roundedVoorbelasting = Math.round(domesticVoorbelasting * 100) / 100
      const teBetalen = Math.round((totalOutputTax - roundedVoorbelasting) * 100) / 100

      // Whole-euro amounts as required by Belastingdienst portal:
      const wholeTurnover1a = roundBelastingdienst(t21, 'TURNOVER_OR_DUE')
      const wholeTax1a = roundBelastingdienst(v21, 'TURNOVER_OR_DUE')
      const wholeTurnover1b = roundBelastingdienst(t9, 'TURNOVER_OR_DUE')
      const wholeTax1b = roundBelastingdienst(v9, 'TURNOVER_OR_DUE')
      const wholeTurnover1e = roundBelastingdienst(totalTurnover1e, 'TURNOVER_OR_DUE')
      const wholeTurnover3a = roundBelastingdienst(t3a, 'TURNOVER_OR_DUE')
      const wholeTurnover3b = roundBelastingdienst(t3b, 'TURNOVER_OR_DUE')
      const wholeTurnover4a = roundBelastingdienst(t4a, 'TURNOVER_OR_DUE')
      const wholeTax4a = roundBelastingdienst(v4a, 'TURNOVER_OR_DUE')
      const wholeTurnover4b = roundBelastingdienst(t4b, 'TURNOVER_OR_DUE')
      const wholeTax4b = roundBelastingdienst(v4b, 'TURNOVER_OR_DUE')
      const wholeVoorbelasting = roundBelastingdienst(roundedVoorbelasting, 'VOORBELASTING')
      const wholeTeBetalen = (wholeTax1a + wholeTax1b + wholeTax4a + wholeTax4b) - wholeVoorbelasting

      return {
        quarter: `${year}-Q${quarter}`,
        start_date: startStr,
        end_date: endStr,
        rubrics: {
          '1a': { code: '1a', description: 'Leveringen/diensten belast met hoog tarief (21%)', turnover: Math.round(t21 * 100) / 100, tax: Math.round(v21 * 100) / 100, turnover_whole: wholeTurnover1a, tax_whole: wholeTax1a },
          '1b': { code: '1b', description: 'Leveringen/diensten belast met laag tarief (9%)', turnover: Math.round(t9 * 100) / 100, tax: Math.round(v9 * 100) / 100, turnover_whole: wholeTurnover1b, tax_whole: wholeTax1b },
          '1c': { code: '1c', description: 'Leveringen/diensten belast met overige tarieven behalve 0%', turnover: 0, tax: 0, turnover_whole: 0, tax_whole: 0 },
          '1e': { code: '1e', description: 'Leveringen/diensten belast met 0% of niet bij u belast', turnover: totalTurnover1e, tax: 0, turnover_whole: wholeTurnover1e, tax_whole: 0 },
          '3a': { code: '3a', description: 'Leveringen naar landen buiten de EU (uitvoer)', turnover: Math.round(t3a * 100) / 100, tax: 0, turnover_whole: wholeTurnover3a, tax_whole: 0 },
          '3b': { code: '3b', description: 'Leveringen naar/diensten in landen binnen de EU (ICP)', turnover: Math.round(t3b * 100) / 100, tax: 0, turnover_whole: wholeTurnover3b, tax_whole: 0 },
          '4a': { code: '4a', description: 'Leveringen/diensten uit landen buiten de EU (Invoer)', turnover: Math.round(t4a * 100) / 100, tax: Math.round(v4a * 100) / 100, turnover_whole: wholeTurnover4a, tax_whole: wholeTax4a },
          '4b': { code: '4b', description: 'Leveringen/diensten uit landen binnen de EU (Btw verlegd)', turnover: Math.round(t4b * 100) / 100, tax: Math.round(v4b * 100) / 100, turnover_whole: wholeTurnover4b, tax_whole: wholeTax4b },
          '5b': { code: '5b', description: 'Voorbelasting (btw op zakelijke kosten en investeringen)', turnover: 0, tax: roundedVoorbelasting, tax_whole: wholeVoorbelasting },
        },
        voorbelasting: roundedVoorbelasting,
        te_betalen: teBetalen,
        voorbelasting_whole: wholeVoorbelasting,
        te_betalen_whole: wholeTeBetalen,
      }
    } catch {
      if (isDemoMode()) {
        return demoStore.getBtwAangifte(`Q${quarter}`, String(year))
      }
      return {
        quarter: `${year}-Q${quarter}`,
        start_date: startStr,
        end_date: endStr,
        rubrics: {},
        voorbelasting: 0,
        te_betalen: 0,
      }
    }
  },

  icp: async (year: number = 2026, quarter: number = 3) => {
    const qStartMonth = (quarter - 1) * 3 + 1
    const qEndMonth = quarter * 3
    const startStr = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
    const lastDays = [31, quarter === 1 ? (year % 4 === 0 ? 29 : 28) : (quarter === 2 ? 30 : (quarter === 3 ? 30 : 31)), 31]
    const endStr = `${year}-${String(qEndMonth).padStart(2, '0')}-${lastDays[quarter - 1] || 31}`

    const invoices = (await invoicesApi.list()) || []
    const clientMap: Record<string, { country_code: string; vat_number: string; client_name: string; turnover: number; supply_type: 'DIENSTEN' | 'GOEDEREN' }> = {}

    for (const inv of invoices) {
      if (!['SENT', 'PAID', 'OVERDUE'].includes(inv.status)) continue
      const invDate = inv.issue_date || (inv as any).created_at || ''
      if (invDate < startStr || invDate > endStr) continue

      const hasReverseCharge = inv.is_reverse_charge || inv.line_items?.some(i => i.vat_rate === 'REVERSE_CHARGE')
      if (!hasReverseCharge) continue

      const client = inv.client
      const clientVat = client?.vat_number || ''
      const rawCountry = (client?.country_code || (clientVat.length >= 2 ? clientVat.slice(0, 2) : '')).toUpperCase()

      // ICP is strictly for EU B2B cross-border supplies (excludes NL domestic reverse charge and non-EU)
      if (!rawCountry || rawCountry === 'NL' || !isEuCountry(rawCountry)) {
        continue
      }

      const clientName = client?.name || 'Onbekende EU Klant'
      const excl = (inv.line_items || [])
        .filter(i => i.vat_rate === 'REVERSE_CHARGE')
        .reduce((s, i) => s + (Number(i.line_total_excl) || 0), 0)

      if (excl > 0) {
        const key = `${rawCountry}-${clientVat}`
        if (!clientMap[key]) {
          clientMap[key] = {
            country_code: rawCountry,
            vat_number: clientVat || 'Onbekend BTW-id',
            client_name: clientName,
            turnover: 0,
            supply_type: 'DIENSTEN',
          }
        }
        clientMap[key].turnover += excl
      }
    }

    const items = Object.values(clientMap).map(i => ({
      ...i,
      turnover: Math.round(i.turnover * 100) / 100,
    }))

    const totalAmount = items.reduce((s, i) => s + i.turnover, 0)

    return {
      quarter: `${year}-Q${quarter}`,
      year,
      total_amount: Math.round(totalAmount * 100) / 100,
      items,
    }
  },

  quarters: async () => {
    return ['2026-Q4', '2026-Q3', '2026-Q2', '2026-Q1', '2025-Q4']
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
  scanReceipt: async (file: File) => {
    return scanReceiptFile(file)
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

    if (!isDemoMode()) {
      return {
        id: 'settings-new',
        company_name: '',
        trade_name: '',
        kvk_number: '',
        btw_id: '',
        iban: '',
        bic: '',
        address_street: '',
        address_city: '',
        address_postcode: '',
        address_country: 'NL',
        phone: '',
        email: '',
        website: '',
        default_payment_term_days: 14,
        invoice_prefix: `${new Date().getFullYear()}-`,
        next_invoice_sequence: 1,
        invoice_notes_default: 'Graag betalen binnen 14 dagen o.v.v. het factuurnummer.',
        accent_color: '#4f46e5',
        font_family: 'Inter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
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
    if (isSupabaseConfigured() && !isDemoMode()) {
      try {
        const supa = await supabaseDb.getRecurringSchedules()
        if (Array.isArray(supa)) return supa
      } catch (err) {
        console.warn('Supabase getRecurringSchedules error:', err)
      }
      return []
    }
    return isDemoMode() ? demoStore.getRecurringSchedules() : []
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

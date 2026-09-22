// Shared TypeScript types matching the backend Pydantic schemas

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type CalcMode = 'EXCLUSIVE' | 'INCLUSIVE'
export type VATRate = '21' | '9' | '0' | 'REVERSE_CHARGE'
export type ReconciliationStatus = 'MATCHED' | 'UNMATCHED' | 'PENDING_CONFIRMATION' | 'MANUAL'
export type TransactionType = 'CREDIT' | 'DEBIT'

export interface User {
  id: string
  name: string
  email: string
  company_name?: string
  is_onboarded: boolean
  avatar_url?: string
}

export interface Client {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  vat_number?: string
  kvk_number?: string
  billing_address_street?: string
  billing_address_city?: string
  billing_address_postcode?: string
  country_code: string
  default_payment_term_days: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: VATRate
  vat_amount: number
  line_total_excl: number
  line_total_incl: number
  sort_order: number
}

export interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  client?: Client
  issue_date: string
  delivery_date?: string
  due_date: string
  status: InvoiceStatus
  calculation_mode: CalcMode
  subtotal_excl_vat: number
  subtotal_excl?: number
  total_vat_amount: number
  total_vat?: number
  total_incl_vat: number
  total_incl?: number
  amount_paid: number
  payment_reference?: string
  notes?: string
  pdf_path?: string
  sent_at?: string
  paid_at?: string
  line_items: LineItem[]
  payment_link?: string
  created_at: string
  updated_at: string
}

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED'

export interface Quotation {
  id: string
  quotation_number: string
  client_id?: string
  client?: Client
  issue_date: string
  valid_until_date: string
  status: QuotationStatus
  calculation_mode?: CalcMode
  subtotal_excl: number
  total_vat: number
  total_amount: number
  notes?: string
  disclaimer?: string
  signature_data_url?: string
  signed_by_name?: string
  signed_at?: string
  converted_invoice_id?: string
  line_items: LineItem[]
  created_at: string
  updated_at: string
}

export interface BankTransaction {
  id: string
  transaction_date: string
  value_date?: string
  amount: number
  currency: string
  // 'type' and 'transaction_type' are both used — type is the canonical frontend field,
  // transaction_type is the DB column name (CREDIT/DEBIT)
  type: TransactionType
  transaction_type?: TransactionType
  counterpart_name?: string
  counterpart_iban?: string
  // Aliases used by MT940 parser and bank reconciliation (match DB column names)
  contra_account_name?: string
  contra_account_iban?: string
  remittance_reference?: string
  description?: string
  raw_reference?: string
  raw_hash?: string
  match_score?: number
  reconciliation_status: ReconciliationStatus
  matched_invoice_id?: string
  matched_expense_id?: string
  imported_at: string
}

export interface Expense {
  id: string
  vendor_name: string
  expense_date: string
  description?: string
  category: string
  amount_excl_vat: number
  vat_rate: string
  vat_amount: number
  amount_incl_vat: number
  receipt_file_path?: string
  receipt_url?: string
  receipt_filename?: string
  ocr_status?: 'PENDING' | 'PROCESSED' | 'FAILED'
  ocr_raw_json?: any
  notes?: string
  created_at: string
  updated_at: string
}

export interface OCRParsedResult {
  vendor_name?: string
  expense_date?: string
  amount_excl_vat?: number
  vat_rate?: string
  vat_amount?: number
  amount_incl_vat?: number
  category?: string
  description?: string
  receipt_url?: string
  receipt_filename?: string
  confidence?: number
  raw_text?: string
}

export interface BtwRubric {
  code: string
  description: string
  turnover: number
  tax: number
}

export interface BtwAangifte {
  quarter: string
  start_date: string
  end_date: string
  rubrics: Record<string, BtwRubric>
  voorbelasting: number
  te_betalen: number
}

export interface DashboardKPIs {
  outstanding_revenue: number
  overdue_amount: number
  projected_vat_liability: number
  total_invoices_this_year: number
  paid_this_month: number
  expenses_this_quarter: number
}

export interface BusinessSettings {
  id: string
  company_name: string
  trade_name?: string
  kvk_number?: string
  btw_id?: string
  iban?: string
  bic?: string
  address_street?: string
  address_city?: string
  address_postcode?: string
  address_country: string
  phone?: string
  email?: string
  website?: string
  default_payment_term_days: number
  invoice_prefix: string
  next_invoice_sequence: number
  invoice_notes_default?: string
  logo_url?: string
  accent_color: string
  font_family: string
  payment_link?: string
  created_at: string
  updated_at: string
}

export interface RecurringLineItemTemplate {
  description: string
  quantity: number
  unit_price: number
  vat_rate: string
}

export interface RecurringSchedule {
  id: string
  name: string
  client_id: string
  client?: Client
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  start_date: string
  next_run_date: string
  payment_term_days: number
  auto_send_email: boolean
  is_active: boolean
  notes_template?: string
  calculation_mode?: 'EXCLUSIVE' | 'INCLUSIVE'
  line_items_template: RecurringLineItemTemplate[]
  created_at: string
  updated_at: string
}


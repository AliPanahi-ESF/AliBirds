-- ==============================================================================
-- AliBirds — Supabase PostgreSQL Schema (v2 — Multi-tenant Auth Edition)
-- Dutch ZZP & Studio Invoicing, Expenses, MT940 & Btw-Aangifte
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Go to the "SQL Editor" tab on the left menu.
-- 3. Click "New Query", paste this entire script, and click "Run".
--
-- What this script does:
-- - Cleans up old v1 tables and leftover test data (wipes old invoices/clients)
-- - Recreates all tables with a dedicated "user_id" linked to Supabase Auth
-- - Configures Row Level Security (RLS) so each user only sees their own data
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean Reset: Drop old tables if they exist without user_id
-- (This removes previous sample data and ensures clean schema definitions)
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS invoice_line_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS business_settings CASCADE;

-- 3. Business Settings Table (One company profile per user)
CREATE TABLE business_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL DEFAULT 'Mijn ZZP Studio',
    trading_name TEXT,
    kvk_number VARCHAR(8) NOT NULL DEFAULT '12345678',
    vat_number VARCHAR(20) NOT NULL DEFAULT 'NL123456789B01',
    iban VARCHAR(34) NOT NULL DEFAULT 'NL00BANK0123456789',
    bic VARCHAR(11) DEFAULT 'TESTNL2A',
    address_street TEXT NOT NULL DEFAULT 'Keizersgracht 100',
    address_city TEXT NOT NULL DEFAULT 'Amsterdam',
    address_postcode VARCHAR(10) NOT NULL DEFAULT '1015 AA',
    country_code VARCHAR(2) NOT NULL DEFAULT 'NL',
    email TEXT DEFAULT 'info@studio.nl',
    phone TEXT,
    website TEXT,
    logo_base64 TEXT,
    accent_color VARCHAR(7) DEFAULT '#4f46e5',
    invoice_prefix VARCHAR(20) DEFAULT '2026-',
    default_payment_term_days INT DEFAULT 14,
    next_invoice_sequence INT DEFAULT 1,
    default_vat_rate VARCHAR(20) DEFAULT '21',
    invoice_notes_default TEXT,
    payment_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT business_settings_user_id_unique UNIQUE (user_id)
);

-- 4. Clients Table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    vat_number TEXT,
    kvk_number TEXT,
    billing_address_street TEXT,
    billing_address_city TEXT,
    billing_address_postcode TEXT,
    country_code VARCHAR(2) DEFAULT 'NL',
    default_payment_term_days INT DEFAULT 14,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Invoices Table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    delivery_date DATE,
    calc_mode VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE', -- EXCLUSIVE or INCLUSIVE
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',        -- DRAFT, SENT, PAID, OVERDUE, CANCELLED
    reference TEXT,
    notes TEXT,
    payment_terms TEXT,
    payment_link TEXT,
    pdf_path TEXT,
    subtotal_excl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_vat NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_incl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_reverse_charge BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT invoices_user_id_invoice_number_unique UNIQUE (user_id, invoice_number)
);

-- 6. Invoice Line Items Table
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_rate VARCHAR(20) NOT NULL DEFAULT '21', -- 21, 9, 0, REVERSE_CHARGE
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_total_excl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_total_incl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Expenses Table
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Algemeen',
    amount_excl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_rate VARCHAR(20) NOT NULL DEFAULT '21',
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_incl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    receipt_path TEXT,
    payment_method VARCHAR(50) DEFAULT 'BANK',
    is_deductible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Bank Transactions Table (MT940)
CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    statement_number TEXT,
    sequence_number TEXT,
    value_date DATE NOT NULL,
    entry_date DATE,
    transaction_type VARCHAR(10) NOT NULL, -- CREDIT or DEBIT
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    contra_account_iban TEXT,
    contra_account_name TEXT,
    description TEXT,
    transaction_code TEXT,
    raw_reference TEXT,
    reconciliation_status VARCHAR(30) DEFAULT 'UNMATCHED', -- MATCHED, UNMATCHED, MANUAL
    matched_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    matched_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    match_score NUMERIC(5, 2),
    raw_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT bank_transactions_user_id_raw_hash_unique UNIQUE (user_id, raw_hash)
);

-- 9. Recurring Schedules Table
CREATE TABLE IF NOT EXISTS recurring_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY', -- WEEKLY, MONTHLY, QUARTERLY, YEARLY
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_term_days INT DEFAULT 14,
    auto_send_email BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes_template TEXT,
    calculation_mode VARCHAR(20) DEFAULT 'EXCLUSIVE',
    line_items_template JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Enable Row Level Security (RLS) on all tables
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;

-- 10. Drop any old policies to prevent collision errors
DROP POLICY IF EXISTS "Public or anon access to business_settings" ON business_settings;
DROP POLICY IF EXISTS "Users manage own business_settings" ON business_settings;

DROP POLICY IF EXISTS "Public or anon access to clients" ON clients;
DROP POLICY IF EXISTS "Users manage own clients" ON clients;

DROP POLICY IF EXISTS "Public or anon access to invoices" ON invoices;
DROP POLICY IF EXISTS "Users manage own invoices" ON invoices;

DROP POLICY IF EXISTS "Public or anon access to invoice_line_items" ON invoice_line_items;
DROP POLICY IF EXISTS "Users manage own invoice_line_items" ON invoice_line_items;

DROP POLICY IF EXISTS "Public or anon access to expenses" ON expenses;
DROP POLICY IF EXISTS "Users manage own expenses" ON expenses;

DROP POLICY IF EXISTS "Public or anon access to bank_transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Users manage own bank_transactions" ON bank_transactions;

-- 11. Per-User RLS Policies (Users can ONLY view/insert/update/delete their own data)
CREATE POLICY "Users manage own business_settings"
  ON business_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own clients"
  ON clients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own invoices"
  ON invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Invoice line items inherit ownership from their parent invoice
CREATE POLICY "Users manage own invoice_line_items"
  ON invoice_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own expenses"
  ON expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own bank_transactions"
  ON bank_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own recurring_schedules"
  ON recurring_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);




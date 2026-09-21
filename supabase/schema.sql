-- ==============================================================================
-- AliBirds — Supabase PostgreSQL Schema
-- Dutch ZZP & Studio Invoicing, Expenses, MT940 & Btw-Aangifte
-- ==============================================================================
-- Paste this entire script into your Supabase Dashboard:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Business Settings Table
CREATE TABLE IF NOT EXISTS business_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 4. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    delivery_date DATE,
    calc_mode VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE', -- EXCLUSIVE or INCLUSIVE
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',        -- DRAFT, SENT, PAID, OVERDUE, CANCELLED
    reference TEXT,
    notes TEXT,
    payment_terms TEXT,
    pdf_path TEXT,
    subtotal_excl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_vat NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_incl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_reverse_charge BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Invoice Line Items Table
CREATE TABLE IF NOT EXISTS invoice_line_items (
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

-- 6. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 7. Bank Transactions Table (MT940)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    raw_hash VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable Row Level Security (RLS) & Allow Authenticated Access
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated access for project
CREATE POLICY "Public or anon access to business_settings" ON business_settings FOR ALL USING (true);
CREATE POLICY "Public or anon access to clients" ON clients FOR ALL USING (true);
CREATE POLICY "Public or anon access to invoices" ON invoices FOR ALL USING (true);
CREATE POLICY "Public or anon access to invoice_line_items" ON invoice_line_items FOR ALL USING (true);
CREATE POLICY "Public or anon access to expenses" ON expenses FOR ALL USING (true);
CREATE POLICY "Public or anon access to bank_transactions" ON bank_transactions FOR ALL USING (true);

-- Insert default business settings row if none exists
INSERT INTO business_settings (
    company_name, kvk_number, vat_number, iban, bic,
    address_street, address_city, address_postcode, country_code,
    invoice_prefix, default_payment_term_days
)
SELECT
    'Ali Creative Studio', '87654321', 'NL123456789B01', 'NL99INGB0001234567', 'INGBNL2A',
    'Singel 250', 'Amsterdam', '1016 AB', 'NL',
    '2026-', 14
WHERE NOT EXISTS (SELECT 1 FROM business_settings LIMIT 1);

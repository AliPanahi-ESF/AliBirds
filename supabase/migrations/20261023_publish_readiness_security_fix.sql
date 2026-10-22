-- ==============================================================================
-- AliBirds Publish-Readiness Security & Integrity Migration
-- Run this script in the Supabase SQL Editor.
-- It is 100% idempotent and safe to run on both new and existing databases.
-- ==============================================================================

-- ── 0. REQUIRED EXTENSIONS ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. ENSURE TABLES EXIST BEFORE POLICIES OR ALTERATIONS ─────────────────────

-- Ensure business_settings exists and has required sequential numbering columns
CREATE TABLE IF NOT EXISTS business_settings (
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

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(20) DEFAULT '2026-';
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS next_invoice_sequence INT DEFAULT 1;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS invoice_notes_default TEXT;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own business_settings" ON business_settings;
CREATE POLICY "Users manage own business_settings"
  ON business_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure recurring_schedules exists
CREATE TABLE IF NOT EXISTS recurring_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
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

ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own recurring_schedules" ON recurring_schedules;
CREATE POLICY "Users manage own recurring_schedules"
  ON recurring_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure quotations table exists (Offertebeheer)
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    quotation_number VARCHAR(64) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    calculation_mode VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    subtotal_excl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_vat NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    disclaimer TEXT,
    signature_data_url TEXT,
    signed_by_name VARCHAR(128),
    signed_at TIMESTAMPTZ,
    converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT quotations_user_id_quotation_number_unique UNIQUE (user_id, quotation_number)
);

-- Ensure expenses extra columns exist
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_filename TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'PENDING';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ocr_raw_json JSONB;

-- ── 2. FIX BLOCKER B3: Secure Quotations & Drop Leaky Public Policies ──────────
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- Drop wide-open policies that leaked quotes across all users
DROP POLICY IF EXISTS "Public can view quotations by ID" ON quotations;
DROP POLICY IF EXISTS "Public can sign quotations" ON quotations;

-- Enforce strict tenant isolation on quotations
DROP POLICY IF EXISTS "Users manage own quotations" ON quotations;
CREATE POLICY "Users manage own quotations"
  ON quotations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add unguessable random public share token to quotations (24-byte hex string)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');
CREATE INDEX IF NOT EXISTS idx_quotations_share_token ON quotations(share_token);

-- Secure RPC function: Public quote inspection by token or ID (read-only, sanitized)
CREATE OR REPLACE FUNCTION get_public_quotation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', q.id,
    'quotation_number', q.quotation_number,
    'issue_date', q.issue_date,
    'valid_until_date', q.valid_until_date,
    'status', q.status,
    'calculation_mode', q.calculation_mode,
    'notes', q.notes,
    'disclaimer', q.disclaimer,
    'subtotal_excl', q.subtotal_excl,
    'total_vat', q.total_vat,
    'total_amount', q.total_amount,
    'total_incl', q.total_amount,
    'signed_at', q.signed_at,
    'signed_by_name', q.signed_by_name,
    'signature_data_url', q.signature_data_url,
    'share_token', q.share_token,
    'client', (
      SELECT jsonb_build_object(
        'name', c.name,
        'email', c.email,
        'company_name', c.name,
        'contact_person', c.contact_person,
        'billing_address_street', c.billing_address_street,
        'billing_address_city', c.billing_address_city,
        'billing_address_postcode', c.billing_address_postcode,
        'vat_number', c.vat_number
      )
      FROM clients c WHERE c.id = q.client_id
    ),
    'business', (
      SELECT jsonb_build_object(
        'company_name', s.company_name,
        'trade_name', COALESCE(s.trading_name, s.company_name),
        'email', s.email,
        'phone', s.phone,
        'iban', s.iban,
        'kvk_number', s.kvk_number,
        'btw_id', s.vat_number,
        'accent_color', s.accent_color,
        'address_street', s.address_street,
        'address_city', s.address_city,
        'address_postcode', s.address_postcode
      )
      FROM business_settings s WHERE s.user_id = q.user_id LIMIT 1
    ),
    'line_items', COALESCE(q.line_items, '[]'::jsonb)
  ) INTO v_quote
  FROM quotations q
  WHERE (q.share_token = p_token OR q.id::text = p_token);

  RETURN v_quote;
END;
$$;

-- Secure RPC function: Public digital signing (only modifies signature fields, only for SENT quotes)
CREATE OR REPLACE FUNCTION sign_quotation_publicly(
  p_token TEXT,
  p_signature TEXT,
  p_signer_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
BEGIN
  SELECT id, status INTO v_id, v_status
  FROM quotations
  WHERE (share_token = p_token OR id::text = p_token);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Offerte niet gevonden of link is ongeldig.';
  END IF;

  IF v_status NOT IN ('SENT', 'ACCEPTED') THEN
    RAISE EXCEPTION 'Offerte kan in status % niet worden ondertekend.', v_status;
  END IF;

  UPDATE quotations
  SET
    status = 'ACCEPTED',
    signature_data_url = p_signature,
    signed_by_name = p_signer_name,
    signed_at = now(),
    updated_at = now()
  WHERE id = v_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_quotation(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sign_quotation_publicly(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ── 3. FIX SEQUENTIAL NUMBERING: Atomic Database Sequence Generator ────────────
-- Guarantees contiguous, gapless sequential numbering without race conditions (Art. 35a Wet OB)
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_seq INT;
  v_result TEXT;
BEGIN
  SELECT invoice_prefix, next_invoice_sequence
  INTO v_prefix, v_seq
  FROM business_settings
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_seq IS NULL THEN
    v_seq := 1;
  END IF;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := to_char(now(), 'YYYY') || '-';
  END IF;

  v_result := v_prefix || lpad(v_seq::text, 4, '0');

  UPDATE business_settings
  SET next_invoice_sequence = v_seq + 1, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_invoice_number(UUID) TO authenticated;

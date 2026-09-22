# AliBirds Product Roadmap & Autonomous Goal Execution Plan

> **Platform:** AliBirds (Dutch ZZP & SME Financial Operating System)  
> **Benchmark Competitor:** [Moneybird](https://www.moneybird.nl)  
> **Status:** Production Execution Plan  
> **How to Run:** Each goal below is formulated as a self-contained prompt designed to be executed autonomously using the **`/goal`** slash command in Antigravity.

---

## Quick Navigation: Goals by Sprint

| Goal ID | Feature Area | Sprint | Complexity | Target Impact |
| :--- | :--- | :--- | :--- | :--- |
| [GOAL-01](#goal-01-ai-receipt--smart-inbox-scanner) | **AI Receipt & Smart Inbox Scanner** | Sprint 4 | High | Eliminates manual expense typing; #1 Moneybird feature |
| [GOAL-02](#goal-02-quotations--digital-signatures-offertes) | **Quotations & Digital Signatures (Offertes)** | Sprint 4 | Medium | Full ZZP sales cycle: Quote ➔ Sign ➔ Convert to Invoice |
| [GOAL-03](#goal-03-time--mileage-tracking-uren--ritten) | **Time & Mileage Tracking (Urencriterium & €0.23/km)** | Sprint 5 | Medium | Crucial for Dutch tax deduction (*Zelfstandigenaftrek*) |
| [GOAL-04](#goal-04-automated-payment-reminders--dunning) | **Automated Reminders & Dunning (Aanmaningen & WIK)** | Sprint 5 | Medium | Recovers cash flow; statutory Dutch interest & WIK rules |
| [GOAL-05](#goal-05-direct-ideal-payments-mollie--stripe) | **Direct iDEAL Payments (Mollie / Stripe)** | Sprint 6 | Medium | 1-Click invoice payments with auto-reconciliation |
| [GOAL-06](#goal-06-ubl-21-e-invoicing--peppol-bis-billing-30) | **UBL 2.1 E-Invoicing & Peppol BIS 3.0** | Sprint 6 | High | Mandatory for EU governments & enterprise procurement |
| [GOAL-07](#goal-07-profit--loss-winst--en-verlies-reporting) | **Profit & Loss (W&V) & Financial Reports** | Sprint 7 | Medium | Annual tax reporting (*Inkomstenbelasting / VPB*) |
| [GOAL-08](#goal-08-live-psd2-bank-sync-gocardless--ponto) | **Live PSD2 Bank Sync (GoCardless / Ponto)** | Sprint 7 | High | Automated overnight feeds (ING, Rabo, ABN, Bunq, Knab) |
| [GOAL-09](#goal-09-icp-opgaaf--digipoort-tax-filing-xml) | **ICP-Opgaaf & Tax Export (Belastingdienst)** | Sprint 8 | High | Intra-EU B2B cross-border VAT reporting |
| [GOAL-10](#goal-10-accountant-portal--auditfiles-xaf-export) | **Accountant Portal & Auditfiles (XAF Export)** | Sprint 8 | Medium | 1-Click handoff to Dutch bookkeepers & auditors |

---

## How to Execute with the `/goal` Command

To run any goal in this roadmap:
1. Copy the **Copy-Paste `/goal` Prompt** provided in the respective goal section.
2. In the Antigravity chat input, type `/goal` followed by the copied prompt.
3. The autonomous agent will execute the database migration, build frontend components, integrate API logic, test TypeScript compilation, and verify the feature end-to-end.

---

## Sprint 4: Immediate High-Impact Revenue & Intake

### GOAL-01: AI Receipt & Smart Inbox Scanner

* **Objective:** Enable entrepreneurs to drag and drop or snap photos of paper receipts / PDF supplier invoices and have an AI Vision OCR engine automatically parse vendor, date, total amount, VAT percentage, and expense category.
* **Competitor Benchmark:** Moneybird's "Inkomende Documenten" (Smart Inbox).
* **Database Schema Changes:**
  ```sql
  -- Add document attachment storage and parsing status to expenses
  ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
  ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_filename TEXT;
  ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'PENDING'; -- 'PENDING', 'PROCESSED', 'FAILED'
  ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ocr_raw_json JSONB;
  ```
* **Key Files to Touch:**
  - `frontend/src/lib/ocrScanner.ts` (New client-side / edge OCR processor with multi-fallback: Gemini Vision / Tesseract / regex heuristic)
  - `frontend/src/pages/Expenses.tsx` (Add drag-and-drop receipt intake drawer & side-by-side verification preview)
  - `frontend/src/lib/api.ts` (Upload and OCR parsing endpoints)
* **Acceptance Criteria:**
  1. User can drop a receipt (PNG, JPG, PDF) into `/expenses`.
  2. OCR extracts: Vendor Name, Expense Date, Total (incl. VAT), VAT Rate (21%, 9%, 0%, Reverse charge), and Net amount.
  3. Pre-fills the modal form side-by-side with receipt thumbnail preview.
  4. 1-click confirmation saves the expense to database.

#### Copy-Paste `/goal` Prompt:
```text
/goal Implement the AI Receipt & Smart Inbox Scanner (GOAL-01) for AliBirds.
1. Create frontend/src/lib/ocrScanner.ts to process receipt images (JPEG, PNG, WebP) and PDF documents. Implement robust extraction of: vendor_name, expense_date (ISO format), total_amount, vat_rate (21, 9, 0, or REVERSE_CHARGE), vat_amount, and category suggestion.
2. In frontend/src/pages/Expenses.tsx, add a modern drag-and-drop "Smart Inbox" zone with file picker and camera snap option.
3. When a receipt is dropped, display a processing state with a pulsing shimmer, extract receipt fields, and open the Add Expense modal pre-filled with the extracted data alongside a side-by-side image/PDF preview.
4. Support storing receipt files in Supabase Storage bucket 'receipts' (with fallback to base64 preview if offline/demo).
5. Ensure full responsiveness across mobile, tablet, and wide desktop screens.
6. Verify with `npm run build` and ensure zero TypeScript or linter errors.
```

---

### GOAL-02: Quotations & Digital Signatures (Offertes)

* **Objective:** Provide a complete sales quotation workflow (*offerte*). Freelancers can draft quotations with items, send them to prospective clients, share a secure public review link with an interactive canvas signature pad, and convert approved quotes into final invoices with 1 click.
* **Competitor Benchmark:** Moneybird Offertebeheer with digital signature confirmation.
* **Database Schema Changes:**
  ```sql
  CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    quotation_number VARCHAR(64) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_vat NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    signature_data_url TEXT,
    signed_by_name VARCHAR(128),
    signed_at TIMESTAMPTZ,
    converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
* **Key Files to Touch:**
  - `frontend/src/pages/Quotations.tsx` (New quotations list with status pipeline: Concept, Verzonden, Geaccepteerd, Gefactureerd)
  - `frontend/src/pages/QuotationEditor.tsx` (Quote generator reusing invoice calculation engine)
  - `frontend/src/pages/PublicQuoteReview.tsx` (Public signer view with signature canvas pad)
  - `frontend/src/components/Sidebar.tsx` (Add "Offertes" navigation link)
  - `frontend/src/App.tsx` (Register `/quotations`, `/quotations/new`, `/quotations/:id`, `/quote/review/:id`)
* **Acceptance Criteria:**
  1. User can create, preview, edit, and duplicate quotations with custom validity dates (e.g., 30 days).
  2. Public signing link allows clients to sign with touch/mouse on a canvas pad.
  3. Status updates automatically to `ACCEPTED`.
  4. 1-click button "Omzetten naar factuur" generates a draft invoice retaining all line items.

#### Copy-Paste `/goal` Prompt:
```text
/goal Build the Quotations & Digital Signatures (Offertes) system (GOAL-02) for AliBirds.
1. Create the database migration schema for `quotations` table with status workflow (DRAFT, SENT, ACCEPTED, REJECTED, CONVERTED) and line items JSONB.
2. Create frontend/src/pages/Quotations.tsx featuring filter tabs, pipeline KPI badges, and desktop/mobile responsive table view.
3. Create frontend/src/pages/QuotationEditor.tsx allowing freelancers to build quotes with VAT rates (21%, 9%, 0%), validity terms, and custom disclaimer notes.
4. Build an interactive public quote review modal/page with HTML5 signature canvas where clients can sign and approve the quotation online.
5. Add a 1-click "Omzetten naar factuur" (Convert to Invoice) action that creates a new invoice copying all line items and linking the quotation ID.
6. Add Offertes to Sidebar and App.tsx routes. Ensure `npm run build` passes with zero errors.
```

---

## Sprint 5: Freelancer Tax Shield & Automated Cash Recovery

### GOAL-03: Time & Mileage Tracking (Uren- & Rittenregistratie)

* **Objective:** Help Dutch ZZP'ers satisfy the Belastingdienst *Urencriterium* (minimum 1,225 hours/year) to secure the €3,750+ *Zelfstandigenaftrek* and log business car trips deductible at the statutory €0.23/km rate.
* **Competitor Benchmark:** Moneybird Urenregistratie & Rittenregistratie.
* **Database Schema Changes:**
  ```sql
  CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_name VARCHAR(128),
    description TEXT,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    hourly_rate NUMERIC(10,2),
    is_billable BOOLEAN NOT NULL DEFAULT true,
    is_invoiced BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS mileage_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
    departure_address VARCHAR(255) NOT NULL,
    destination_address VARCHAR(255) NOT NULL,
    kilometers NUMERIC(8,2) NOT NULL,
    rate_per_km NUMERIC(5,2) NOT NULL DEFAULT 0.23, -- Statutory Dutch rate
    total_deduction NUMERIC(10,2) GENERATED ALWAYS AS (kilometers * rate_per_km) STORED,
    purpose TEXT,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    is_booked_as_expense BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
* **Key Files to Touch:**
  - `frontend/src/pages/TimeTracking.tsx` (Live stop-watch timer + calendar week grid + annual *Urencriterium* progress bar: e.g., 680 / 1,225 hours)
  - `frontend/src/pages/MileageTracking.tsx` (Trip log + statutory €0.23 calculation + 1-click "Boek als uitgave" to post directly into Expenses 5b)
  - `frontend/src/pages/InvoiceEditor.tsx` (Add "Importeer niet-gefactureerde uren" button to automatically insert logged hours into line items)
* **Acceptance Criteria:**
  1. Live floating stopwatch to start/pause/stop working on a client task.
  2. Annual gauge tracking progress toward 1,225 hours required by Dutch tax authorities.
  3. Mileage calculator applying €0.23/km with 1-click export to Expenses.
  4. 1-click import of logged hours directly into an invoice.

#### Copy-Paste `/goal` Prompt:
```text
/goal Implement Time Tracking & Mileage Tracking (Uren- & Rittenregistratie) (GOAL-03) for AliBirds.
1. Create database tables `time_entries` and `mileage_entries` with client relations.
2. Build frontend/src/pages/TimeTracking.tsx with:
   - A live start/pause/stop task timer.
   - Weekly/monthly time log grid with billable/unbillable toggles.
   - Dutch Belastingdienst Urencriterium progress widget (target: 1,225 hrs/year) with status indicator.
3. Build Mileage Tracking component calculating statutory €0.23/km with a 1-click "Boek als zakelijke uitgave" button that generates a corresponding record in the `expenses` table.
4. In InvoiceEditor.tsx, add a "Niet-gefactureerde uren toevoegen" button that selects unbilled time entries and populates invoice lines.
5. Add navigation items and verify responsive layout and build status.
```

---

### GOAL-04: Automated Payment Reminders & Dunning (Aanmaningen & WIK)

* **Objective:** Automate overdue invoice follow-ups in full compliance with the Dutch *Wet Incassokosten (WIK)*, calculating statutory late interest and sending scheduled friendly, second, and final notices.
* **Competitor Benchmark:** Moneybird Automatische Herinneringen & Aanmaningen.
* **Database Schema Changes:**
  ```sql
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_level INTEGER DEFAULT 0; -- 0=none, 1=friendly, 2=formal, 3=final demand
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS statutory_late_interest NUMERIC(10,2) DEFAULT 0.00;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS collection_costs_wik NUMERIC(10,2) DEFAULT 0.00;
  ```
* **Key Files to Touch:**
  - `frontend/src/lib/dunning.ts` (Implements Dutch WIK formulas: 15% on first €2,500 with min €40, 10% on next €2,500, statutory commercial interest rates)
  - `frontend/src/pages/InvoiceList.tsx` (Visual warning badges: `3 dagen te laat`, `Herinnering verzenden`)
  - `frontend/src/components/DunningModal.tsx` (Preview reminder email text, customize grace period, recalculate statutory interest & collection fees, and send with 1 click)
  - `frontend/src/pages/Settings.tsx` (Configure automated reminder schedules & template copy)
* **Acceptance Criteria:**
  1. Overdue invoices display clear visual alerts indicating how many days they are past due.
  2. 1-click reminder modal pre-drafts professional Dutch notice text based on escalation level.
  3. Automatic calculation of statutory late interest and WIK collection costs.
  4. Update reminder level and timestamp upon sending.

#### Copy-Paste `/goal` Prompt:
```text
/goal Build the Automated Payment Reminders & Dunning System (GOAL-04) for AliBirds.
1. Create frontend/src/lib/dunning.ts implementing Dutch statutory debt collection calculations (Wet Normering Buitengerechtelijke Incassokosten - WIK) and statutory interest (Wettelijke handelsrente).
2. In frontend/src/pages/InvoiceList.tsx, add clear visual overdue chips showing overdue days and reminder stage.
3. Build frontend/src/components/DunningModal.tsx with 3 escalating tiers:
   - Tier 1: Vriendelijke herinnering (Grace period reminder).
   - Tier 2: 1e Aanmaning (Formal payment reminder).
   - Tier 3: Ingebrekestelling (Final demand letter including calculated WIK fee + statutory interest).
4. Integrate with the existing email sender (Resend / Mailto fallback) to transmit the reminder along with original PDF invoice and iDEAL payment link.
5. In Settings.tsx, add a tab for Reminder Templates so users can customize reminder text. Test build with `npm run build`.
```

---

## Sprint 6: Instant Payments & EU Standards Compliance

### GOAL-05: Direct iDEAL & Online Payments (Mollie / Stripe)

* **Objective:** Enable instant invoice payments via iDEAL, Bancontact, and credit cards with webhook callbacks that automatically reconcile the transaction and mark the invoice as `PAID`.
* **Competitor Benchmark:** Moneybird Mollie Integration.
* **Key Files to Touch:**
  - `netlify/functions/mollie-create-payment.ts` & `netlify/functions/mollie-webhook.ts` (API handlers)
  - `frontend/src/pages/Settings.tsx` (Mollie API key field + Webhook URL generator)
  - `frontend/src/components/SendInvoiceModal.tsx` (Automatically append dynamic Mollie payment checkout link)
  - `frontend/src/lib/api.ts` (Payment status listeners)
* **Acceptance Criteria:**
  1. User can configure a live or test Mollie API key in Settings.
  2. Invoices generate dynamic iDEAL checkout links.
  3. Webhook updates invoice status to `PAID`, sets `paid_at`, and creates a matched bank entry.

#### Copy-Paste `/goal` Prompt:
```text
/goal Implement Direct iDEAL & Online Payments with Mollie (GOAL-05) for AliBirds.
1. Add Mollie payment configuration fields in Settings.tsx (Mollie API Key, test/live mode toggle).
2. Create serverless Netlify function `netlify/functions/mollie-create-payment.ts` that initializes an iDEAL payment with invoice amount, invoice number, and redirect URL.
3. Create serverless webhook `netlify/functions/mollie-webhook.ts` that receives payment confirmation from Mollie and automatically updates `invoices.status = 'PAID'` and `invoices.paid_at = now()` in Supabase.
4. Include the dynamic iDEAL pay button in email notifications, PDF previews, and online invoice links.
5. Provide a test sandbox mode for safe verification. Ensure `npm run build` succeeds.
```

---

### GOAL-06: UBL 2.1 E-Invoicing & Peppol BIS Billing 3.0

* **Objective:** Automatically generate standardized Peppol BIS Billing 3.0 / UBL 2.1 XML files with every invoice to allow Dutch municipalities, EU governments, and corporate ERPs to ingest invoices seamlessly.
* **Competitor Benchmark:** Moneybird Peppol & UBL Generation.
* **Key Files to Touch:**
  - `frontend/src/lib/ublGenerator.ts` (Generates validated UBL 2.1 XML conforming to EN 16931 and PEPPOL BIS Billing 3.0)
  - `frontend/src/pages/InvoiceList.tsx` & `InvoiceEditor.tsx` (Add "Download UBL XML" action button)
  - `frontend/src/lib/email.ts` (Automatically attach `invoice-{number}.xml` alongside PDF in invoice emails)
* **Acceptance Criteria:**
  1. Generates standard UBL 2.1 XML with supplier/buyer KVK, BTW (NL888...B01), IBAN, tax totals, and line item details.
  2. Validates against European Standard EN 16931 tax schemes.
  3. "Download UBL" button available in invoice details and invoice row dropdown.
  4. Attached automatically to outbound emails.

#### Copy-Paste `/goal` Prompt:
```text
/goal Implement UBL 2.1 E-Invoicing & Peppol BIS Billing 3.0 Compliance (GOAL-06) for AliBirds.
1. Create frontend/src/lib/ublGenerator.ts to generate valid UBL 2.1 XML following PEPPOL BIS Billing 3.0 and EU Norm EN 16931 standards:
   - Includes Supplier & Customer Party details (KVK, VAT identification, IBAN, BIC, address).
   - Legal Monetary Total (LineExtensionAmount, TaxExclusiveAmount, TaxInclusiveAmount, PayableAmount).
   - TaxTotal breakdown per VAT rate (21%, 9%, 0%, Reverse charge with Exempt Reason Code).
   - Line items with standard unit codes (HUR for hours, C62 for units).
2. Add a "Download UBL (XML)" button in InvoiceList.tsx and InvoiceEditor.tsx.
3. Update email sending logic in frontend/src/lib/email.ts to attach both the PDF and UBL XML file to the customer.
4. Test with sample Dutch KVK and VAT numbers. Ensure build passes.
```

---

## Sprint 7: Financial Intelligence & Live Bank Automation

### GOAL-07: Profit & Loss (Winst- en Verliesrekening) & Financial Reports

* **Objective:** Provide annual and quarterly W&V statements comparing turnover, gross profit, operating cost breakdowns, and estimated net profit for year-end Dutch tax filing (*Inkomstenbelasting / VPB*).
* **Competitor Benchmark:** Moneybird Resultatenrekening & Balans.
* **Key Files to Touch:**
  - `frontend/src/pages/Reports.tsx` (New interactive P&L and Balance report page)
  - `frontend/src/lib/reporting.ts` (Aggregation engine computing Net Turnover, Cost of Goods Sold, Operating Expenses categorized, and Net Profit before Tax)
  - `frontend/src/components/Sidebar.tsx` (Add "Rapportages" navigation item)
* **Acceptance Criteria:**
  1. Aggregates all paid and finalized invoices and expenses for any selected year/quarter.
  2. Breaks down operating expenses by Dutch standard categories (Marketing, Software, Office, Travel, Advisor).
  3. Displays Year-over-Year comparison bar charts.
  4. 1-click export to PDF and Excel (CSV) for accountants.

#### Copy-Paste `/goal` Prompt:
```text
/goal Build the Profit & Loss (Winst- en Verliesrekening) and Financial Reporting Engine (GOAL-07) for AliBirds.
1. Create frontend/src/lib/reporting.ts to compute:
   - Net Turnover (Netto Omzet) from finalized invoices.
   - Direct Costs (Inkoopkosten).
   - Gross Margin (Brutomarge).
   - Categorized Operational Costs (Software, Huur, Reiskosten, Marketing, Boekhouder).
   - Operating Result (Bedrijfsresultaat / Winst voor belasting).
2. Create frontend/src/pages/Reports.tsx with quarterly and annual date range selectors (2024, 2025, 2026).
3. Include visual summary charts comparing revenue vs costs per month and YoY growth.
4. Add 1-click export buttons for "Download W&V als PDF" and "Download Excel (CSV)".
5. Add "Rapportages" link to Sidebar and App.tsx routes. Ensure `npm run build` succeeds.
```

---

### GOAL-08: Live PSD2 Bank Sync (GoCardless / Ponto)

* **Objective:** Connect directly to Rabobank, ING, ABN AMRO, Bunq, SNS, and Knab via European PSD2 open banking APIs to ingest transactions automatically every morning.
* **Competitor Benchmark:** Moneybird Bankkoppeling.
* **Key Files to Touch:**
  - `netlify/functions/gocardless-connect.ts` & `netlify/functions/gocardless-sync.ts` (OAuth flow & transaction fetcher)
  - `frontend/src/pages/BankReconciliation.tsx` (Add "Verbind uw bank via PSD2" button with live connection status card)
  - `frontend/src/lib/api.ts` (Sync methods)
* **Acceptance Criteria:**
  1. Connect button initiates bank authentication requisition.
  2. Automatically maps incoming bank transactions to `bank_transactions` table.
  3. Executes existing auto-matching engine to reconcile revenue invoices and register costs seamlessly.

#### Copy-Paste `/goal` Prompt:
```text
/goal Implement Live PSD2 Bank Account Synchronization (GOAL-08) for AliBirds using GoCardless Bank Data API.
1. Create serverless Netlify functions for GoCardless (Nordigen) PSD2 Bank Integration:
   - `gocardless-connect.ts`: Initiates institution requisition for Dutch banks (ING, Rabobank, ABN AMRO, Bunq, Knab, SNS).
   - `gocardless-sync.ts`: Fetches latest transactions and deduplicates entries by transaction_id / date / amount.
2. In BankReconciliation.tsx, add a "Live Bankkoppeling" banner with connection status (Actief / Vernieuwen vereist na 90 dagen).
3. On transaction sync, trigger the existing AliBirds reconciliation engine to automatically match invoice references and suggest expense categories.
4. Verify build and responsive layout.
```

---

## Sprint 8: Institutional Tax Filing & Accountant Collaboration

### GOAL-09: ICP-Opgaaf & Tax Filing Export (Belastingdienst Digipoort)

* **Objective:** Enable cross-border EU intra-community services reporting (*Opgaaf Intracommunautaire Prestaties - ICP*) and generate official Belastingdienst-compatible XML export for Digipoort submission.
* **Competitor Benchmark:** Moneybird Elektronische Btw-aangifte & ICP-opgaaf.
* **Key Files to Touch:**
  - `frontend/src/pages/TaxReturn.tsx` (Add ICP Rubric 3b breakdown and Belastingdienst XML generator)
  - `frontend/src/lib/taxExport.ts` (Digipoort Btw-aangifte XML schema generator)
* **Acceptance Criteria:**
  1. Identifies invoices with EU clients (reverse-charge VAT) and populates Rubric 3b.
  2. Displays an ICP summary table grouped by client VAT number.
  3. Generates Belastingdienst-compatible filing XML ready for submission.

#### Copy-Paste `/goal` Prompt:
```text
/goal Implement ICP-Opgaaf & Belastingdienst Digipoort XML Export (GOAL-09) for AliBirds.
1. In frontend/src/lib/taxExport.ts, implement the Dutch Belastingdienst XML schema for Omzetbelasting (OB) and Opgaaf ICP (Intracommunautaire Prestaties):
   - Rubriek 1: Prestaties binnenland (1a hoog, 1b laag, 1c overig).
   - Rubriek 2: Verleggingsregelingen binnenland (2a).
   - Rubriek 3: Prestaties naar het buitenland (3a naar buiten de EU, 3b leveringen/diensten naar EU-landen).
   - Rubriek 4: Prestaties uit het buitenland (4a, 4b).
   - Rubriek 5: Voorbelasting & Eindtotaal (5a, 5b, 5g saldo).
2. In frontend/src/pages/TaxReturn.tsx, add an "ICP Opgaaf" tab listing all EU client VAT numbers, country codes, and turnover amounts.
3. Add a "Download Belastingdienst Aangifte XML" button. Verify build status.
```

---

### GOAL-10: Accountant Portal & Auditfiles (XAF Export)

* **Objective:** Allow external bookkeepers to inspect records with read-only accountant access and export standardized Dutch Auditfile Financieel (`.xaf` XML).
* **Competitor Benchmark:** Moneybird Boekhouder Toegang & Auditfile Financieel.
* **Key Files to Touch:**
  - `frontend/src/lib/auditfileGenerator.ts` (Generates Dutch Auditfile Financieel XAF 3.2 XML)
  - `frontend/src/pages/Settings.tsx` (Accountant invite section: generate secure 30-day read-only access token)
  - `frontend/src/pages/Reports.tsx` (Download `.xaf` audit file button)
* **Acceptance Criteria:**
  1. Freelancers can invite an accountant via email with temporary read-only token.
  2. Generates validated Dutch Auditfile Financieel (`.xaf` version 3.2).
  3. Compatible with major Dutch audit packages (Caseware, Exact, Unit4, SnelStart).

#### Copy-Paste `/goal` Prompt:
```text
/goal Implement Accountant Collaboration & Auditfile Financieel (XAF) Export (GOAL-10) for AliBirds.
1. Create frontend/src/lib/auditfileGenerator.ts that formats general ledger data, invoices, customers, vendors, and bank transactions into standard Auditfile Financieel (XAF version 3.2 XML).
2. In Settings.tsx, add a "Boekhouder Uitnodigen" section allowing the user to generate a secure read-only invitation link.
3. In Reports.tsx, add a "Download Auditfile Financieel (.xaf)" button for seamless year-end closing.
4. Verify with `npm run build` and ensure clean TypeScript execution.
```

---

## Technical & Architectural Checklist for Each Goal

Before submitting any goal execution:
1. **Zero Lint & Build Errors:** Always verify with `npm run build` inside `frontend/`.
2. **Full-Screen Responsive:** Maintain `w-full` layouts with `max-w-[1800px]` constraints to ensure screens look balanced on mobile, 1080p, 1440p, and ultra-wide displays.
3. **Session Preservation:** All new API endpoints and pages must respect `useAuth()` session handling, token expiration checks, and multi-tab synchronization.
4. **Clean Dutch & English Dual Support:** Maintain professional Dutch localization for financial and tax terminology (*omzetbelasting, voorbelasting, urencriterium, rittenregistratie*) with clear English codebases.

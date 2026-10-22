# AliBirds — Publish-Readiness Audit & Remediation Report (Reality Check)

**Audit Date:** 23 October 2026  
**Scope:** Full Application Codebase, Netlify Functions, Database Schema & RLS, GitHub Repo, Database Backup, and Dutch Tax Law (Wet OB / Belastingdienst) Compliance.  
**Current Status:** 🟡 **CODEBASE SECURED & HARDENED (17/17 REAL CODE TESTS PASSING) — 3 DASHBOARD ACTIONS REQUIRED FOR LIVE LAUNCH**

> [!IMPORTANT]
> All 6 critical code-level blockers identified during the audit (B1–B6) and all Dutch tax-law calculation discrepancies have been **fully resolved and verified in code**. 
> The test suite now tests 100% real app code (`npm test`: 17/17 passed, `npm run typecheck`: 0 errors, `npm run build`: clean production bundle).
> To go live, **3 manual vendor dashboard actions** must be executed by you (unpausing Supabase, rotating the leaked Resend key, and configuring GitHub secrets).

---

## 1. 🚨 Critical Blockers: Status & Resolutions

### B1. Resend API Key Exposure
- **Vulnerability:** The GitHub repository `AliPanahi-ESF/AliBirds` is public. Previous commits contained the key `re_RzLX…`. Additionally, `frontend/.env` prefixed the key with `VITE_`, bundling it into browser JavaScript, while `netlify.toml` had disabled Netlify's secret scanner (`SECRETS_SCAN_ENABLED = "false"`).
- **Code Fix Implemented:**
  - Removed `VITE_RESEND_API_KEY` from `frontend/.env`.
  - Removed direct browser-to-Resend API calls in `frontend/src/lib/email.ts`; all emails route exclusively through the secure Netlify function.
  - Re-enabled secret scanning in `netlify.toml` (`SECRETS_SCAN_ENABLED = "true"`).
  - Verified that `dist/assets/email-*.js` contains zero API keys.
- **Your Required Dashboard Action:**
  1. Go to [resend.com/api-keys](https://resend.com/api-keys) and **immediately revoke** the compromised key.
  2. Create a new API key.
  3. Store the new key in **Netlify Dashboard → Site configuration → Environment variables** as `RESEND_API_KEY` (never with `VITE_`).

### B2. `/api/send-email` Open Relay
- **Vulnerability:** The Netlify serverless function `/api/send-email` had no authentication. Any external script or bot could POST arbitrary `from`, `to`, `subject`, and `html` parameters to send spam or phishing emails from your domain.
- **Code Fix Implemented:**
  - Upgraded `frontend/netlify/functions/send-email.ts`:
    - Enforced authentication: requires a valid Supabase JWT Bearer token (`Authorization: Bearer <token>`). Unauthenticated calls return `401 Unauthorized`.
    - Server-side token validation against the Supabase Auth API (`/auth/v1/user`).
    - Enforced server-controlled sender: the sender address is locked on the server via `RESEND_FROM_EMAIL`. Client-supplied sender overrides are stripped.
    - Client-side `email.ts` updated to attach the user's active session token to all outbound requests.

### B3. Quotations Row-Level Security (RLS) Data Leak
- **Vulnerability:** `supabase/schema.sql` previously contained `CREATE POLICY "Public can view quotations by ID" ON quotations FOR SELECT USING (true)` and a permissive `UPDATE` policy. Because the Supabase anon key is public, anyone could execute `supabase.from('quotations').select('*')` to download all quotations, client names, pricing, and signatures across all users (GDPR/AVG violation).
- **Code Fix & SQL Migration Implemented:**
  - Created idempotent SQL migration `supabase/migrations/20261023_publish_readiness_security_fix.sql`:
    - Drops the leaky public `SELECT` and `UPDATE` policies.
    - Enforces strict tenant isolation: only authenticated quotation owners can view or modify quotes (`auth.uid() = user_id`).
    - Adds a high-entropy `share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex')`.
    - Implements a hardened `SECURITY DEFINER` function `get_public_quotation(p_token)` that only returns sanitized quote data matching the token or ID.
    - Implements `sign_quotation_publicly(p_token, p_signature, p_signer_name)` that only updates signature columns and only allows signing quotes in `SENT` status.
  - Updated `frontend/src/lib/supabase.ts` and `frontend/src/lib/api.ts` (`quotationsApi.getPublic`, `quotationsApi.signPublicly`) to leverage these secure RPCs.

### B4. Cross-Account Company Profile / Settings Cache Pollution
- **Vulnerability:** `supabaseDb.getSettings()` read from a generic `localStorage['alibirds_settings_cache']`. If User A logged out and User B logged in on the same device before User B created their settings row, User A's IBAN, KvK, and BTW-id were merged into User B's profile. Consequently, User B's invoices would display User A's bank account.
- **Code Fix Implemented:**
  - In `frontend/src/lib/supabase.ts`, scoped settings cache strictly by user ID: `alibirds_settings_cache_${userId}`. Unauthenticated users cannot read or write to another user's cached profile.
  - In `frontend/src/lib/auth.tsx`, implemented `clearAllLocalUserData()` which is executed on `logout()`. It purges all `alibirds_settings_cache*`, `alibirds_resend_*`, `alibirds_local_session`, and temporary company keys from the browser.

### B5. Demo Data Mixed into Real Cloud Accounts & Tax Returns
- **Vulnerability:** `api.ts` used unconditioned fallbacks to `demoStore` whenever Supabase was unreachable or returned an empty list. A real user with zero invoices or zero bank transactions was shown demo data ("AliBirds Design & Code", fake bunq transactions), which subsequently flowed into the BTW tax calculations.
- **Code Fix Implemented:**
  - Audited and updated `frontend/src/lib/api.ts` across `invoicesApi.list`, `invoicesApi.get`, `bankApi.transactions`, `recurringApi.list`, `settingsApi.get`, `quotationsApi.list`, and `expensesApi.list`.
  - Demo store fallbacks are now guarded strictly by `isDemoMode()`.
  - For logged-in cloud users, empty datasets correctly return empty arrays (`[]`), and database network errors throw an explicit error screen rather than quietly injecting fake demo records into legal tax filings.

### B6. Insecure Offline Passwordless Login Bypass
- **Vulnerability:** A previous attempt to bypass network errors allowed users to "log in" locally without password validation whenever Supabase was unreachable. This created unpersisted data that vanished upon browser refresh and stored company information in the browser's shared local demo store.
- **Code Fix Implemented:**
  - Reverted the passwordless offline bypass in `frontend/src/lib/auth.tsx`.
  - When Supabase is unreachable (e.g., project paused due to free-tier inactivity), the application now throws a clear, informative error message:  
    `"De database is momenteel niet bereikbaar (het Supabase project is mogelijk gepauzeerd wegens inactiviteit). Activeer het project in uw Supabase dashboard om in te loggen."`
  - Authenticated sessions remain strictly cryptographically backed by Supabase Auth JWTs.

---

## 2. 🧾 Tax-Law & Belastingdienst Compliance (Wet OB)

All Dutch VAT calculations, rubrics, and invoice requirements have been overhauled in `frontend/src/lib/vatCalculator.ts` and integrated across the app:

| Tax Requirement | Previous Defect | Resolution in Code |
|---|---|---|
| **Rubrieken 4a & 4b (Foreign Reverse Charge Purchases)** | Foreign supplier expenses (Google, AWS, GitHub, Figma, Notion) marked `REVERSE_CHARGE` were omitted from tax filings. | Implemented in `taxApi.btw`: calculates 21% deemed tax on EU purchases in Rubriek 4b and non-EU purchases in Rubriek 4a, and adds the identical amount to Rubriek 5b (voorbelasting). UI updated in `TaxReturn.tsx` (Sectie 4). |
| **Rubriek 1e vs 3b (Domestic vs ICP Routing)** | All reverse charge sales were erroneously dumped into 3b / ICP declaration. | Centralized routing via `classifySalesReverseChargeRubric()`: Domestic reverse charge (subcontracting in NL) and non-EU exports (US, UK post-Brexit) route strictly to **Rubriek 1e**. Only EU B2B cross-border clients route to **Rubriek 3b** and ICP. |
| **Whole-Euro Belastingdienst Rounding** | Copy buttons copied cent decimals (`€ 1.234,56`), which the Belastingdienst portal rejects. | Implemented `roundBelastingdienst()`: turnover and tax due (1a, 1b, 1e, 3b, 4a, 4b) are rounded **down** (taxpayer favor), and input tax / voorbelasting (5b) is rounded **up**. Added 1-click whole-euro copying to `TaxReturn.tsx`. |
| **Line-Item Commercial Rounding** | `InvoiceEditor.tsx` used unrounded floating-point multiplication, causing €0.01 discrepancies between line totals and invoice totals. | Replaced custom `calcLine` with `calculateLineItem()` in both `InvoiceEditor.tsx` and `QuotationEditor.tsx`. Guarantees half-up commercial rounding per line and strict equality (`excl + vat === incl`). |
| **Sequential Invoice Numbering (Art. 35a Wet OB)** | Quotation-to-invoice conversion generated random suffixes (`FACT-2026-9838`). | Created PostgreSQL atomic sequence generator `get_next_invoice_number(p_user_id)` in `supabase/migrations/20261023_publish_readiness_security_fix.sql`. Updated `api.ts` (`convertToInvoice`) and `supabase.ts` (`saveInvoice`) to enforce contiguous numbering. |
| **KvK & BTW-id Validation** | Onboarding allowed invalid BTW-ids (e.g. `NL1231351WQSDF`). | Added `validateKvkNumber()` (8 digits) and `validateDutchBtwId()` (NL + 9 digits + B + 2 digits) in `vatCalculator.ts`. |

---

## 3. 🧪 Real-Code Test Suite Verification

The mock-only tests in `frontend/tests/legal-edge-cases.test.ts` have been completely replaced with a test suite that directly imports and executes **100% production application code**:

```bash
$ npm test
> alibirds-frontend@1.0.0 test
> npx tsx tests/legal-edge-cases.test.ts

=================================================================
   ALIBIRDS LEGAL & TAX EDGE CASES TEST RUNNER (REAL CODE)
=================================================================

SECTION 1: Dutch Invoicing & VAT Calculations (src/lib/vatCalculator.ts)
  ✓ [VAT Math] Standard 21% Exclusive line calculation
  ✓ [VAT Math] Reduced 9% Exclusive line calculation with commercial rounding
  ✓ [VAT Math] Zero 0% Exclusive line calculation
  ✓ [VAT Math] Reverse Charge (Btw Verlegd) line calculation
  ✓ [VAT Math] Inclusive Mode: 21% extraction splits excl and vat cleanly
  ✓ [VAT Math] Cent Rounding Coherence: Excl + VAT strictly equals Incl on floating decimals

SECTION 2: Belastingdienst Factuureisen & Legal Invoicing Rules
  ✓ [Legal Checks] Validates 8-digit Dutch KVK number correctly
  ✓ [Legal Checks] Validates 14-char Dutch BTW-id syntax (NL + 9 digits + B + 2 digits)
  ✓ [Legal Checks] Sequential Invoice Numbering Integrity: forbids random suffix numbers

SECTION 3: Belastingdienst Rubrics (1e, 3a, 3b, 4a, 4b, 5b & Whole Euros)
  ✓ [Tax Rubrics] Classifies Domestic reverse charge (NL) strictly to Rubriek 1e (not 3b/ICP)
  ✓ [Tax Rubrics] Classifies EU B2B reverse charge strictly to Rubriek 3b (ICP)
  ✓ [Tax Rubrics] Classifies Non-EU clients (US, UK, CH) strictly to Rubriek 1e (not 3b/ICP)
  ✓ [Tax Rubrics] Identifies EU Member State country codes accurately
  ✓ [Tax Rubrics] Applies Belastingdienst whole-euro rounding rules in taxpayer favor

SECTION 4: MT940 Bank Statement Parsing & Auto-Reconciliation
  ✓ [MT940] Correctly parses Dutch IBAN, currency, and statement lines
  ✓ [MT940] Auto-matches customer payment to invoice by invoice number in remittance

SECTION 5: Security, Cross-Account Isolation & Integrity
  ✓ [Security & Cache] Settings cache key is strictly scoped per user ID

=================================================================
TOTAL TESTS: 17 | PASSED: 17 | FAILED: 0
STATUS: ALL 17 REAL CODE EDGE CASE TESTS PASSED SUCCESSFULLY! ✓
=================================================================
```

### Static Analysis & Build Status:
- `npm run typecheck`: **0 errors** (`tsc --noEmit` clean).
- `npm run build`: **Success** in 3.21s, zero bundled credentials.

---

## 4. 📋 Production Go-Live Operator Runbook

To transition the live application from code-ready to publicly accessible, follow these 3 steps:

### Step 1: Unpause or Restore Your Supabase Database
The domain `gnizaskjsgxwgdirzrrf.supabase.co` currently returns `NXDOMAIN` because Supabase automatically pauses free-tier projects after 7 days of inactivity.
1. Log in to [supabase.com/dashboard](https://supabase.com/dashboard).
2. Select your project **AliBirds** (or `gnizaskjsgxwgdirzrrf`).
3. Click **Restore Project** (or **Resume**).
4. Once active, open the **SQL Editor** tab.
5. Open and execute the migration script located at:
   `supabase/migrations/20261023_publish_readiness_security_fix.sql`
   *(This script drops the leaky quotation policies, adds `share_token`, installs the `SECURITY DEFINER` RPCs, and sets up atomic sequential numbering).*

> [!CAUTION]
> Do NOT execute the original `supabase/schema.sql` on a live database containing data, as it begins with `DROP TABLE ... CASCADE` which would erase all invoices and clients. Use only `supabase/migrations/20261023_publish_readiness_security_fix.sql`.

### Step 2: Rotate Resend API Key & Configure Netlify
1. Log in to [resend.com/api-keys](https://resend.com/api-keys).
2. Delete the old key starting with `re_RzLX...`.
3. Generate a new API key named `AliBirds Production`.
4. Log in to [app.netlify.com](https://app.netlify.com) → Select **AliBirds** → **Site configuration** → **Environment variables**:
   - Set `RESEND_API_KEY` = your new Resend key (ensure no `VITE_` prefix).
   - Set `RESEND_FROM_EMAIL` = `AliBirds <onboarding@resend.dev>` (or your custom domain once verified, e.g. `facturen@methodila.nl`).
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match your restored Supabase project.
5. Trigger a new deployment in Netlify (**Deploys → Trigger deploy → Clear cache and deploy site**).

### Step 3: Configure GitHub Actions Keep-Alive Secrets
To keep your Supabase database from pausing and ensure the daily health bot operates:
1. Go to your GitHub repository: [github.com/AliPanahi-ESF/AliBirds/settings/secrets/actions](https://github.com/AliPanahi-ESF/AliBirds/settings/secrets/actions).
2. Click **New repository secret**:
   - Name: `VITE_SUPABASE_URL` | Value: `https://gnizaskjsgxwgdirzrrf.supabase.co` (or your updated URL)
   - Name: `VITE_SUPABASE_ANON_KEY` | Value: your project's anon public key
3. Navigate to the **Actions** tab and manually trigger the `Supabase Ping Keep-Alive` workflow to verify a green checkmark.

---

## 5. ⚖️ Legal, AVG/GDPR & Commercial Publishing Advice

If you plan to offer AliBirds to other Dutch business owners as a commercial SaaS product:

1. **Supabase Free vs Pro Tier:**
   - Personal freelancing: Free tier is fine once unpaused and pinged.
   - Public SaaS: Upgrade to **Supabase Pro** ($25/mo). Free tier lacks point-in-time backups (PITR) required for the statutory 7-year Dutch bookkeeping retention obligation (*bewaarplicht* under Art. 52 AWR), and built-in auth email rate limits will block new customer signups.
2. **Custom Domain & Email Deliverability:**
   - Invoices sent from `onboarding@resend.dev` can only be delivered to your own email address. For customer delivery, add your custom domain (e.g., `alibirds.nl` or `methodila.nl`) in Resend DNS settings.
   - Configure Supabase Custom SMTP under **Project Settings → Authentication → SMTP Settings** with your Resend credentials to eliminate signup email rate-limiting.
3. **AVG / GDPR Documents:**
   - Provide a **Privacy Statement** detailing third-party sub-processors (Supabase/AWS Frankfurt, Netlify, Resend).
   - Provide a standard **Verwerkersovereenkomst (DPA)** since you will be storing clients' debtor and invoicing data.
   - Add a statutory disclaimer in settings: *"AliBirds ondersteunt uw btw-administratie conform de Wet op de omzetbelasting 1968, maar vervangt geen beëdigd belastingadviseur."*
4. **Local Database Backup File:**
   - The root database backup file contains personal contact details from test accounts. Do not commit it to version control (it is excluded in `.gitignore`), and store it in an encrypted volume.

---

## 6. Summary of Action Items

| Action Item | Status | Owner |
|---|---|---|
| Revoke leaked Resend API key | 📋 Pending | You (Resend Dashboard) |
| Configure `RESEND_API_KEY` in Netlify | 📋 Pending | You (Netlify Dashboard) |
| Unpause / resume Supabase project | 📋 Pending | You (Supabase Dashboard) |
| Run `supabase/migrations/20261023_publish_readiness_security_fix.sql` | 📋 Ready to paste | You (Supabase SQL Editor) |
| Set GitHub Actions secrets for keep-alive bot | 📋 Pending | You (GitHub Repository Settings) |
| Secure `/api/send-email` against open relay | ✅ **RESOLVED IN CODE** | Completed |
| Drop leaky quotation RLS policies & implement token RPC | ✅ **RESOLVED IN CODE** | Completed |
| Eliminate cross-account settings cache pollution | ✅ **RESOLVED IN CODE** | Completed |
| Isolate demoStore from real cloud users | ✅ **RESOLVED IN CODE** | Completed |
| Revert insecure passwordless offline login | ✅ **RESOLVED IN CODE** | Completed |
| Correct VAT rubrics 4a, 4b, 1e, 3b + whole-euro rounding | ✅ **RESOLVED IN CODE** | Completed |
| Replace test mocks with 17 real application code tests | ✅ **RESOLVED IN CODE** | Completed |
| Verify TypeScript typecheck & production build | ✅ **RESOLVED IN CODE** | Completed (0 errors) |

# ROADMAP.md: نقشه راه جامع، تفصیلی و ادغام‌شده توسعه اپلیکیشن حسابداری (MoneyBirds NL)

> **موقعیت پروژه:** ساب‌فولدر `frontend/`  
> **پایه معماری و الگوبرداری:** ادغام قابلیت‌های کلیدی **Moneybird.com** (۱۰ هدف کلیدی GOAL-01 تا GOAL-10) با ربات حسابداری تمام‌خودکار **Jortt.nl** (De Boekhoudbot)، با زیرساخت اختصاصی **۱۰۰٪ راست‌چین (Native RTL)** و وب‌اپلیکیشن پیشرونده (**PWA**) مجهز به اعلانات وب‌پوش.  
> **نحوه اجرای خودکار:** هر یک از اهداف زیر با استفاده از دستور اسلش **`/goal`** در محیط Antigravity قابل اجرای کاملاً مستقل و خودکار است.

---

## ۱. جدول ماتریس وضعیت اهداف نقشه راه (Roadmap Status Matrix)

| کد هدف | عنوان قابلیت | اسپرینت | وضعیت در کد فعلی `frontend/` | نحوه اجرا با دستور |
| :--- | :--- | :--- | :--- | :--- |
| **CORE-00** | **پایه سیستم:** ریسپانسیو فول‌اسکرین، نشست پایدار، فاکتور، هزینه، بانک و مالیات BTW | پایه | ✅ **تکمیل شده (۱۰۰٪)** | آماده در سورس کد |
| **CORE-01** | **زیرساخت PWA و RTL:** سرویس‌ورکر، مانیفست وب‌پوش، فونت وزیرمتن و استایل منطقی | اسپرینت ۱ | ✅ **تکمیل شده (۱۰۰٪)** | آماده در سورس کد |
| **[GOAL-02](#goal-02-quotations--digital-signatures-offertes)** | **پیش‌فاکتور و آفرها (Offerte):** پد امضای دیجیتال آنلاین و تبدیل ۱-کلیک به فاکتور | اسپرینت ۲ | ✅ **تکمیل شده (۱۰۰٪)** | آماده در سورس کد |
| **[GOAL-08](#goal-08-live-psd2-bank-sync--boekhoudbot)** | **ربات حسابداری (Boekhoudbot) و اتصال لایو PSD2:** تطبیق ۹۹٪ هوشمند تراکنش‌های بانک | اسپرینت ۳ | ⏳ *آماده اجرا* | `/goal GOAL-08` |
| **[GOAL-01](#goal-01-ai-receipt--smart-inbox-scanner)** | **اسکن هوشمند رسید (Smart Inbox):** استخراج خودکار فیلدهای فاکتور با هوش مصنوعی | اسپرینت ۴ | ⏳ *آماده اجرا* | `/goal GOAL-01` |
| **[GOAL-03](#goal-03-time--mileage-tracking-uren--ritten)** | **ثبت ساعت و مسافت:** سقف ۱۲۲۵ ساعت معافیت مالیاتی (Urencriterium) و مسافت (€0.23/km) | اسپرینت ۵ | ⏳ *آماده اجرا* | `/goal GOAL-03` |
| **[GOAL-04](#goal-04-automated-payment-reminders--dunning-wik)** | **پیگیری مطالبات و جریمه قانونی (WIK):** یادآوری ۳ مرحله‌ای با محاسبه خودکار خسارت | اسپرینت ۶ | ⏳ *آماده اجرا* | `/goal GOAL-04` |
| **[GOAL-05](#goal-05-direct-ideal-payments-mollie)** | **پرداخت آنلاین سریع (Mollie iDEAL):** لینک پرداخت آنی و تسویه اتوماتیک با وب‌هوک | اسپرینت ۷ | ⏳ *آماده اجرا* | `/goal GOAL-05` |
| **[GOAL-06](#goal-06-ubl-21-e-invoicing--peppol-bis-30)** | **فاکتور الکترونیک استاندارد (Peppol UBL 2.1):** سازگاری با شهرداری‌ها و سازمان‌های دولتی EU | اسپرینت ۷ | ⏳ *آماده اجرا* | `/goal GOAL-06` |
| **[GOAL-07](#goal-07-profit--loss-w-v--financial-reports)** | **سود و زیان (W&V) و گزارش‌های مالی:** ترازنامه، حاشیه سود ناخالص و پیش‌بینی مالیاتی | اسپرینت ۸ | ⏳ *آماده اجرا* | `/goal GOAL-07` |
| **[GOAL-09](#goal-09-icp-opgaaf--digipoort-tax-filing-xml)** | **اظهارنامه مستقیم به بلستینگ‌دینست (Digipoort XML) و گزارش معاملات درون‌اروپایی (ICP)** | اسپرینت ۸ | ⏳ *آماده اجرا* | `/goal GOAL-09` |
| **[GOAL-10](#goal-10-accountant-portal--auditfile-xaf-export)** | **پرتال حسابرسان و فایل خروجی حسابرسی رسمی هلند (Auditfile Financieel .xaf)** | اسپرینت ۸ | ⏳ *آماده اجرا* | `/goal GOAL-10` |

---

## ۲. دستاوردهای فاز پایه و اسپرینت ۱ (هم‌اکنون پیاده‌سازی‌شده در `frontend/`)

1. **طراحی واکنش‌گرا و فول‌اسکرین:**
   - تمام کانتینرهای باریک بازنویسی شده و با استاندارد `w-full max-w-[1800px] mx-auto` روی صفحات موبایل تا ۴K نمایش داده می‌شوند.
2. **مدیریت پایدار نشست (Session Stability):**
   - چرخه پایش ۴ دقیقه‌ای (Heartbeat)، سینک بین تب‌های باز با رویداد `storage`، و مدیریت لینک‌های ریکاوری رمز عبور.
   - رفع مشکل مصرف توکن‌های یکبارمصرف توسط آنتی‌اسپم ایمیل با امکان ورود دستی کد ۶ رقمی OTP در صفحه لاگین.
3. **فاکتورساز هلندی (`InvoiceEditor.tsx`):**
   - تفکیک مالیات‌های رسمی ۲۱٪، ۹٪، ۰٪ و Verlegd، تولید PDF استاندارد، و ارسال ایمیل فاکتور با Resend API.
4. **مدیریت هزینه‌ها (`Expenses.tsx`):**
   - رفع خطای `insertBefore` از طریق پورتال امن، محاسبه مالیات خرید Voorbelasting (روبیک ۵b).
5. **تطبیق دوجانبه بانکی (`BankReconciliation.tsx` + `mt940.ts`):**
   - ورود فایل MT940 بانک‌های ABN AMRO، ING و Rabobank، تطبیق با فاکتور و ایجاد مستقیم هزینه از روی تراکنش بانکی.
6. **محاسبه اظهارنامه مالیاتی فصلی (`TaxReturn.tsx`):**
   - تفکیک هوشمند درآمدها و هزینه‌ها در روبیک‌های ۱a تا ۵b بلستینگ‌دینست.
7. **زیرساخت PWA و RTL:**
   - ایجاد `public/sw.js` با قابلیت کش هوشمند و دریافت نوتیفیکیشن‌های وب‌پوش.
   - ایجاد `src/lib/pwaPush.ts` برای مدیریت سابسکرایب به اعلانات با کلید VAPID.
   - پیکربندی `public/manifest.json` با متادیتای راست‌چین و شرت‌کات‌ها.
   - ادغام فونت **Vazirmatn** در `src/index.css` و تعریف ایزولاسیون شبا `<bdi dir="ltr">`.

---

## ۳. جزییات اسپرینت‌های عملیاتی آینده و پرامپت‌های اجرایی `/goal`

---

### GOAL-02: Quotations & Digital Signatures (Offertes)
* **اسپرینت:** ۲ | **درجه سختی:** متوسط | **الگو:** Moneybird Offertebeheer
* **هدف:** ایجاد سامانه صدور آفر و پیش‌فاکتور با پد امضای دیجیتال و امکان تبدیل با ۱ کلیک به فاکتور رسمی.
* **تغییرات دیتابیس:**
```sql
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  quotation_number VARCHAR(64) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, ACCEPTED, REJECTED, CONVERTED
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_vat NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  signature_data_url TEXT,
  signed_at TIMESTAMPTZ,
  converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
#### پرامپت اجرایی با `/goal`:
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

### GOAL-08: Live PSD2 Bank Sync & Boekhoudbot
* **اسپرینت:** ۳ | **درجه سختی:** بالا | **الگو:** Jortt Boekhoudbot + Moneybird Bankkoppeling
* **هدف:** دریافت شبانه خودکار گردش حساب بانک‌های هلند (ING, Rabo, ABN, Bunq) و اجرای الگوریتم تطبیق فازی ۹۹٪.
#### پرامپت اجرایی با `/goal`:
```text
/goal Implement Live PSD2 Bank Account Synchronization & Boekhoudbot (GOAL-08) for AliBirds using GoCardless Bank Data API.
1. Create serverless Netlify functions for GoCardless (Nordigen) PSD2 Bank Integration:
   - `gocardless-connect.ts`: Initiates institution requisition for Dutch banks (ING, Rabobank, ABN AMRO, Bunq, Knab, SNS).
   - `gocardless-sync.ts`: Fetches latest transactions and deduplicates entries by transaction_id / date / amount.
2. In BankReconciliation.tsx, add a "Live Bankkoppeling" banner with connection status.
3. Create frontend/src/lib/boekhoudbot.ts executing a 99% auto-matching algorithm matching invoices and common recurring expenses (Shell, TransIP, KVK).
4. Send web push alert when transactions are auto-reconciled. Verify build.
```

---

### GOAL-01: AI Receipt & Smart Inbox Scanner
* **اسپرینت:** ۴ | **درجه سختی:** بالا | **الگو:** Moneybird Smart Inbox
* **هدف:** اسکن رسید کاغذی یا PDF با دوربین/دراپ‌زون و استخراج هوشمند تامین‌کننده، تاریخ و نرخ مالیات.
#### پرامپت اجرایی با `/goal`:
```text
/goal Implement the AI Receipt & Smart Inbox Scanner (GOAL-01) for AliBirds.
1. Create frontend/src/lib/ocrScanner.ts to process receipt images (JPEG, PNG, WebP) and PDF documents. Implement robust extraction of: vendor_name, expense_date (ISO format), total_amount, vat_rate (21, 9, 0, or REVERSE_CHARGE), vat_amount, and category suggestion.
2. In frontend/src/pages/Expenses.tsx, add a modern drag-and-drop "Smart Inbox" zone with file picker and camera snap option.
3. When a receipt is dropped, display a processing state with a pulsing shimmer, extract receipt fields, and open the Add Expense modal pre-filled with the extracted data alongside a side-by-side image/PDF preview.
4. Ensure full responsiveness across mobile and wide desktop screens.
5. Verify with `npm run build` and ensure zero errors.
```

---

### GOAL-03: Time & Mileage Tracking (Uren- & Ritten)
* **اسپرینت:** ۵ | **درجه سختی:** متوسط | **الگو:** Moneybird Urenregistratie
* **هدف:** پایش شرط ۱۲۲۵ ساعت سالانه کارآفرینان (Urencriterium) جهت تخفیف مالیاتی و محاسبه هزینه تردد خودرو (€0.23/km).
#### پرامپت اجرایی با `/goal`:
```text
/goal Implement Time Tracking & Mileage Tracking (Uren- & Rittenregistratie) (GOAL-03) for AliBirds.
1. Create database tables `time_entries` and `mileage_entries` with client relations.
2. Build frontend/src/pages/TimeTracking.tsx with:
   - A live start/pause/stop task timer.
   - Weekly/monthly time log grid with billable/unbillable toggles.
   - Dutch Belastingdienst Urencriterium progress widget (target: 1,225 hrs/year) with status indicator.
3. Build Mileage Tracking component calculating statutory €0.23/km with a 1-click "Boek als zakelijke uitgave" button that generates a corresponding record in the `expenses` table.
4. In InvoiceEditor.tsx, add a "Niet-gefactureerde uren toevoegen" button that selects unbilled time entries and populates invoice lines.
5. Add navigation items and verify build status.
```

---

### GOAL-04: Automated Payment Reminders & Dunning (WIK)
* **اسپرینت:** ۶ | **درجه سختی:** متوسط | **الگو:** قوانین رسمی وصول مطالبات هلند (Wet Incassokosten)
* **هدف:** پیگیری خودکار فاکتورهای سررسیدگذشته در ۳ مرحله با محاسبه دقیق خسارت قانونی تاخیر و کارمزد WIK.
#### پرامپت اجرایی با `/goal`:
```text
/goal Build the Automated Payment Reminders & Dunning System (GOAL-04) for AliBirds.
1. Create frontend/src/lib/dunning.ts implementing Dutch statutory debt collection calculations (Wet Normering Buitengerechtelijke Incassokosten - WIK) and statutory interest (Wettelijke handelsrente).
2. In frontend/src/pages/InvoiceList.tsx, add clear visual overdue chips showing overdue days and reminder stage.
3. Build frontend/src/components/DunningModal.tsx with 3 escalating tiers:
   - Tier 1: Vriendelijke herinnering (Grace period reminder).
   - Tier 2: 1e Aanmaning (Formal payment reminder).
   - Tier 3: Ingebrekestelling (Final demand letter including calculated WIK fee + statutory interest).
4. Integrate with the existing email sender to transmit the reminder along with original PDF invoice.
5. Test build with `npm run build`.
```

---

### GOAL-05 & GOAL-06: Direct iDEAL Payments & Peppol UBL 2.1
* **اسپرینت:** ۷ | **درجه سختی:** بالا | **الگو:** Mollie + Peppol BIS Billing 3.0
* **هدف:** افزودن پرداخت با ۱ کلیک iDEAL به فاکتورها، و صدور استاندارد UBL XML برای ارگان‌های دولتی.
#### پرامپت اجرایی با `/goal`:
```text
/goal Implement Direct iDEAL Payments with Mollie (GOAL-05) and Peppol UBL 2.1 E-Invoicing (GOAL-06) for AliBirds.
1. Add Mollie payment configuration fields in Settings.tsx.
2. Create serverless Netlify function `netlify/functions/mollie-create-payment.ts` that initializes an iDEAL payment with invoice amount, and `netlify/functions/mollie-webhook.ts` that receives payment confirmation and marks invoice as PAID.
3. Create frontend/src/lib/ublGenerator.ts to generate valid UBL 2.1 XML following PEPPOL BIS Billing 3.0 standards.
4. Add "Download UBL (XML)" button in InvoiceList.tsx and InvoiceEditor.tsx.
5. Attach both PDF and UBL XML to outbound invoice emails. Verify build.
```

---

### GOAL-07, GOAL-09 & GOAL-10: P&L Reports, Digipoort Tax Export & Accountant Portal
* **اسپرینت:** ۸ | **درجه سختی:** بالا | **الگو:** ترازنامه Jortt + صورت مالیات سالانه هلند
* **هدف:** گزارش سود و زیان (W&V)، خروجی XML ارسال مستقیم به Digipoort بلستینگ‌دینست، گزارش ICP، و فایل حسابرسی XAF 3.2.
#### پرامپت اجرایی با `/goal`:
```text
/goal Build Financial Reports, Digipoort Tax Export, and Accountant Auditfiles (GOAL-07, GOAL-09, GOAL-10) for AliBirds.
1. Create frontend/src/pages/Reports.tsx and frontend/src/lib/reporting.ts computing Net Turnover, Gross Margin, Categorized Operational Costs, and Net Profit before Tax.
2. In frontend/src/lib/taxExport.ts, implement the Dutch Belastingdienst XML schema for Omzetbelasting (OB) and Opgaaf ICP (Rubriek 3b). Add export buttons in TaxReturn.tsx.
3. Create frontend/src/lib/auditfileGenerator.ts that formats general ledger data into standard Auditfile Financieel (XAF version 3.2 XML).
4. Add a "Download Auditfile Financieel (.xaf)" button in Reports.tsx and Accountant Invite token generator in Settings.tsx.
5. Verify build with `npm run build`.
```

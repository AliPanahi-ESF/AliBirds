# AGENT.md: مستندات جامع فنی، معماری و راهنمای توسعه پلتفرم هوشمند حسابداری هلند (MoneyBirds NL)

> **خلاصه اجرایی سیستم:**  
> پلتفرم **MoneyBirds NL**، سیستم جامع، تمام‌خودکار و ابری مدیریت مالی و حسابداری ویژه بازار هلند (Netherlands) است که با الگوبرداری مستقیم و ادغام برترین قابلیت‌های دو پلتفرم پیشرو بازار هلند یعنی **Moneybird** (پیشرو در فاکتورسازی، آفرها، مدیریت زمان و مسافت) و **Jortt** (پیشرو در ربات حسابداری تمام‌خودکار، اتصال مستقیم بانکی، اظهارنامه بلستینگ‌دینست و صورت‌های مالی سالانه KVK) طراحی شده است.  
> **وجه تمایز بنیادین و نوآوری بی‌رقیب:** این پلتفرم اولین و تنها سیستم حسابداری سازگار با قوانین مالیاتی هلند (Belastingdienst) است که **۱۰۰٪ راست‌چین (Native RTL)** بوده و با تایپوگرافی اختصاصی (`B Yekan` / `Vazirmatn`)، فرمت‌بندی دوطرفه اعداد و مبالغ مالی، اپلیکیشن پیشرونده وب (**PWA**) و سیستم پوش‌نوتیفیکیشن لحظه‌ای مجهز شده است.

---

## ۱. تحلیل جامع رقابتی و بنچ‌مارک بازاری (Full Sweep Competitive Teardown)

بر اساس ارزیابی دقیق پلتفرم‌های **Moneybird.com** و **Jortt.nl**، ماتریس تطبیقی زیر جهت تعیین جایگاه محصولی و معماری فنی پلتفرم استخراج گردیده است:

### ماتریس مقایسه تطبیقی Moneybird vs. Jortt vs. MoneyBirds RTL:

| محور عملکردی | مانی‌برد (Moneybird.com) | یورت (Jortt.nl) | **MoneyBirds NL (پلتفرم ما)** |
| :--- | :--- | :--- | :--- |
| **فلسفه پایه** | Invoicing & Workflow First | Bank-First & Boekhoudbot (خودکارسازی ۹۹٪) | **ترکیب ربات خودکار بانکی + صدور هوشمند فاکتور** |
| **زبان و چیدمان UI** | LTR صرفاً هلندی/انگلیسی | LTR صرفاً هلندی | **۱۰۰٪ راست‌چین (RTL) با تایپوگرافی اختصاصی B Yekan + دوگانه هلندی** |
| **اتصال بانکی (Banking)** | PSD2 + حساب تجاری Adyen | اتصال خودکار بانکی PSD2 (تمام بانک‌های هلند) | **اتصال لایو PSD2 (GoCardless/Ponto) + آپلود MT940/CAMT.053** |
| **ربات تطبیق حساب** | تطبیق نیمه‌خودکار دستی | ربات Boekhoudbot (تطبیق ۹۹٪ بدون دخالت کاربر) | **موتور هوشمند ربات حسابداری (AI Boekhoudbot) با تطبیق آنی** |
| **اسکن فاکتور (OCR)** | Smart Inbox با هوش مصنوعی | AI Scan en Herken | **اسکن هوشمند چندحالته (Gemini Vision / Tesseract / Regex)** |
| **اظهارنامه مالیاتی (BTW)** | محاسبه و ارسال الکترونیک | ارسال مستقیم ۱-کلیک به Digipoort بلستینگ‌دینست | **محاسبه دقیق روبیک‌های ۱a تا ۵g + خروجی استاندارد Digipoort XML** |
| **آفر و پیش‌فاکتور (Offerte)** | امضای دیجیتال آنلاین + تبدیل به فاکتور | امضای دیجیتال آنلاین | **طراحی آفر RTL + پد امضای دیجیتال لمسی + تبدیل ۱-کلیک به فاکتور** |
| **شبکه پپول (Peppol)** | ارسال و دریافت Peppol UBL 2.1 | ارسال و دریافت از طریق Peppol | **تولید خودکار UBL 2.1 (PEPPOL BIS 3.0) پیوست ایمیل و دانلود** |
| **ثبت ساعت و مسافت** | تایمر زنده + مسافت‌شمار (€0.23/km) | ثبت ساعت و پروژه‌ها | **تایمر Urencriterium (۱۲۲۵ ساعت سالانه) + ثبت مسافت با تعرفه قانونی** |
| **گزارش‌های مالی سالانه** | سود و زیان (P&L) + ترازنامه | صورت مالی سالانه KVK Jaarrekening (Norm 4410) | **سود و زیان، ترازنامه، گزارش مالیاتی سالانه و فایل XAF حسابرس** |
| **پرداخت آنلاین فاکتور** | Mollie / iDEAL / کارت اعتباری | پرداخت فاکتور با iDEAL و دایرکت دبیت SEPA | **اتصال مستقیم Mollie iDEAL + لینک‌های سریع بانکی (Bunq/Tikkie)** |
| **پشتیبانی موبایل و وب** | اپلیکیشن نیتیو iOS / Android | اپلیکیشن موبایل | **PWA مستقل و فوق‌سریع + Service Worker + پوش‌نوتیفیکیشن لحظه‌ای** |

---

## ۲. سیستم طراحی راست‌چین و استانداردهای بصری (100% RTL Design System)

پلتفرم به گونه‌ای مهندسی شده است که چیدمان عناصر، انیمیشن‌ها، نمودارهای مالی و فیلدهای داده بدون کوچک‌ترین نقص در حالت راست‌چین عمل کنند:

### ۲.۱. قوانین معماری CSS و ویژگی‌های منطقی (Logical Properties):
1. **جهت کلی سند:** روت سند دارای تگ `<html lang="fa" dir="rtl">` است.
2. **استفاده اکید از Logical Properties:** به جای استفاده از `left` و `right`، تمام استایل‌ها بر پایه مقادیر منطقی پیاده‌سازی می‌شوند:
   - `margin-inline-start` / `margin-inline-end` (در تیل‌ویند: `ms-*` و `me-*`).
   - `padding-inline-start` / `padding-inline-end` (در تیل‌ویند: `ps-*` و `pe-*`).
   - `inset-inline-start` / `inset-inline-end` (در تیل‌ویند: `start-*` و `end-*`).
   - `text-align: start` (راست در حالت فارسی) و `text-align: end` (چپ در حالت فارسی).
3. **معکوس‌سازی آیکون‌ها و نشانگرها:** آیکون‌های دارای جهت‌برداری (مانند `ArrowRight`، `ChevronRight`، مراحل ویزارد و پروگرس‌بارها) به صورت خودکار با استایل `transform: scaleX(-1)` آینه‌ای (Mirror) می‌شوند.

### ۲.۲. استک تایپوگرافی (Typography Stack):
* **فونت اصلی فارسی:** `B Yekan` (شامل فرمت‌های مدرن `.woff2` و `.woff` با اعداد فارسی خوانا و اعداد اعشاری دقیق).
* **فونت‌های جایگزین (Fallback):** `Vazirmatn`, `IRANYekan`, `Tahoma`, `sans-serif`.
* **فونت لاتین برای اصطلاحات رسمی مالی هلندی:** `Inter`, `Outfit`, `monospace` (جهت نمایش دقیق و استاندارد کدهای IBAN، شماره‌های KVK و کد اقتصادی BTW-id).

### ۲.۳. موتور فرمت‌بندی دوطرفه داده‌های مالی (Bidirectional Financial Engine):
سیستم مجهز به هلپرهای محاسباتی جهت جلوگیری از به هم ریختگی متون چندزبانه است:
* **کد بانکی شبا هلند (Dutch IBAN):** کاراکترهای IBAN هلندی (مانند `NL91 ABNA 0417 1643 00`) با دایرکشن ایزوله `<bdi dir="ltr" class="font-mono">` رندر می‌شوند تا جابجایی کاراکتر در متن فارسی رخ ندهد.
* **مبالغ یورو (€):** نمایش استاندارد مبالغ با جداکننده سه رقمی و اعشار دو رقمی به همراه نماد یورو (مثال: `€ ۱٬۴۵۰٫۵۰` یا `۱٬۴۵۰٫۵۰ €`).
* **شناسه مالیاتی و ثبت شرکت:** شماره KVK (۸ رقم) و BTW-id (مثال: `NL855510444B01`) با دایرکشن کنترل‌شده چپ‌به‌راست محلی.

### ۲.۴. پالت رنگی و استایل دارک نئونی (Fintech Cyber-Glow Palette):
* **پس‌زمینه اصلی (Canvas Background):** `#030712` (Slate 950 بسیار تیره و عمیق).
* **کارت‌ها و پنل‌های شیشه‌ای (Glassmorphism Surfaces):** `rgba(15, 23, 42, 0.8)` همراه با افکت بلور `backdrop-filter: blur(16px)` و بوردر نرم `border-slate-800/80`.
* **رنگ برند و درآمد (Primary Revenue):** سبز امرالد نئونی `#10B981` و `#059669` (نماد سودآوری، فاکتورهای پرداخت‌شده و انطباق بانکی).
* **رنگ اکشن دوم و مالیات (Accent & Tax):** بنفش سایبری `#8B5CF6` و آبی پروس `#2563EB` (نماد اظهارنامه مالیاتی، آفرها و اتوماسیون).
* **رنگ هشدار مالی (Overdue / Risk):** سرخ رز `#F43F5E` (فاکتورهای منقضی و مطالبات قانونی).
* **رنگ موعد و پیش‌بینی (Warning / Projection):** کهربایی زرین `#F59E0B`.

### ۲.۵. انطباق کامل و واکنش‌گرایی همه‌جانبه (Full-Screen Responsiveness):
* چیدمان منعطف با کانتینر عریض `max-w-[1800px] w-full mx-auto`.
* سازگاری کامل از موبایل‌های کوچک (۳۶۰ پیکسل)، تبلت‌ها، لپ‌تاپ‌های فول اچ‌دی (۱۰۸۰p) تا مانیتورهای عریض و اولتراواید (1440p و 4K).
* مجهز به **داک ناوبری شناور پایینی مخصوص موبایل (Mobile Bottom Navigation Dock)** با دسترسی تک‌لمسی به ثبت سریع هزینه، صدور فاکتور، اسکن رسید و گزارش BTW.

---

## ۳. معماری PWA و سامانه وب‌پوش نوتیفیکیشن (PWA & Web Push Hub)

اپلیکیشن وب به عنوان یک **Progressive Web App (PWA)** درجه یک پیاده‌سازی شده است که بدون نیاز به اپ‌استورها روی تمام سیستم‌عامل‌ها (iOS, Android, macOS, Windows) نصب می‌شود:

### ۳.۱. مشخصات مانیفست وب (`manifest.webmanifest`):
```json
{
  "name": "MoneyBirds NL | حسابداری هوشمند و تمام‌خودکار هلند",
  "short_name": "MoneyBirds",
  "description": "پلتفرم تمام‌خودکار حسابداری، فاکتورسازی و اظهارنامه مالیاتی هلند (۱۰۰٪ راست‌چین)",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "dir": "rtl",
  "lang": "fa-NL",
  "theme_color": "#030712",
  "background_color": "#030712",
  "icons": [
    { "src": "/icons/icon-72x72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96x96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128x128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144x144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152x152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384x384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    {
      "name": "فاکتور جدید",
      "short_name": "فاکتور",
      "url": "/invoices/new",
      "icons": [{ "src": "/icons/shortcut-invoice.png", "sizes": "96x96" }]
    },
    {
      "name": "اسکن رسید (OCR)",
      "short_name": "اسکن رسید",
      "url": "/expenses?action=scan",
      "icons": [{ "src": "/icons/shortcut-scan.png", "sizes": "96x96" }]
    },
    {
      "name": "اظهارنامه مالیاتی BTW",
      "short_name": "مالیات",
      "url": "/tax",
      "icons": [{ "src": "/icons/shortcut-tax.png", "sizes": "96x96" }]
    }
  ]
}
```

### ۳.۲. سرویس ورکر پیشرفته (`sw.js`):
* **استراتژی کش هوشمند:**
  * دارایی‌های ایستا (HTML, CSS, JS, فونت B Yekan, آیکون‌ها): **Cache-First** با اعتبارسنجی مجدد در پس‌زمینه (Stale-While-Revalidate).
  * درخواست‌های داده‌ای و API مالی: **Network-First** با ذخیره امن در حافظه موقت ایزوله IndexedDB جهت دسترسی در حالت آفلاین.
* **سینک پس‌زمینه (Background Sync):**
  * ذخیره فاکتورها یا رسیدهای ثبت‌شده در زمان قطع اینترنت و ارسال خودکار به محض آنلاین شدن.

### ۳.۳. مرکز اعلانات وب‌پوش (Web Push Engine & VAPID Hub):
پلتفرم به استاندارد رسمی W3C Push API و VAPID Keys مجهز شده و در رویدادهای کلیدی اعلانات آنی ارسال می‌نماید:

```javascript
// نمونه پی‌لود پوش‌نوتیفیکیشن مالی
{
  "title": "دریافت وجه فاکتور! 💳",
  "body": "فاکتور شماره 2026-0042 به مبلغ ۱٬۴۵۰٫۵۰ یورو از طریق iDEAL تسویه شد.",
  "icon": "/icons/icon-192x192.png",
  "badge": "/icons/badge-72x72.png",
  "dir": "rtl",
  "lang": "fa",
  "tag": "payment-received",
  "data": {
    "url": "/invoices/2026-0042",
    "invoiceId": "uuid-here",
    "timestamp": 1790095400
  },
  "actions": [
    { "action": "view", "title": "مشاهده فاکتور" },
    { "action": "dismiss", "title": "بستن" }
  ]
}
```

#### سناریوهای تریگر پوش‌نوتیفیکیشن:
1. **تسویه آنی فاکتور (Instant Payment Alert):** واریز وجه مشتری از طریق درگاه iDEAL / Mollie یا تطبیق موفق تراکنش بانکی.
2. **هشدار موعد اظهارنامه فصلی BTW:** ارسال نوتیفیکیشن در روزهای ۱۰، ۵، و ۱ روز مانده به پایان مهلت ارسال به سازمان امور مالیاتی هلند (Belastingdienst).
3. **تطبیق خودکار توسط ربات (Boekhoudbot Match):** اطلاع‌رسانی تطبیق هوشمند تراکنش‌های بانکی جدید بدون نیاز به تایید دستی.
4. **امضای آنلاین آفر (Quote Signed):** اطلاع آنی از امضای الکترونیک پیش‌فاکتور توسط مشتری و آمادگی برای صدور فاکتور نهایی.
5. **مطالبات معوق و ارسال خودکار اخطاریه (WIK Dunning Notice):** گزارش سررسید دیرکرد فاکتور و اعمال خسارت تاخیر تادیه قانونی.

---

## ۴. موتور ربات حسابداری تمام‌خودکار (The Automated Boekhoudbot Engine)

مشابه با فناوری پیشرفته **Boekhoudbot در Jortt**، هسته پلتفرم بر پایه رویکرد "Bank-First" عمل می‌کند:

```
[صورت‌حساب بانکی (PSD2 / MT940)]
               │
               ▼
┌──────────────────────────────────────────────┐
│       موتور ربات حسابداری (Boekhoudbot)      │
│ 1. پاک‌سازی رشته تراکنش و استخراج IBAN      │
│ 2. تشخیص فاکتور درآمد با شماره فاکتور/مبلغ    │
│ 3. تشخیص هزینه‌های تکرارشونده (نرم‌افزار/بیمه) │
│ 4. محاسبه اتوماتیک مالیات بر ارزش افزوده (BTW)│
│ 5. تخصیص کد کل معین و ثبت بستانکار/بدهکار    │
└──────────────────────────────────────────────┘
         │                           │
         ▼ (۹۹٪ تطبیق خودکار)        ▼ (تراکنش نامشخص)
[تایید و ثبت نهایی در دفاتر]      [ارسال اعلان به کاربر با یک کلیک]
```

### الگوریتم‌های کلیدی ربات حسابداری:
1. **تطبیق دقیق و فازی (Fuzzy String Matching):**
   * تطبیق شماره فاکتور (مثال: `2026-0012` یا `Factuur 12`) با استفاده از فاصله لون‌اشتاین (Levenshtein Distance).
   * تطبیق مبلغ دقیق اعشاری سنت به سنت (`total_amount`).
2. **کتابخانه الگوهای بانکی هلند (Dutch Bank Pattern Library):**
   * شناسایی خودکار تراکنش‌های مشهور مانند سوخت (Shell, BP), هاستینگ و کلاود (AWS, Google, TransIP), مخابرات (KPN, Vodafone), بیمه (Zilveren Kruis) و تخصیص مستقیم به حساب معین مربوطه با اعمال نرخ مالیات ۲۱٪ یا معافیت.
3. **تفکیک خودکار دوگانه مالیات (Dual-Mode VAT Splitting):**
   * تفکیک آنی مبلغ ناخالص (Inclusief btw) به خالص و مالیات پرداختی (Voorbelasting ۵b) با دقت ریاضی مضاعف تا از خطاهای گرد کردن در فرم‌های Belastingdienst جلوگیری گردد.

---

## ۵. هسته انطباق با قوانین مالیاتی و حقوقی هلند (Dutch Tax & Legal Compliance)

### ۵.۱. ماژول اظهارنامه فصلی مالیات بر ارزش افزوده (BTW-Aangifte):
سیستم مقادیر را دقیقاً بر اساس روبیک‌های استاندارد اداره مالیات هلند محاسبه و آماده ارسال می‌نماید:
* **Rubriek 1 (فعالیت‌های داخل هلند):**
  * `1a`: نرخ استاندارد ۲۱٪ (Hoog tarief).
  * `1b`: نرخ تخفیفی ۹٪ (Laag tarief - مواد غذایی، خدمات خاص).
  * `1c`: سایر نرخ‌ها.
  * `1d`: مصرف شخصی / بهره‌برداری خصوصی (Privégebruik).
* **Rubriek 2 (مالیات معکوس داخلی):**
  * `2a`: مالیات معکوس‌شده داخلی هلند (Verleggingsregeling binnenland).
* **Rubriek 3 (صادرات و خدمات برون‌مرزی):**
  * `3a`: ارائه کالا و خدمات به خارج از اتحادیه اروپا (Buiten de EU).
  * `3b`: ارائه کالا و خدمات به کشورهای عضو اتحادیه اروپا (Leveringen/diensten naar EU-landen - ICP).
* **Rubriek 4 (واردات و خرید از خارج):**
  * `4a`: خرید کالا/خدمات از خارج اتحادیه اروپا.
  * `4b`: خرید کالا/خدمات از داخل اتحادیه اروپا (Btw verlegd).
* **Rubriek 5 (مالیات پرداختی و تسویه نهایی):**
  * `5a`: مجموع مالیات محاسبه شده.
  * `5b`: مالیات بر ارزش افزوده پرداختی خریدها و هزینه‌ها (Voorbelasting).
  * `5g`: مانده قابل پرداخت یا قابل استرداد (Totaal te betalen / te ontvangen).

### ۵.۲. سیستم گزارش‌دهی برون‌مرزی اتحادیه اروپا (Opgaaf ICP):
فاکتورهای صادر شده برای شرکت‌های دارای شناسه معتبر مالیاتی در کشورهای اروپایی (آلمان، فرانسه، بلژیک و...) به صورت خودکار به تفکیک شماره مالیاتی مشتری استخراج و تجمیع می‌گردند.

### ۵.۳. فاکتور الکترونیک استاندارد اروپایی (UBL 2.1 & Peppol BIS 3.0):
هر فاکتور صادر شده علاوه بر نسخه چاپی و PDF، به صورت فایل XML با استاندارد **EN 16931 / PEPPOL BIS Billing 3.0** تولید می‌شود تا مستقیماً در نرم‌افزارهای حسابداری مقصد یا سامانه‌های دولتی هلند پردازش گردد.

### ۵.۴. قانون رسمی مطالبه خسارت تاخیر در هلند (WIK Dunning Engine):
محاسبه خودکار خسارت دیرکرد بر اساس قانون مصوب پارلمان هلند (*Wet Normering Buitengerechtelijke Incassokosten*):
* ۱۵٪ برای ۲٬۵۰۰ یوروی اول بدهی (حداقل ۴۰ یورو).
* ۱۰٪ برای ۲٬۵۰۰ یوروی دوم.
* ۵٪ برای ۵٬۰۰۰ یوروی سوم.
* ۱٪ برای مبالغ تا ۱۹۰٬۰۰۰ یورو و ۰٫۵٪ برای مازاد آن.
* محاسبه بهره دیرکرد تجاری قانونی (*Wettelijke handelsrente*).

### ۵.۵. ثبت ساعت جهت بهره‌مندی از معافیت مالیاتی کارآفرینان (Urencriterium):
قوانین مالیاتی هلند تصریح می‌کند که برای بهره‌مندی از معافیت پایه کارآفرینی (*Zelfstandigenaftrek* و *Startersaftrek*)، فرد باید سالانه حداقل **۱٬۲۲۵ ساعت** در کسب‌وکار خود فعالیت ثبت کرده باشد. پلتفرم با یک ویجت هوشمند لحظه‌ای درصد پیشرفت سالانه به سمت ۱۲۲۵ ساعت را پایش می‌نماید.

---

## ۶. معماری پایگاه داده و جداول سوپابیس (Database Architecture)

پایگاه داده در Supabase (PostgreSQL 15+) با سیاست‌های امنیتی سطح ردیف (Row Level Security - RLS) ایزوله شده است:

```sql
-- ۱. جدول سازمان / پروفایل کسب‌وکار
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  kvk_number VARCHAR(16) NOT NULL,
  vat_number VARCHAR(32) NOT NULL, -- e.g. NL855510444B01
  iban VARCHAR(40) NOT NULL,
  bic VARCHAR(16),
  address_street VARCHAR(255),
  address_postcode VARCHAR(16),
  address_city VARCHAR(128),
  country_code VARCHAR(4) DEFAULT 'NL',
  preferred_language VARCHAR(8) DEFAULT 'fa', -- 'fa', 'nl', 'en'
  preferred_direction VARCHAR(8) DEFAULT 'rtl', -- 'rtl', 'ltr'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ۲. جدول مشتریان و طرف‌های تجاری
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(128),
  email VARCHAR(255),
  phone VARCHAR(64),
  vat_number VARCHAR(32),
  kvk_number VARCHAR(16),
  billing_address_street VARCHAR(255),
  billing_address_postcode VARCHAR(16),
  billing_address_city VARCHAR(128),
  country_code VARCHAR(4) DEFAULT 'NL',
  default_payment_term_days INTEGER NOT NULL DEFAULT 14,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ۳. جدول فاکتورهای فروش
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number VARCHAR(64) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, OVERDUE, CANCELLED
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  vat_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_link_url TEXT,
  ubl_xml_content TEXT,
  paid_at TIMESTAMPTZ,
  reminder_level INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ۴. جدول هزینه‌ها و اسکن فاکتور خرید
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vat_rate VARCHAR(32) NOT NULL DEFAULT '21', -- 21, 9, 0, REVERSE_CHARGE, EXEMPT
  amount_excl_vat NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  amount_incl_vat NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  receipt_url TEXT,
  ocr_status VARCHAR(32) DEFAULT 'PENDING',
  is_reconciled BOOLEAN NOT NULL DEFAULT false,
  matched_transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ۵. جدول تراکنش‌های بانکی و لاگ Boekhoudbot
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_iban VARCHAR(40) NOT NULL,
  transaction_date DATE NOT NULL,
  counterparty_name VARCHAR(255),
  counterparty_iban VARCHAR(40),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL, -- مثبت = بستانکار/دریافت، منفی = بدهکار/پرداخت
  balance_after NUMERIC(12,2),
  reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'UNMATCHED', -- UNMATCHED, MATCHED_INVOICE, MATCHED_EXPENSE, AUTO_BOOKED
  matched_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  matched_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ۶. جدول پیش‌فاکتورها و آفرها (Offertes)
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  quotation_number VARCHAR(64) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, ACCEPTED, REJECTED, CONVERTED
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  signature_image_data TEXT,
  signed_by_name VARCHAR(128),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ۷. سابسکرایب‌های وب‌پوش نوتیفیکیشن
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## ۷. راهنمای توسعه‌دهنده و پروتکل‌های هوش مصنوعی (AI Agent Protocols)

هنگام افزودن یا ویرایش هر کامپوننت در پلتفرم **MoneyBirds NL**، عامل‌های هوشمند موظف به رعایت اصول زیر هستند:
1. **قانون تغییرناپذیر RTL:** هر المان نمایشی، کارت، مودال، سایدبار یا فرم ورودی باید در ابتدا با فرض `dir="rtl"` و کلاس‌های منطقی تیل‌ویند (`ms-*`, `me-*`, `start-*`, `end-*`) پیاده‌سازی شود. هرگز از `left-` یا `right-` استفاده نکنید مگر آنکه داخل بلاک‌های ایزوله LTR مانند کدهای IBAN قرار داشته باشد.
2. **یکپارچگی محاسبات مالیاتی هلند:** مالیات بر ارزش افزوده هلند هرگز نباید با گرد کردن سرانگشتی محاسبه شود. مبالغ باید همیشه با فرمول دقیق روبیک‌های هلند (ضرب در نرخ و تقسیم بر ۱۲۱ در حالت شامل مالیات) تفکیک گردند.
3. **پایداری PWA و Service Worker:** در زمان تغییر کدهای فرانکتور، نسخه کش در `sw.js` به‌روزرسانی شود و کش قبلی بدون اختلال در نشست کاربر پاکسازی گردد.
4. **تست بیلد کامل:** پیش از اتمام کار، اجرای `npm run build` اجباری است و خروجی باید بدون هیچ هشدار تایپ‌اسکریپت به پایان برسد.

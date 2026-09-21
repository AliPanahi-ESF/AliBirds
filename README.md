# AliBirds 🐦

**Zelf-gehoste Dutch ZZP Accounting & Invoicing Platform**

A self-hosted web application delivering Moneybird-parity features for Dutch freelancers and studios.

## Features

- ✅ **Automated PDF Invoicing** — WeasyPrint A4 invoices with KVK, BTW-id, IBAN, sequential numbering
- ✅ **Dual VAT Mode** — Toggle between excl./incl. VAT input with live recalculation
- ✅ **MT940 Bank Reconciliation** — Drag-and-drop bunq/ING/Rabobank .sta import + fuzzy matching
- ✅ **Btw-aangifte** — Automated quarterly VAT rubric aggregation (1a, 1b, 3b, 5b) with click-to-copy
- ✅ **Recurring Invoices** — Daily cron (08:00 AMS) with auto-email and frequency scheduling
- ✅ **Expense Tracking** — VAT-deductible input tax recording by category
- ✅ **EU Reverse Charge** — Automatic "Btw verlegd" detection for EU B2B clients with valid VAT numbers
- ✅ **Dark UI** — Modern fintech-inspired dashboard with monospaced financial data display

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Python 3.12 + FastAPI + SQLAlchemy (async) |
| Database | SQLite (default) / PostgreSQL |
| PDF | WeasyPrint + Jinja2 HTML templates |
| Email | aiosmtplib (async SMTP) |
| Scheduler | APScheduler (cron) |
| Reconciliation | Custom MT940 parser + RapidFuzz fuzzy matching |

## Quick Start

### Development

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Start the backend
cd backend
pip install -e .
uvicorn app.main:app --reload --port 8000

# 3. Start the frontend (new terminal)
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

## Deployment Modes

### Mode A: 100% Free Serverless (Netlify + Supabase + Resend) — Recommended ⭐
Run AliBirds with **zero server costs** and **zero container maintenance**:
1. **Frontend**: Hosted on **Netlify** (free CDN, auto-build on git push).
2. **Database**: Hosted on **Supabase** (free PostgreSQL, 500MB storage).
   - Create a free project at [supabase.com](https://supabase.com).
   - In Supabase SQL Editor, paste and run [`supabase/schema.sql`](supabase/schema.sql).
   - In AliBirds web app -> **Instellingen** -> **Cloud & Integraties**, paste your Supabase URL & Anon Key.
3. **In-Browser PDF Generator**: Print or export crisp vector A4 Dutch invoices directly in the browser on iOS, Android, and Desktop.
4. **Email Dispatch**: Send invoice emails directly to clients using **Resend** (3,000 free emails/month) or the built-in mailto link.

### Mode B: Self-Hosted Docker / Localhost
Run everything on your own machine or VPS with Python FastAPI, SQLite/Postgres, WeasyPrint, and APScheduler:

```bash
cp .env.example .env
docker-compose up -d
# → Frontend: http://localhost:3000
# → API docs: http://localhost:8000/docs
```

## Project Structure

```
alibirds/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── core/         # Config (pydantic-settings)
│   │   ├── db/           # SQLAlchemy models + session
│   │   ├── engines/      # VAT calculator, MT940 parser, PDF, Email
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── tasks/        # APScheduler recurring invoice cron
│   │   └── main.py       # FastAPI app entry point
│   ├── templates/        # Jinja2 invoice HTML template
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── components/   # Sidebar, shared UI
│   │   ├── lib/          # API client, types, formatters
│   │   └── pages/        # Dashboard, InvoiceEditor, Bank, Tax, etc.
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── docker-compose.yml
└── .env.example
```

## API Documentation

After starting the backend, visit [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger UI.

## Dutch Tax Compliance

- Sequential invoice numbering with no-gap validation
- Mandatory legal fields: KVK, BTW-id, IBAN, delivery date
- Automatic reverse charge detection for EU B2B clients (Article 194 Directive 2006/112/EC)
- Quarterly Btw-aangifte rubrics: **1a** (21%), **1b** (9%), **3b** (EU intracommunautair), **5b** (voorbelasting)
- All monetary values use Python `Decimal` / PostgreSQL `Numeric(12,2)` — never float

## Environment Variables

See [`.env.example`](.env.example) for all required configuration.

Key variables:
- `DATABASE_URL` — SQLite or PostgreSQL connection string
- `SMTP_HOST/PORT/USER/PASS` — Email dispatch credentials
- `SECRET_KEY` — Application secret (generate with `openssl rand -hex 32`)

---

## Deploy to Netlify & Mobile (Phone) Usage 📱

AliBirds includes mobile navigation (bottom nav, responsive drawer, touch-friendly inputs) and is configured for 1-click Netlify deployment.

### 1. Deploying Frontend to Netlify

1. Push this repository to GitHub or GitLab.
2. In [Netlify](https://app.netlify.com/):
   - Click **"Add new site"** → **"Import an existing project"**.
   - Select your repository.
   - Netlify will automatically detect [`netlify.toml`](netlify.toml):
     - **Base directory:** `frontend`
     - **Build command:** `npm run build`
     - **Publish directory:** `dist`
3. Click **Deploy**.

### 2. Live Demo & Backend Connection

- **Standalone / Demo Mode:** When opened on Netlify without a backend configured, the app immediately loads interactive sample Dutch ZZP data (sample clients, invoices, live VAT calculator, expenses, and Btw-aangifte rubrics) saved to browser `localStorage`.
- **Connecting a Live Backend:** Deploy the FastAPI backend (e.g. on Railway, Render, Fly.io, or VPS) and add this environment variable in your Netlify site settings:
  ```env
  VITE_API_URL=https://your-fastapi-backend.example.com/api
  ```

### 3. Open on Phone (Add to Home Screen)

Open your Netlify URL (or local IP) on Safari (iOS) or Chrome (Android):
- **iOS Safari:** Tap the **Share** button → **"Add to Home Screen"**.
- **Android Chrome:** Tap **More (⋮)** → **"Install app"** / **"Add to Home Screen"**.
- AliBirds launches as a standalone fullscreen mobile app with dedicated bottom navigation!


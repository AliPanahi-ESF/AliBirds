"""
FastAPI application entry point.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import init_db
from app.tasks.scheduler import start_scheduler, stop_scheduler

from app.api import (
    invoices, clients, bank, tax, expenses, app_settings, recurring, dashboard
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    scheduler = start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="AliBirds — Dutch ZZP Accounting",
    version="1.0.0",
    description="Self-hosted invoicing, MT940 reconciliation, and Btw-aangifte for Dutch freelancers.",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static file serving for PDF downloads ────────────────────────────────────

app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# ─── API Routers ──────────────────────────────────────────────────────────────

app.include_router(dashboard.router,     prefix="/api", tags=["Dashboard"])
app.include_router(invoices.router,      prefix="/api", tags=["Invoices"])
app.include_router(clients.router,       prefix="/api", tags=["Clients"])
app.include_router(bank.router,          prefix="/api", tags=["Bank"])
app.include_router(tax.router,           prefix="/api", tags=["Tax"])
app.include_router(expenses.router,      prefix="/api", tags=["Expenses"])
app.include_router(app_settings.router,  prefix="/api", tags=["Settings"])
app.include_router(recurring.router,     prefix="/api", tags=["Recurring"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

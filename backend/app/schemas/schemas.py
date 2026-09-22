"""
Pydantic v2 schemas for request/response validation.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ─── Shared ───────────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Business Settings ────────────────────────────────────────────────────────

class BusinessSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    trade_name: Optional[str] = None
    kvk_number: Optional[str] = None
    btw_id: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_postcode: Optional[str] = None
    address_country: Optional[str] = "NL"
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    default_payment_term_days: Optional[int] = 14
    invoice_prefix: Optional[str] = ""
    invoice_notes_default: Optional[str] = None
    logo_url: Optional[str] = None
    accent_color: Optional[str] = "#2563EB"
    font_family: Optional[str] = "Inter"


class BusinessSettingsOut(OrmBase, BusinessSettingsUpdate):
    id: str
    next_invoice_sequence: int
    created_at: datetime
    updated_at: datetime


# ─── Clients ──────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    vat_number: Optional[str] = None
    kvk_number: Optional[str] = None
    billing_address_street: Optional[str] = None
    billing_address_city: Optional[str] = None
    billing_address_postcode: Optional[str] = None
    country_code: str = "NL"
    default_payment_term_days: int = 14
    notes: Optional[str] = None


class ClientUpdate(ClientCreate):
    name: Optional[str] = None


class ClientOut(OrmBase, ClientCreate):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ─── Invoice Line Items ────────────────────────────────────────────────────────

class LineItemIn(BaseModel):
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    vat_rate: str = "21"  # "21" | "9" | "0" | "REVERSE_CHARGE"
    sort_order: int = 0


class LineItemOut(OrmBase):
    id: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: Any
    vat_amount: Decimal
    line_total_excl: Decimal
    line_total_incl: Decimal
    sort_order: int


# ─── Invoices ─────────────────────────────────────────────────────────────────

class InvoiceCreate(BaseModel):
    client_id: str
    issue_date: date
    delivery_date: Optional[date] = None
    due_date: date
    calculation_mode: str = "EXCLUSIVE"
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    line_items: List[LineItemIn] = []


class InvoiceUpdate(BaseModel):
    issue_date: Optional[date] = None
    delivery_date: Optional[date] = None
    due_date: Optional[date] = None
    calculation_mode: Optional[str] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    line_items: Optional[List[LineItemIn]] = None


class InvoiceOut(OrmBase):
    id: str
    invoice_number: str
    client_id: str
    client: Optional[ClientOut] = None
    issue_date: date
    delivery_date: Optional[date]
    due_date: date
    status: Any
    calculation_mode: Any
    subtotal_excl_vat: Decimal
    total_vat_amount: Decimal
    total_incl_vat: Decimal
    amount_paid: Decimal
    payment_reference: Optional[str]
    notes: Optional[str]
    pdf_path: Optional[str]
    sent_at: Optional[datetime]
    paid_at: Optional[datetime]
    line_items: List[LineItemOut] = []
    created_at: datetime
    updated_at: datetime


# ─── Recurring Schedules ──────────────────────────────────────────────────────

class RecurringScheduleCreate(BaseModel):
    client_id: str
    name: str
    frequency: str  # "MONTHLY" | "QUARTERLY"
    next_run_date: date
    is_active: bool = True
    auto_send_email: bool = False
    line_items_template: List[Dict[str, Any]] = []
    calculation_mode: str = "EXCLUSIVE"
    payment_term_days: int = 14
    notes_template: Optional[str] = None


class RecurringScheduleOut(OrmBase, RecurringScheduleCreate):
    id: str
    created_at: datetime
    updated_at: datetime


# ─── Bank Transactions ────────────────────────────────────────────────────────

class BankTransactionOut(OrmBase):
    id: str
    transaction_date: date
    value_date: Optional[date]
    amount: Decimal
    currency: str
    type: Any
    counterpart_name: Optional[str]
    counterpart_iban: Optional[str]
    remittance_reference: Optional[str]
    reconciliation_status: Any
    matched_invoice_id: Optional[str]
    imported_at: datetime


class ManualMatchRequest(BaseModel):
    invoice_id: str


# ─── Expenses ─────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    vendor_name: str
    expense_date: date
    description: Optional[str] = None
    category: str = "Other"
    amount_excl_vat: Decimal
    vat_rate: str = "21"
    vat_amount: Decimal
    amount_incl_vat: Decimal
    notes: Optional[str] = None


class ExpenseOut(OrmBase, ExpenseCreate):
    id: str
    receipt_file_path: Optional[str]
    created_at: datetime
    updated_at: datetime


# ─── Tax / Btw-aangifte ───────────────────────────────────────────────────────

class BtwRubricOut(BaseModel):
    code: str
    description: str
    turnover: float
    tax: float


class BtwAangifteOut(BaseModel):
    quarter: str
    start_date: date
    end_date: date
    rubrics: Dict[str, BtwRubricOut]
    voorbelasting: float
    te_betalen: float


# ─── Dashboard KPIs ───────────────────────────────────────────────────────────

class DashboardKPIs(BaseModel):
    outstanding_revenue: Decimal
    overdue_amount: Decimal
    projected_vat_liability: Decimal
    total_invoices_this_year: int
    paid_this_month: Decimal
    expenses_this_quarter: Decimal


# ─── Auth / User ─────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(OrmBase):
    id: str
    email: str
    name: str
    company_name: Optional[str] = ""
    is_onboarded: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


"""
AliBirds SQLAlchemy ORM Models
All monetary values use Numeric(12, 2) — never Float.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Optional, List

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Integer, JSON, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# ─── Base ─────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


# ─── Enums ────────────────────────────────────────────────────────────────────

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"


class CalculationMode(str, enum.Enum):
    INCLUSIVE = "INCLUSIVE"   # user enters gross (incl. VAT)
    EXCLUSIVE = "EXCLUSIVE"   # user enters net  (excl. VAT)


class VATRate(str, enum.Enum):
    RATE_21 = "21"
    RATE_9 = "9"
    RATE_0 = "0"
    REVERSE_CHARGE = "REVERSE_CHARGE"


class RecurrenceFrequency(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"


class TransactionType(str, enum.Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"


class ReconciliationStatus(str, enum.Enum):
    MATCHED = "MATCHED"
    UNMATCHED = "UNMATCHED"
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    MANUAL = "MANUAL"


class ExpenseCategory(str, enum.Enum):
    SOFTWARE = "Software"
    HARDWARE = "Hardware"
    OFFICE = "Office"
    SUBSCRIPTIONS = "Subscriptions"
    TRAVEL = "Travel"
    MARKETING = "Marketing"
    PROFESSIONAL_SERVICES = "Professional Services"
    OTHER = "Other"


# ─── Business Settings ────────────────────────────────────────────────────────

class BusinessSettings(Base):
    __tablename__ = "business_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    trade_name: Mapped[Optional[str]] = mapped_column(String(200))
    kvk_number: Mapped[Optional[str]] = mapped_column(String(20))
    btw_id: Mapped[Optional[str]] = mapped_column(String(30))        # NL...B01
    iban: Mapped[Optional[str]] = mapped_column(String(34))
    bic: Mapped[Optional[str]] = mapped_column(String(11))

    # Address
    address_street: Mapped[Optional[str]] = mapped_column(String(200))
    address_city: Mapped[Optional[str]] = mapped_column(String(100))
    address_postcode: Mapped[Optional[str]] = mapped_column(String(10))
    address_country: Mapped[str] = mapped_column(String(2), default="NL")

    phone: Mapped[Optional[str]] = mapped_column(String(30))
    email: Mapped[Optional[str]] = mapped_column(String(200))
    website: Mapped[Optional[str]] = mapped_column(String(200))

    # Defaults
    default_payment_term_days: Mapped[int] = mapped_column(Integer, default=14)
    invoice_prefix: Mapped[str] = mapped_column(String(10), default="")
    next_invoice_sequence: Mapped[int] = mapped_column(Integer, default=1)
    invoice_notes_default: Mapped[Optional[str]] = mapped_column(Text)

    # Branding
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    accent_color: Mapped[str] = mapped_column(String(7), default="#2563EB")
    font_family: Mapped[str] = mapped_column(String(100), default="Inter")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Clients ──────────────────────────────────────────────────────────────────

class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(200))
    email: Mapped[Optional[str]] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(30))

    # Tax identifiers
    vat_number: Mapped[Optional[str]] = mapped_column(String(30))    # EU BTW-id
    kvk_number: Mapped[Optional[str]] = mapped_column(String(20))

    # Address
    billing_address_street: Mapped[Optional[str]] = mapped_column(String(200))
    billing_address_city: Mapped[Optional[str]] = mapped_column(String(100))
    billing_address_postcode: Mapped[Optional[str]] = mapped_column(String(10))
    country_code: Mapped[str] = mapped_column(String(2), default="NL")

    default_payment_term_days: Mapped[int] = mapped_column(Integer, default=14)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    invoices: Mapped[List["Invoice"]] = relationship("Invoice", back_populates="client")
    recurring_schedules: Mapped[List["RecurringSchedule"]] = relationship(
        "RecurringSchedule", back_populates="client"
    )


# ─── Invoices ─────────────────────────────────────────────────────────────────

class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    delivery_date: Mapped[Optional[date]] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False
    )
    calculation_mode: Mapped[CalculationMode] = mapped_column(
        Enum(CalculationMode), default=CalculationMode.EXCLUSIVE, nullable=False
    )

    # Totals — Numeric precision, never Float
    subtotal_excl_vat: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    total_vat_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    total_incl_vat: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)

    payment_reference: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    pdf_path: Mapped[Optional[str]] = mapped_column(String(500))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    recurring_schedule_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("recurring_schedules.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="invoices")
    line_items: Mapped[List["InvoiceLineItem"]] = relationship(
        "InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    bank_transactions: Mapped[List["BankTransaction"]] = relationship(
        "BankTransaction", back_populates="matched_invoice"
    )
    recurring_schedule: Mapped[Optional["RecurringSchedule"]] = relationship(
        "RecurringSchedule", back_populates="generated_invoices"
    )


# ─── Invoice Line Items ────────────────────────────────────────────────────────

class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_id: Mapped[str] = mapped_column(String(36), ForeignKey("invoices.id"), nullable=False)

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Numeric] = mapped_column(Numeric(10, 4), nullable=False, default=1)
    unit_price: Mapped[Numeric] = mapped_column(Numeric(12, 4), nullable=False)

    vat_rate: Mapped[VATRate] = mapped_column(Enum(VATRate), nullable=False, default=VATRate.RATE_21)

    # Computed and stored for audit integrity
    vat_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    line_total_excl: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    line_total_incl: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)

    # Relationship
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="line_items")


# ─── Recurring Invoice Schedules ──────────────────────────────────────────────

class RecurringSchedule(Base):
    __tablename__ = "recurring_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    frequency: Mapped[RecurrenceFrequency] = mapped_column(Enum(RecurrenceFrequency), nullable=False)
    next_run_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_send_email: Mapped[bool] = mapped_column(Boolean, default=False)

    # Template: JSON array of line item dicts
    line_items_template: Mapped[dict] = mapped_column(JSON, nullable=False, default=list)
    calculation_mode: Mapped[CalculationMode] = mapped_column(
        Enum(CalculationMode), default=CalculationMode.EXCLUSIVE
    )
    payment_term_days: Mapped[int] = mapped_column(Integer, default=14)
    notes_template: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="recurring_schedules")
    generated_invoices: Mapped[List["Invoice"]] = relationship(
        "Invoice", back_populates="recurring_schedule"
    )


# ─── Bank Transactions ────────────────────────────────────────────────────────

class BankTransaction(Base):
    __tablename__ = "bank_transactions"
    __table_args__ = (UniqueConstraint("raw_mt940_hash", name="uq_mt940_hash"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    value_date: Mapped[Optional[date]] = mapped_column(Date)
    amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)

    counterpart_name: Mapped[Optional[str]] = mapped_column(String(200))
    counterpart_iban: Mapped[Optional[str]] = mapped_column(String(34))
    remittance_reference: Mapped[Optional[str]] = mapped_column(String(500))

    raw_mt940_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    reconciliation_status: Mapped[ReconciliationStatus] = mapped_column(
        Enum(ReconciliationStatus), default=ReconciliationStatus.UNMATCHED, nullable=False
    )
    matched_invoice_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("invoices.id"), nullable=True
    )

    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationship
    matched_invoice: Mapped[Optional["Invoice"]] = relationship(
        "Invoice", back_populates="bank_transactions"
    )


# ─── Expenses ─────────────────────────────────────────────────────────────────

class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vendor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    category: Mapped[ExpenseCategory] = mapped_column(
        Enum(ExpenseCategory), default=ExpenseCategory.OTHER, nullable=False
    )

    amount_excl_vat: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    vat_rate: Mapped[str] = mapped_column(String(10), default="21")  # "21", "9", "0"
    vat_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    amount_incl_vat: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)

    receipt_file_path: Mapped[Optional[str]] = mapped_column(String(500))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[Optional[str]] = mapped_column(String(200), default="")
    is_onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


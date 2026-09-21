"""Dashboard KPIs API."""
from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import Invoice, InvoiceStatus, Expense, BankTransaction, TransactionType
from app.schemas.schemas import DashboardKPIs

router = APIRouter()

@router.get("/dashboard/kpis", response_model=DashboardKPIs)
async def get_kpis(db: AsyncSession = Depends(get_db)):
    today = date.today()
    year = today.year
    month = today.month
    quarter = (month - 1) // 3 + 1

    # Outstanding revenue (SENT status)
    out_res = await db.execute(
        select(func.sum(Invoice.total_incl_vat))
        .where(Invoice.status == InvoiceStatus.SENT)
    )
    outstanding = Decimal(str(out_res.scalar() or 0))

    # Overdue amount
    overdue_res = await db.execute(
        select(func.sum(Invoice.total_incl_vat))
        .where(Invoice.status == InvoiceStatus.OVERDUE)
    )
    overdue = Decimal(str(overdue_res.scalar() or 0))

    # Also check SENT invoices past due date
    past_due_res = await db.execute(
        select(func.sum(Invoice.total_incl_vat))
        .where(Invoice.status == InvoiceStatus.SENT, Invoice.due_date < today)
    )
    past_due = Decimal(str(past_due_res.scalar() or 0))
    overdue += past_due

    # Projected VAT liability this quarter
    quarter_months = {1: (1, 3), 2: (4, 6), 3: (7, 9), 4: (10, 12)}
    q_start_m, q_end_m = quarter_months[quarter]
    q_start = date(year, q_start_m, 1)
    import calendar
    q_end = date(year, q_end_m, calendar.monthrange(year, q_end_m)[1])

    vat_res = await db.execute(
        select(func.sum(Invoice.total_vat_amount))
        .where(
            Invoice.issue_date >= q_start,
            Invoice.issue_date <= q_end,
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PAID]),
        )
    )
    projected_vat = Decimal(str(vat_res.scalar() or 0))

    # Total invoices this year
    count_res = await db.execute(
        select(func.count(Invoice.id))
        .where(
            func.strftime("%Y", Invoice.issue_date) == str(year),
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    total_invoices = count_res.scalar() or 0

    # Paid this month
    paid_res = await db.execute(
        select(func.sum(Invoice.total_incl_vat))
        .where(
            Invoice.status == InvoiceStatus.PAID,
            func.strftime("%Y-%m", Invoice.paid_at) == f"{year}-{month:02d}",
        )
    )
    paid_this_month = Decimal(str(paid_res.scalar() or 0))

    # Expenses this quarter
    exp_res = await db.execute(
        select(func.sum(Expense.amount_incl_vat))
        .where(Expense.expense_date >= q_start, Expense.expense_date <= q_end)
    )
    expenses_q = Decimal(str(exp_res.scalar() or 0))

    return DashboardKPIs(
        outstanding_revenue=outstanding,
        overdue_amount=overdue,
        projected_vat_liability=projected_vat,
        total_invoices_this_year=total_invoices,
        paid_this_month=paid_this_month,
        expenses_this_quarter=expenses_q,
    )

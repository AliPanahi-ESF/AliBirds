"""Tax / Btw-aangifte API."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import Invoice, Expense
from app.engines.vat import aggregate_btw_aangifte
from app.schemas.schemas import BtwAangifteOut
from datetime import date

router = APIRouter()

@router.get("/tax/btw-aangifte", response_model=BtwAangifteOut)
async def get_btw_aangifte(
    year: int = None,
    quarter: int = None,
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    if not year:
        year = today.year
    if not quarter:
        quarter = (today.month - 1) // 3 + 1

    invoices_res = await db.execute(
        select(Invoice).options(
            selectinload(Invoice.client),
            selectinload(Invoice.line_items),
        )
    )
    invoices = invoices_res.scalars().all()

    expenses_res = await db.execute(select(Expense))
    expenses = expenses_res.scalars().all()

    result = aggregate_btw_aangifte(invoices, expenses, quarter=quarter, year=year)
    return result.as_dict()

@router.get("/tax/quarters")
async def available_quarters():
    """Return available year/quarter combinations."""
    today = date.today()
    quarters = []
    for y in range(today.year - 2, today.year + 1):
        for q in range(1, 5):
            quarters.append({"year": y, "quarter": q, "label": f"{y} Q{q}"})
    return quarters

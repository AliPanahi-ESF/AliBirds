"""Expenses API."""
from __future__ import annotations
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
from datetime import datetime
from app.db.database import get_db
from app.db.models import Expense, ExpenseCategory
from app.schemas.schemas import ExpenseCreate, ExpenseOut
from app.core.config import settings

router = APIRouter()

@router.get("/expenses", response_model=List[ExpenseOut])
async def list_expenses(
    category: Optional[str] = None,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Expense).order_by(Expense.expense_date.desc())
    if category:
        q = q.where(Expense.category == ExpenseCategory(category))
    result = await db.execute(q)
    return result.scalars().all()

@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(payload: ExpenseCreate, db: AsyncSession = Depends(get_db)):
    exp = Expense(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(exp)
    await db.commit()
    await db.refresh(exp)
    return exp

@router.get("/expenses/{expense_id}", response_model=ExpenseOut)
async def get_expense(expense_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Expense).where(Expense.id == expense_id))
    exp = res.scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Expense not found")
    return exp

@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(expense_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Expense).where(Expense.id == expense_id))
    exp = res.scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Expense not found")
    await db.delete(exp)
    await db.commit()

@router.post("/expenses/{expense_id}/receipt")
async def upload_receipt(
    expense_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Expense).where(Expense.id == expense_id))
    exp = res.scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Expense not found")

    upload_dir = Path(settings.RECEIPT_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix
    filename = f"{expense_id}{suffix}"
    file_path = upload_dir / filename
    content = await file.read()
    file_path.write_bytes(content)

    exp.receipt_file_path = str(file_path)
    await db.commit()
    return {"receipt_path": str(file_path)}

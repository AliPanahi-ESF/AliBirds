"""Recurring Schedules API."""
from __future__ import annotations
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import RecurringSchedule, RecurrenceFrequency, CalculationMode
from app.schemas.schemas import RecurringScheduleCreate, RecurringScheduleOut

router = APIRouter()

@router.get("/recurring", response_model=List[RecurringScheduleOut])
async def list_schedules(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(RecurringSchedule)
        .options(selectinload(RecurringSchedule.client))
        .order_by(RecurringSchedule.next_run_date)
    )
    return res.scalars().all()

@router.post("/recurring", response_model=RecurringScheduleOut, status_code=201)
async def create_schedule(payload: RecurringScheduleCreate, db: AsyncSession = Depends(get_db)):
    schedule = RecurringSchedule(
        id=str(uuid.uuid4()),
        client_id=payload.client_id,
        name=payload.name,
        frequency=RecurrenceFrequency(payload.frequency),
        next_run_date=payload.next_run_date,
        is_active=payload.is_active,
        auto_send_email=payload.auto_send_email,
        line_items_template=payload.line_items_template,
        calculation_mode=CalculationMode(payload.calculation_mode),
        payment_term_days=payload.payment_term_days,
        notes_template=payload.notes_template,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule

@router.put("/recurring/{schedule_id}", response_model=RecurringScheduleOut)
async def update_schedule(
    schedule_id: str, payload: RecurringScheduleCreate, db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(RecurringSchedule).where(RecurringSchedule.id == schedule_id))
    sched = res.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(sched, field, val)
    await db.commit()
    await db.refresh(sched)
    return sched

@router.delete("/recurring/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(RecurringSchedule).where(RecurringSchedule.id == schedule_id))
    sched = res.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")
    await db.delete(sched)
    await db.commit()

@router.post("/recurring/{schedule_id}/trigger")
async def trigger_now(schedule_id: str, db: AsyncSession = Depends(get_db)):
    """Manually trigger a recurring schedule immediately."""
    from app.tasks.scheduler import _generate_invoice_from_schedule
    from app.db.models import BusinessSettings
    from sqlalchemy import select as sel

    res = await db.execute(
        select(RecurringSchedule)
        .options(selectinload(RecurringSchedule.client))
        .where(RecurringSchedule.id == schedule_id)
    )
    sched = res.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")

    biz_res = await db.execute(sel(BusinessSettings).limit(1))
    biz = biz_res.scalar_one_or_none()
    if not biz:
        raise HTTPException(500, "Business settings not configured")

    invoice = await _generate_invoice_from_schedule(db, sched, biz)
    await db.commit()
    return {"message": f"Invoice {invoice.invoice_number} generated", "invoice_id": invoice.id}

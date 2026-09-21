"""Business Settings API."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import BusinessSettings
from app.schemas.schemas import BusinessSettingsOut, BusinessSettingsUpdate

router = APIRouter()

@router.get("/settings", response_model=BusinessSettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BusinessSettings).limit(1))
    biz = res.scalar_one_or_none()
    if not biz:
        raise HTTPException(404, "Settings not found")
    return biz

@router.put("/settings", response_model=BusinessSettingsOut)
async def update_settings(payload: BusinessSettingsUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BusinessSettings).limit(1))
    biz = res.scalar_one_or_none()
    if not biz:
        raise HTTPException(404, "Settings not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(biz, field, val)
    await db.commit()
    await db.refresh(biz)
    return biz

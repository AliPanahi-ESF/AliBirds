"""Clients API."""
from __future__ import annotations
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import Client
from app.schemas.schemas import ClientCreate, ClientUpdate, ClientOut

router = APIRouter()

@router.get("/clients", response_model=List[ClientOut])
async def list_clients(search: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    q = select(Client).where(Client.is_active == True)
    if search:
        q = q.where(Client.name.ilike(f"%{search}%"))
    q = q.order_by(Client.name)
    result = await db.execute(q)
    return result.scalars().all()

@router.post("/clients", response_model=ClientOut, status_code=201)
async def create_client(payload: ClientCreate, db: AsyncSession = Depends(get_db)):
    client = Client(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client

@router.get("/clients/{client_id}", response_model=ClientOut)
async def get_client(client_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Client).where(Client.id == client_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Client not found")
    return c

@router.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(client_id: str, payload: ClientUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Client).where(Client.id == client_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Client not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(c, field, val)
    await db.commit()
    await db.refresh(c)
    return c

@router.delete("/clients/{client_id}", status_code=204)
async def deactivate_client(client_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Client).where(Client.id == client_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Client not found")
    c.is_active = False
    await db.commit()

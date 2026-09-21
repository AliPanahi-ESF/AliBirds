"""Invoices API — CRUD, PDF render, email send."""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Invoice, InvoiceLineItem, InvoiceStatus, Client, BusinessSettings, CalculationMode, VATRate
from app.schemas.schemas import InvoiceCreate, InvoiceUpdate, InvoiceOut
from app.engines.vat import compute_invoice, LineItemInput
from decimal import Decimal
import uuid

router = APIRouter()


async def _get_business(db: AsyncSession) -> BusinessSettings:
    res = await db.execute(select(BusinessSettings).limit(1))
    biz = res.scalar_one_or_none()
    if not biz:
        raise HTTPException(500, "Business settings not configured")
    return biz


async def _get_invoice(db: AsyncSession, invoice_id: str) -> Invoice:
    res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.client), selectinload(Invoice.line_items))
        .where(Invoice.id == invoice_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


def _build_line_inputs(items) -> list:
    return [
        LineItemInput(
            description=li.description,
            quantity=Decimal(str(li.quantity)),
            unit_price=Decimal(str(li.unit_price)),
            vat_rate=li.vat_rate,
            sort_order=li.sort_order,
        )
        for li in items
    ]


@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(
    status: Optional[str] = None,
    client_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Invoice).options(selectinload(Invoice.client), selectinload(Invoice.line_items))
    if status:
        q = q.where(Invoice.status == InvoiceStatus(status))
    if client_id:
        q = q.where(Invoice.client_id == client_id)
    q = q.order_by(Invoice.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
async def create_invoice(payload: InvoiceCreate, db: AsyncSession = Depends(get_db)):
    # Validate client
    client_res = await db.execute(select(Client).where(Client.id == payload.client_id))
    client = client_res.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found")

    # Get business + generate invoice number
    biz = await _get_business(db)
    year = datetime.utcnow().year
    seq = biz.next_invoice_sequence
    biz.next_invoice_sequence = seq + 1
    invoice_number = f"{biz.invoice_prefix or ''}{year}-{seq:04d}"

    # Compute VAT
    line_inputs = [
        LineItemInput(
            description=li.description,
            quantity=li.quantity,
            unit_price=li.unit_price,
            vat_rate=li.vat_rate,
            sort_order=li.sort_order,
        )
        for li in payload.line_items
    ]
    totals = compute_invoice(
        line_inputs,
        mode=payload.calculation_mode,
        client_country_code=client.country_code,
        client_vat_number=client.vat_number,
    )

    invoice = Invoice(
        id=str(uuid.uuid4()),
        invoice_number=invoice_number,
        client_id=payload.client_id,
        issue_date=payload.issue_date,
        delivery_date=payload.delivery_date,
        due_date=payload.due_date,
        status=InvoiceStatus.DRAFT,
        calculation_mode=CalculationMode(payload.calculation_mode),
        subtotal_excl_vat=totals.subtotal_excl_vat,
        total_vat_amount=totals.total_vat_amount,
        total_incl_vat=totals.total_incl_vat,
        payment_reference=payload.payment_reference or invoice_number,
        notes=payload.notes,
    )
    db.add(invoice)
    await db.flush()

    for li in totals.line_items:
        db.add(InvoiceLineItem(
            id=str(uuid.uuid4()),
            invoice_id=invoice.id,
            sort_order=li.sort_order,
            description=li.description,
            quantity=li.quantity,
            unit_price=li.unit_price,
            vat_rate=li.vat_rate,
            vat_amount=li.vat_amount,
            line_total_excl=li.line_total_excl,
            line_total_incl=li.line_total_incl,
        ))

    await db.commit()
    return await _get_invoice(db, invoice.id)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    return await _get_invoice(db, invoice_id)


@router.put("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: str, payload: InvoiceUpdate, db: AsyncSession = Depends(get_db)
):
    inv = await _get_invoice(db, invoice_id)
    if inv.status not in (InvoiceStatus.DRAFT,):
        raise HTTPException(400, "Only DRAFT invoices can be edited")

    for field, val in payload.model_dump(exclude_none=True, exclude={"line_items"}).items():
        setattr(inv, field, val)

    if payload.line_items is not None:
        # Delete existing line items and recompute
        for li in list(inv.line_items):
            await db.delete(li)
        await db.flush()

        client = inv.client
        line_inputs = [
            LineItemInput(
                description=li.description,
                quantity=li.quantity,
                unit_price=li.unit_price,
                vat_rate=li.vat_rate,
                sort_order=li.sort_order,
            )
            for li in payload.line_items
        ]
        mode = payload.calculation_mode or inv.calculation_mode.value
        totals = compute_invoice(
            line_inputs,
            mode=mode,
            client_country_code=client.country_code,
            client_vat_number=client.vat_number,
        )
        inv.subtotal_excl_vat = totals.subtotal_excl_vat
        inv.total_vat_amount = totals.total_vat_amount
        inv.total_incl_vat = totals.total_incl_vat

        for li in totals.line_items:
            db.add(InvoiceLineItem(
                id=str(uuid.uuid4()),
                invoice_id=inv.id,
                sort_order=li.sort_order,
                description=li.description,
                quantity=li.quantity,
                unit_price=li.unit_price,
                vat_rate=li.vat_rate,
                vat_amount=li.vat_amount,
                line_total_excl=li.line_total_excl,
                line_total_incl=li.line_total_incl,
            ))

    await db.commit()
    return await _get_invoice(db, invoice_id)


@router.delete("/invoices/{invoice_id}", status_code=204)
async def cancel_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    inv = await _get_invoice(db, invoice_id)
    inv.status = InvoiceStatus.CANCELLED
    inv.cancelled_at = datetime.utcnow()
    await db.commit()


@router.post("/invoices/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Render PDF, update status to SENT, dispatch email."""
    inv = await _get_invoice(db, invoice_id)
    biz = await _get_business(db)

    from app.engines.pdf import render_invoice_pdf
    from app.engines.email import send_invoice_email

    pdf_path = render_invoice_pdf(inv, biz)
    inv.pdf_path = str(pdf_path)
    inv.status = InvoiceStatus.SENT
    inv.sent_at = datetime.utcnow()
    await db.commit()

    background_tasks.add_task(send_invoice_email, inv, biz, pdf_path)

    return {"message": f"Invoice {inv.invoice_number} sent", "pdf_path": str(pdf_path)}


@router.post("/invoices/{invoice_id}/render-pdf")
async def render_pdf(invoice_id: str, db: AsyncSession = Depends(get_db)):
    """Render PDF without sending."""
    inv = await _get_invoice(db, invoice_id)
    biz = await _get_business(db)
    from app.engines.pdf import render_invoice_pdf
    pdf_path = render_invoice_pdf(inv, biz)
    inv.pdf_path = str(pdf_path)
    await db.commit()
    return {"pdf_path": str(pdf_path)}


@router.get("/invoices/{invoice_id}/pdf")
async def download_pdf(invoice_id: str, db: AsyncSession = Depends(get_db)):
    inv = await _get_invoice(db, invoice_id)
    if not inv.pdf_path or not Path(inv.pdf_path).exists():
        raise HTTPException(404, "PDF not yet generated — call /render-pdf first")
    return FileResponse(
        inv.pdf_path,
        media_type="application/pdf",
        filename=f"Factuur_{inv.invoice_number}.pdf",
    )


@router.post("/invoices/calculate")
async def calculate_invoice(payload: InvoiceCreate, db: AsyncSession = Depends(get_db)):
    """Dry-run: compute totals without persisting."""
    client_res = await db.execute(select(Client).where(Client.id == payload.client_id))
    client = client_res.scalar_one_or_none()
    country = client.country_code if client else "NL"
    vat_num = client.vat_number if client else None

    line_inputs = [
        LineItemInput(
            description=li.description,
            quantity=li.quantity,
            unit_price=li.unit_price,
            vat_rate=li.vat_rate,
            sort_order=li.sort_order,
        )
        for li in payload.line_items
    ]
    totals = compute_invoice(line_inputs, mode=payload.calculation_mode, client_country_code=country, client_vat_number=vat_num)
    return {
        "subtotal_excl_vat": float(totals.subtotal_excl_vat),
        "total_vat_amount": float(totals.total_vat_amount),
        "total_incl_vat": float(totals.total_incl_vat),
        "vat_breakdown": {k: {"base": float(v["base"]), "vat": float(v["vat"])} for k, v in totals.vat_breakdown.items()},
        "line_items": [
            {
                "description": li.description,
                "quantity": float(li.quantity),
                "unit_price": float(li.unit_price),
                "vat_rate": li.vat_rate,
                "line_total_excl": float(li.line_total_excl),
                "vat_amount": float(li.vat_amount),
                "line_total_incl": float(li.line_total_incl),
            }
            for li in totals.line_items
        ],
    }

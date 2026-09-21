"""Bank MT940 upload and reconciliation API."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import (
    BankTransaction, Invoice, InvoiceStatus,
    ReconciliationStatus, TransactionType
)
from app.engines.mt940 import parse_mt940, reconcile_transactions
from app.schemas.schemas import BankTransactionOut, ManualMatchRequest
from app.core.config import settings

import hashlib
from pathlib import Path

router = APIRouter()


@router.post("/bank/upload")
async def upload_mt940(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Accept MT940 .sta file, parse, deduplicate, and store transactions."""
    content = (await file.read()).decode("utf-8", errors="replace")

    # Save raw file
    upload_dir = Path(settings.MT940_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    raw_path = upload_dir / f"{ts}_{file.filename}"
    raw_path.write_text(content, encoding="utf-8")

    statement = parse_mt940(content)

    inserted = 0
    duplicates = 0

    for txn in statement.transactions:
        # Deduplication by hash
        existing = await db.execute(
            select(BankTransaction).where(BankTransaction.raw_mt940_hash == txn.raw_mt940_hash)
        )
        if existing.scalar_one_or_none():
            duplicates += 1
            continue

        db.add(BankTransaction(
            id=str(uuid.uuid4()),
            transaction_date=txn.transaction_date,
            value_date=txn.value_date,
            amount=txn.amount,
            currency="EUR",
            type=TransactionType(txn.type),
            counterpart_name=txn.counterpart_name,
            counterpart_iban=txn.counterpart_iban,
            remittance_reference=txn.remittance_reference,
            raw_mt940_hash=txn.raw_mt940_hash,
            reconciliation_status=ReconciliationStatus.UNMATCHED,
        ))
        inserted += 1

    await db.commit()

    # Auto-reconcile newly inserted transactions
    reconcile_count = await _run_reconciliation(db)

    return {
        "inserted": inserted,
        "duplicates": duplicates,
        "auto_reconciled": reconcile_count,
        "account_iban": statement.account_iban,
        "opening_balance": float(statement.opening_balance),
        "closing_balance": float(statement.closing_balance),
    }


async def _run_reconciliation(db: AsyncSession) -> int:
    """Internal reconciliation pass — called after import."""
    # Load unmatched credits
    txn_res = await db.execute(
        select(BankTransaction).where(
            BankTransaction.type == TransactionType.CREDIT,
            BankTransaction.reconciliation_status == ReconciliationStatus.UNMATCHED,
        )
    )
    transactions = txn_res.scalars().all()

    # Load open invoices
    inv_res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.client))
        .where(Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.OVERDUE]))
    )
    open_invoices = inv_res.scalars().all()

    # Convert ORM transactions to MT940Transaction-like objects for engine
    from app.engines.mt940 import MT940Transaction
    from decimal import Decimal

    mt940_txns = [
        MT940Transaction(
            transaction_date=t.transaction_date,
            value_date=t.value_date,
            amount=Decimal(str(t.amount)),
            type=t.type.value,
            counterpart_name=t.counterpart_name,
            counterpart_iban=t.counterpart_iban,
            remittance_reference=t.remittance_reference,
            raw_mt940_hash=t.raw_mt940_hash,
            raw_86=t.remittance_reference or "",
        )
        for t in transactions
    ]

    matches = reconcile_transactions(mt940_txns, open_invoices)

    count = 0
    for match in matches:
        # Find the DB transaction object
        txn_obj = next((t for t in transactions if t.raw_mt940_hash == match.transaction_hash), None)
        inv_obj = next((i for i in open_invoices if i.id == match.invoice_id), None)
        if not txn_obj or not inv_obj:
            continue

        if match.confidence == "AUTO":
            txn_obj.reconciliation_status = ReconciliationStatus.MATCHED
            txn_obj.matched_invoice_id = inv_obj.id
            inv_obj.status = InvoiceStatus.PAID
            inv_obj.paid_at = datetime.utcnow()
        else:
            txn_obj.reconciliation_status = ReconciliationStatus.PENDING_CONFIRMATION
            txn_obj.matched_invoice_id = inv_obj.id

        count += 1

    await db.commit()
    return count


@router.post("/bank/reconcile")
async def trigger_reconciliation(db: AsyncSession = Depends(get_db)):
    """Manually trigger the reconciliation pipeline."""
    count = await _run_reconciliation(db)
    return {"reconciled": count}


@router.get("/bank/transactions", response_model=List[BankTransactionOut])
async def list_transactions(
    status: Optional[str] = None,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(BankTransaction).order_by(BankTransaction.transaction_date.desc())
    if status:
        q = q.where(BankTransaction.reconciliation_status == ReconciliationStatus(status))
    if type:
        q = q.where(BankTransaction.type == TransactionType(type))
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/bank/transactions/{tx_id}/match")
async def manual_match(
    tx_id: str,
    payload: ManualMatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """1-click manual match: link transaction to a specific invoice."""
    txn_res = await db.execute(select(BankTransaction).where(BankTransaction.id == tx_id))
    txn = txn_res.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")

    inv_res = await db.execute(select(Invoice).where(Invoice.id == payload.invoice_id))
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    txn.reconciliation_status = ReconciliationStatus.MANUAL
    txn.matched_invoice_id = inv.id
    inv.status = InvoiceStatus.PAID
    inv.paid_at = datetime.utcnow()
    await db.commit()
    return {"message": f"Transaction manually matched to invoice {inv.invoice_number}"}


@router.post("/bank/transactions/{tx_id}/unmatch")
async def unmatch_transaction(tx_id: str, db: AsyncSession = Depends(get_db)):
    txn_res = await db.execute(select(BankTransaction).where(BankTransaction.id == tx_id))
    txn = txn_res.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    txn.reconciliation_status = ReconciliationStatus.UNMATCHED
    txn.matched_invoice_id = None
    await db.commit()
    return {"message": "Transaction unmatched"}

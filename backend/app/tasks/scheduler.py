"""
Recurring Invoice Scheduler
============================
APScheduler cron job running daily at 08:00 Europe/Amsterdam.
Checks active RecurringSchedule entries and generates + (optionally) emails invoices.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import (
    Invoice, InvoiceLineItem, InvoiceStatus, RecurringSchedule,
    RecurrenceFrequency, CalculationMode, BusinessSettings,
)
from app.engines.vat import compute_invoice, LineItemInput

logger = logging.getLogger("alibirds.scheduler")


# ─── Invoice Number Generation ────────────────────────────────────────────────

async def _next_invoice_number(session, business: BusinessSettings) -> str:
    """Generate the next sequential invoice number with year prefix."""
    year = date.today().year
    seq = business.next_invoice_sequence
    business.next_invoice_sequence = seq + 1
    prefix = business.invoice_prefix or ""
    return f"{prefix}{year}-{seq:04d}"


# ─── Advance Next Run Date ────────────────────────────────────────────────────

def _advance_date(current: date, frequency: RecurrenceFrequency) -> date:
    if frequency == RecurrenceFrequency.MONTHLY:
        # Move to same day next month
        month = current.month + 1
        year = current.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        try:
            return date(year, month, current.day)
        except ValueError:
            # Handle months with fewer days (e.g., Jan 31 → Feb 28)
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            return date(year, month, last_day)
    else:  # QUARTERLY
        month = current.month + 3
        year = current.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        try:
            return date(year, month, current.day)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            return date(year, month, last_day)


# ─── Core Job ─────────────────────────────────────────────────────────────────

async def process_recurring_invoices() -> None:
    """Main cron job: generate due recurring invoices."""
    today = date.today()
    logger.info(f"[Scheduler] Running recurring invoice job for {today}")

    async with AsyncSessionLocal() as session:
        # Load business settings
        biz_result = await session.execute(select(BusinessSettings).limit(1))
        business = biz_result.scalar_one_or_none()
        if not business:
            logger.warning("[Scheduler] No business settings found — skipping.")
            return

        # Load due active schedules with client preloaded
        result = await session.execute(
            select(RecurringSchedule)
            .options(selectinload(RecurringSchedule.client))
            .where(
                RecurringSchedule.is_active == True,
                RecurringSchedule.next_run_date <= today,
            )
        )
        schedules = result.scalars().all()
        logger.info(f"[Scheduler] Found {len(schedules)} due schedule(s)")

        for schedule in schedules:
            try:
                await _generate_invoice_from_schedule(session, schedule, business)
                # Advance next run date
                schedule.next_run_date = _advance_date(schedule.next_run_date, schedule.frequency)
                logger.info(
                    f"[Scheduler] Processed schedule '{schedule.name}' — "
                    f"next run: {schedule.next_run_date}"
                )
            except Exception as exc:
                logger.error(f"[Scheduler] Failed for schedule {schedule.id}: {exc}", exc_info=True)

        await session.commit()


async def _generate_invoice_from_schedule(
    session, schedule: RecurringSchedule, business: BusinessSettings
) -> Invoice:
    from app.engines.pdf import render_invoice_pdf
    from app.engines.email import send_invoice_email

    # Build line items from template
    template_items = schedule.line_items_template or []
    line_inputs = [
        LineItemInput(
            description=li["description"],
            quantity=Decimal(str(li.get("quantity", 1))),
            unit_price=Decimal(str(li["unit_price"])),
            vat_rate=li.get("vat_rate", "21"),
            sort_order=i,
        )
        for i, li in enumerate(template_items)
    ]

    client = schedule.client
    totals = compute_invoice(
        line_inputs,
        mode=schedule.calculation_mode.value,
        client_country_code=client.country_code,
        client_vat_number=client.vat_number,
    )

    invoice_number = await _next_invoice_number(session, business)
    issue_date = date.today()
    due_date = issue_date + timedelta(days=schedule.payment_term_days)

    invoice = Invoice(
        invoice_number=invoice_number,
        client_id=client.id,
        issue_date=issue_date,
        due_date=due_date,
        status=InvoiceStatus.DRAFT,
        calculation_mode=schedule.calculation_mode,
        subtotal_excl_vat=totals.subtotal_excl_vat,
        total_vat_amount=totals.total_vat_amount,
        total_incl_vat=totals.total_incl_vat,
        payment_reference=invoice_number,
        notes=schedule.notes_template,
        recurring_schedule_id=schedule.id,
    )
    session.add(invoice)
    await session.flush()  # get invoice.id

    for li in totals.line_items:
        session.add(InvoiceLineItem(
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

    # Need client relationship for PDF
    invoice.client = client

    # Render PDF
    try:
        pdf_path = render_invoice_pdf(invoice, business)
        invoice.pdf_path = str(pdf_path)
        invoice.status = InvoiceStatus.DRAFT
    except Exception as e:
        logger.error(f"PDF render failed for {invoice_number}: {e}")
        pdf_path = None

    # Send email if configured
    if schedule.auto_send_email and client.email and pdf_path:
        try:
            await send_invoice_email(invoice, business, pdf_path)
            from datetime import datetime
            invoice.sent_at = datetime.utcnow()
            invoice.status = InvoiceStatus.SENT
            logger.info(f"[Scheduler] Sent {invoice_number} to {client.email}")
        except Exception as e:
            logger.error(f"[Scheduler] Email send failed for {invoice_number}: {e}")

    return invoice


# ─── Scheduler Lifecycle ──────────────────────────────────────────────────────

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone=settings.SCHEDULER_TIMEZONE)
    _scheduler.add_job(
        process_recurring_invoices,
        trigger=CronTrigger(
            hour=settings.RECURRING_CRON_HOUR,
            minute=settings.RECURRING_CRON_MINUTE,
            timezone=settings.SCHEDULER_TIMEZONE,
        ),
        id="recurring_invoices",
        name="Generate Recurring Invoices",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        f"[Scheduler] Started — cron at "
        f"{settings.RECURRING_CRON_HOUR:02d}:{settings.RECURRING_CRON_MINUTE:02d} "
        f"({settings.SCHEDULER_TIMEZONE})"
    )
    return _scheduler


def stop_scheduler() -> None:
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")

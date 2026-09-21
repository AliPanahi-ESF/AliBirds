"""
Async Email Dispatcher
=======================
Sends transactional invoice emails via SMTP using aiosmtplib.
Attaches the rendered PDF and uses an HTML email body.
"""
from __future__ import annotations

import ssl
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

import aiosmtplib

from app.core.config import settings


# ─── HTML Email Template ──────────────────────────────────────────────────────

def _build_email_body(invoice, business) -> str:
    client = invoice.client
    due_str = invoice.due_date.strftime("%d %B %Y") if invoice.due_date else "zie factuur"
    total_str = f"€ {float(invoice.total_incl_vat):.2f}".replace(".", ",")

    return f"""
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8"/>
  <style>
    body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }}
    .wrapper {{ max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden;
               box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
    .header {{ background: {business.accent_color or '#2563EB'}; padding: 28px 32px; }}
    .header h1 {{ color: #fff; margin: 0; font-size: 22px; font-weight: 700; }}
    .header p {{ color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px; }}
    .body {{ padding: 28px 32px; color: #1a1a2e; }}
    .body p {{ line-height: 1.7; margin: 0 0 14px; font-size: 15px; }}
    .amount-box {{ background: #f9fafb; border: 1px solid #e5e7eb; border-left: 4px solid {business.accent_color or '#2563EB'};
                  border-radius: 4px; padding: 14px 20px; margin: 20px 0; }}
    .amount-box .label {{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
                          color: #9ca3af; margin-bottom: 4px; }}
    .amount-box .value {{ font-size: 24px; font-weight: 700; color: #1a1a2e; }}
    .amount-box .due {{ font-size: 13px; color: #6b7280; margin-top: 4px; }}
    .iban-section {{ background: #eff6ff; border-radius: 4px; padding: 12px 16px; margin: 16px 0; font-size: 13px; }}
    .iban-section strong {{ font-family: 'Courier New', monospace; font-size: 14px; color: {business.accent_color or '#2563EB'}; }}
    .footer {{ background: #f9fafb; padding: 18px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>{business.company_name}</h1>
      <p>Factuur {invoice.invoice_number}</p>
    </div>
    <div class="body">
      <p>Beste {client.contact_person or client.name},</p>
      <p>Hierbij ontvangt u de factuur voor de geleverde diensten/producten. De factuur is bijgevoegd als PDF.</p>

      <div class="amount-box">
        <div class="label">Te betalen bedrag</div>
        <div class="value">{total_str}</div>
        <div class="due">Vervaldatum: {due_str}</div>
      </div>

      {'<div class="iban-section">Graag overmaken naar:<br/><strong>' + business.iban + '</strong>'
        + (' &nbsp;|&nbsp; BIC: ' + business.bic if business.bic else '')
        + '<br/>O.v.v. <strong>' + (invoice.payment_reference or invoice.invoice_number) + '</strong></div>'
        if business.iban else ''}

      <p>Heeft u vragen over deze factuur? Neem dan gerust contact met ons op.</p>
      <p>Met vriendelijke groet,<br/>
      <strong>{business.company_name}</strong><br/>
      {business.email or ''}</p>
    </div>
    <div class="footer">
      {business.company_name}
      {' &middot; KVK ' + business.kvk_number if business.kvk_number else ''}
      {' &middot; BTW-id ' + business.btw_id if business.btw_id else ''}
    </div>
  </div>
</body>
</html>
"""


# ─── Send Function ────────────────────────────────────────────────────────────

async def send_invoice_email(
    invoice,
    business,
    pdf_path: Path,
    extra_note: Optional[str] = None,
) -> None:
    """
    Send an invoice email with the PDF attached.

    Args:
        invoice: Invoice ORM object (with .client loaded).
        business: BusinessSettings ORM object.
        pdf_path: Path to the generated PDF file.
        extra_note: Optional plain-text note appended to the email body.
    """
    client = invoice.client
    recipient_email = client.email
    if not recipient_email:
        raise ValueError(f"Client '{client.name}' has no email address configured.")

    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"Factuur {invoice.invoice_number} — {business.company_name}"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = recipient_email
    msg["Reply-To"] = business.email or settings.SMTP_FROM_EMAIL

    # HTML body
    html_body = _build_email_body(invoice, business)
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # PDF attachment
    if pdf_path.exists():
        with open(pdf_path, "rb") as f:
            pdf_data = f.read()
        pdf_part = MIMEApplication(pdf_data, _subtype="pdf")
        pdf_part.add_header(
            "Content-Disposition",
            "attachment",
            filename=f"Factuur_{invoice.invoice_number}.pdf",
        )
        msg.attach(pdf_part)

    # SMTP send
    smtp_kwargs = dict(
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER or None,
        password=settings.SMTP_PASS or None,
        start_tls=settings.SMTP_STARTTLS,
    )

    await aiosmtplib.send(msg, **smtp_kwargs)

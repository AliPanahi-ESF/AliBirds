"""
WeasyPrint PDF Generation Engine
=================================
Renders a Jinja2 HTML template to A4 PDF using WeasyPrint.
Supports custom logo, accent colour, and all legally required
Dutch invoice fields.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader
from weasyprint import CSS, HTML

from app.core.config import settings

# ─── Jinja2 Environment ───────────────────────────────────────────────────────

TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=True,
)


def _load_logo_b64(logo_url: Optional[str]) -> Optional[str]:
    """
    If logo_url is a local path, base64-encode it for inline embedding.
    Otherwise return the URL as-is for <img src=...>.
    """
    if not logo_url:
        return None
    p = Path(logo_url)
    if p.exists() and p.is_file():
        with open(p, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        suffix = p.suffix.lower().lstrip(".")
        mime = "image/svg+xml" if suffix == "svg" else f"image/{suffix}"
        return f"data:{mime};base64,{data}"
    return logo_url


# ─── Main Render Function ─────────────────────────────────────────────────────

def render_invoice_pdf(invoice, business: object) -> Path:
    """
    Generate a PDF for *invoice* and save it to PDF_OUTPUT_DIR.

    Args:
        invoice: SQLAlchemy Invoice ORM object (with .client and .line_items loaded).
        business: SQLAlchemy BusinessSettings ORM object.

    Returns:
        Path to the generated PDF file.
    """
    template = _jinja_env.get_template("invoice.html")

    # Determine reverse-charge / VAT note
    client = invoice.client
    is_reverse_charge = any(
        (li.vat_rate.value if hasattr(li.vat_rate, "value") else str(li.vat_rate)) == "REVERSE_CHARGE"
        for li in invoice.line_items
    )

    # Collect VAT breakdown for display (group by rate)
    vat_groups: dict = {}
    for li in invoice.line_items:
        rate = li.vat_rate.value if hasattr(li.vat_rate, "value") else str(li.vat_rate)
        if rate not in vat_groups:
            vat_groups[rate] = {"base": 0.0, "vat": 0.0}
        vat_groups[rate]["base"] += float(li.line_total_excl)
        vat_groups[rate]["vat"] += float(li.vat_amount)

    logo_src = _load_logo_b64(business.logo_url)

    context = {
        "business": business,
        "invoice": invoice,
        "client": client,
        "line_items": invoice.line_items,
        "vat_groups": vat_groups,
        "is_reverse_charge": is_reverse_charge,
        "logo_src": logo_src,
        "accent_color": business.accent_color or "#2563EB",
    }

    html_content = template.render(**context)

    # WeasyPrint render
    out_dir = Path(settings.PDF_OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{invoice.invoice_number}.pdf"

    base_url = str(TEMPLATE_DIR)
    HTML(string=html_content, base_url=base_url).write_pdf(
        str(out_path),
        presentational_hints=True,
    )

    return out_path


def get_pdf_path(invoice_number: str) -> Optional[Path]:
    p = Path(settings.PDF_OUTPUT_DIR) / f"{invoice_number}.pdf"
    return p if p.exists() else None

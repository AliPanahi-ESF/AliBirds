"""
Dutch VAT Calculation Engine
============================
Handles dual-mode VAT computation (Exclusive / Inclusive) and
generates Btw-aangifte rubric aggregations per quarter.

All arithmetic uses Python's Decimal type with ROUND_HALF_UP to
ensure legally compliant financial rounding.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import List, Optional, Dict
from datetime import date


# ─── Constants ────────────────────────────────────────────────────────────────

CENT = Decimal("0.01")
EU_MEMBER_STATES = {
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
    "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
    "NL", "PL", "PT", "RO", "SE", "SI", "SK",
}

# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class LineItemInput:
    description: str
    quantity: Decimal
    unit_price: Decimal         # net (excl.) or gross (incl.) depending on mode
    vat_rate: str               # "21", "9", "0", "REVERSE_CHARGE"
    sort_order: int = 0


@dataclass
class ComputedLineItem:
    description: str
    quantity: Decimal
    unit_price: Decimal
    vat_rate: str
    sort_order: int

    line_total_excl: Decimal    # net amount excl. VAT
    vat_amount: Decimal
    line_total_incl: Decimal    # gross amount incl. VAT


@dataclass
class InvoiceTotals:
    subtotal_excl_vat: Decimal
    total_vat_amount: Decimal
    total_incl_vat: Decimal
    vat_breakdown: Dict[str, Dict[str, Decimal]]  # {"21": {"base": x, "vat": y}, ...}
    line_items: List[ComputedLineItem]


# ─── VAT Rates ────────────────────────────────────────────────────────────────

def _vat_multiplier(rate_str: str) -> Decimal:
    """Return the VAT fraction (e.g. '21' → Decimal('0.21'))."""
    if rate_str in ("0", "REVERSE_CHARGE"):
        return Decimal("0")
    return Decimal(rate_str) / Decimal("100")


# ─── Core Calculator ──────────────────────────────────────────────────────────

def compute_invoice(
    line_items: List[LineItemInput],
    mode: str,  # "EXCLUSIVE" | "INCLUSIVE"
    client_country_code: str = "NL",
    client_vat_number: Optional[str] = None,
) -> InvoiceTotals:
    """
    Compute all line item amounts and invoice totals.

    Exclusive mode: unit_price is NET (excl. VAT).
    Inclusive mode: unit_price is GROSS (incl. VAT).
    """
    computed: List[ComputedLineItem] = []
    vat_breakdown: Dict[str, Dict[str, Decimal]] = {}

    for item in line_items:
        qty = item.quantity.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        rate_fraction = _vat_multiplier(item.vat_rate)

        # Determine effective VAT rate (reverse charge for B2B EU)
        effective_rate = item.vat_rate
        if (
            client_country_code in EU_MEMBER_STATES
            and client_country_code != "NL"
            and client_vat_number
            and item.vat_rate != "0"
        ):
            # Intra-EU B2B service → reverse charge → 0% on invoice
            effective_rate = "REVERSE_CHARGE"
            rate_fraction = Decimal("0")

        if mode == "EXCLUSIVE":
            line_excl = (item.unit_price * qty).quantize(CENT, rounding=ROUND_HALF_UP)
            vat_amt = (line_excl * rate_fraction).quantize(CENT, rounding=ROUND_HALF_UP)
            line_incl = line_excl + vat_amt
        else:
            # INCLUSIVE: user entered gross price per unit
            line_incl = (item.unit_price * qty).quantize(CENT, rounding=ROUND_HALF_UP)
            if rate_fraction == Decimal("0"):
                line_excl = line_incl
                vat_amt = Decimal("0")
            else:
                line_excl = (line_incl / (Decimal("1") + rate_fraction)).quantize(
                    CENT, rounding=ROUND_HALF_UP
                )
                vat_amt = line_incl - line_excl

        computed.append(
            ComputedLineItem(
                description=item.description,
                quantity=qty,
                unit_price=item.unit_price,
                vat_rate=effective_rate,
                sort_order=item.sort_order,
                line_total_excl=line_excl,
                vat_amount=vat_amt,
                line_total_incl=line_incl,
            )
        )

        # Accumulate VAT breakdown
        bucket = effective_rate
        if bucket not in vat_breakdown:
            vat_breakdown[bucket] = {"base": Decimal("0"), "vat": Decimal("0")}
        vat_breakdown[bucket]["base"] += line_excl
        vat_breakdown[bucket]["vat"] += vat_amt

    subtotal_excl = sum(c.line_total_excl for c in computed)
    total_vat = sum(c.vat_amount for c in computed)
    total_incl = subtotal_excl + total_vat

    return InvoiceTotals(
        subtotal_excl_vat=subtotal_excl.quantize(CENT, rounding=ROUND_HALF_UP),
        total_vat_amount=total_vat.quantize(CENT, rounding=ROUND_HALF_UP),
        total_incl_vat=total_incl.quantize(CENT, rounding=ROUND_HALF_UP),
        vat_breakdown=vat_breakdown,
        line_items=computed,
    )


# ─── Btw-aangifte Rubric Aggregator ───────────────────────────────────────────

@dataclass
class BtwRubric:
    code: str
    description: str
    turnover: Decimal = field(default_factory=lambda: Decimal("0"))
    tax: Decimal = field(default_factory=lambda: Decimal("0"))

    def as_dict(self) -> dict:
        return {
            "code": self.code,
            "description": self.description,
            "turnover": float(self.turnover.quantize(CENT, rounding=ROUND_HALF_UP)),
            "tax": float(self.tax.quantize(CENT, rounding=ROUND_HALF_UP)),
        }


@dataclass
class BtwAangifteResult:
    quarter: str            # e.g. "2026-Q1"
    start_date: date
    end_date: date
    rubrics: Dict[str, BtwRubric]
    voorbelasting: Decimal  # 5b — deductible input VAT from expenses
    te_betalen: Decimal     # positive = amount owed; negative = refund

    def as_dict(self) -> dict:
        return {
            "quarter": self.quarter,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "rubrics": {k: v.as_dict() for k, v in self.rubrics.items()},
            "voorbelasting": float(self.voorbelasting.quantize(CENT, rounding=ROUND_HALF_UP)),
            "te_betalen": float(self.te_betalen.quantize(CENT, rounding=ROUND_HALF_UP)),
        }


def aggregate_btw_aangifte(
    invoices: list,          # list of Invoice ORM objects with .line_items
    expenses: list,          # list of Expense ORM objects
    quarter: int,
    year: int,
) -> BtwAangifteResult:
    """
    Aggregate all invoice line items and expenses for a given quarter
    into official Belastingdienst Btw-aangifte rubrics.

    Rubric mapping:
      1a — 21% sales (hoog tarief)
      1b —  9% sales (laag tarief)
      1c —  0% sales (nul tarief / vrijgesteld)
      3a / 3b — EU intra-community (reverse charge)
      5b — voorbelasting (deductible input VAT from expenses)
    """
    from datetime import date as dt

    quarter_starts = {1: (1, 1), 2: (4, 1), 3: (7, 1), 4: (10, 1)}
    quarter_ends   = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}

    sm, sd = quarter_starts[quarter]
    em, ed = quarter_ends[quarter]
    start_date = dt(year, sm, sd)
    end_date = dt(year, em, ed)

    rubrics: Dict[str, BtwRubric] = {
        "1a": BtwRubric("1a", "Leveringen/diensten hoog tarief (21%)"),
        "1b": BtwRubric("1b", "Leveringen/diensten laag tarief (9%)"),
        "1c": BtwRubric("1c", "Leveringen/diensten 0% of vrijgesteld"),
        "3a": BtwRubric("3a", "Leveringen naar landen buiten EU (export)"),
        "3b": BtwRubric("3b", "Diensten naar/vanuit EU (intracommunautair)"),
        "5b": BtwRubric("5b", "Voorbelasting"),
    }

    for inv in invoices:
        inv_date = inv.issue_date if hasattr(inv.issue_date, "year") else inv.issue_date
        if not (start_date.date() <= inv_date <= end_date.date()):
            continue
        if inv.status.value in ("CANCELLED", "DRAFT"):
            continue

        client_country = getattr(inv.client, "country_code", "NL") if inv.client else "NL"
        client_vat = getattr(inv.client, "vat_number", None) if inv.client else None
        is_eu_b2b = (
            client_country in EU_MEMBER_STATES
            and client_country != "NL"
            and bool(client_vat)
        )
        is_non_eu = client_country not in EU_MEMBER_STATES

        for line in inv.line_items:
            base = Decimal(str(line.line_total_excl))
            vat = Decimal(str(line.vat_amount))
            rate = line.vat_rate.value if hasattr(line.vat_rate, "value") else str(line.vat_rate)

            if is_non_eu:
                rubrics["3a"].turnover += base
                # 0% tax, no VAT added for export
            elif is_eu_b2b or rate == "REVERSE_CHARGE":
                rubrics["3b"].turnover += base
            elif rate == "21":
                rubrics["1a"].turnover += base
                rubrics["1a"].tax += vat
            elif rate == "9":
                rubrics["1b"].turnover += base
                rubrics["1b"].tax += vat
            else:  # "0"
                rubrics["1c"].turnover += base

    # 5b — voorbelasting from expenses
    for exp in expenses:
        exp_date = exp.expense_date if hasattr(exp.expense_date, "year") else exp.expense_date
        if not (start_date.date() <= exp_date <= end_date.date()):
            continue
        rubrics["5b"].tax += Decimal(str(exp.vat_amount))

    # Eindtotaal
    collected = sum(r.tax for k, r in rubrics.items() if k != "5b")
    voorbelasting = rubrics["5b"].tax
    te_betalen = collected - voorbelasting

    return BtwAangifteResult(
        quarter=f"{year}-Q{quarter}",
        start_date=start_date.date(),
        end_date=end_date.date(),
        rubrics=rubrics,
        voorbelasting=voorbelasting.quantize(CENT, rounding=ROUND_HALF_UP),
        te_betalen=te_betalen.quantize(CENT, rounding=ROUND_HALF_UP),
    )

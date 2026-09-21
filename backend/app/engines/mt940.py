"""
MT940 Bank Statement Parser & Automated Reconciliation Pipeline
==============================================================

Parses bunq / ING / Rabobank MT940 (.sta) files and reconciles
CREDIT transactions against outstanding invoices.

MT940 field reference:
  :20:  Transaction reference
  :25:  Account identification
  :28C: Statement number / sequence
  :60F: Opening balance
  :61:  Statement line  (value-date, D/C, amount, transaction type)
  :86:  Information to account owner (remittance, /IBAN/, /NAME/, /REMI/)
  :62F: Closing balance

Sub-field format in :86:
  /IBAN/<counterpart IBAN>
  /NAME/<counterpart name>
  /REMI/<remittance information>
  /EREF/<end-to-end reference>
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from rapidfuzz import fuzz

# ─── Regex Patterns ───────────────────────────────────────────────────────────

# :61: Statement line pattern
# Format: YYMMDD[MMDD]2a[1!a]15d4!c[//16x][34x]
RE_61 = re.compile(
    r":61:\s*"
    r"(?P<value_date>\d{6})"
    r"(?P<entry_date>\d{4})?"
    r"(?P<dc>[CD]R?)"
    r"(?P<amount>[\d,]+)"
    r"N(?P<type_code>[A-Z]{3})"
    r"(?:\s*//(?P<ref>[^\n]+))?"
    r"(?:\s*(?P<counterpart>[^\n]+))?",
    re.IGNORECASE,
)

# :86: sub-field extractors
RE_IBAN = re.compile(r"/IBAN/([A-Z]{2}[A-Z0-9]{13,30})", re.IGNORECASE)
RE_NAME = re.compile(r"/NAME/([^/\n]+)", re.IGNORECASE)
RE_REMI = re.compile(r"/REMI/([^/\n]+)", re.IGNORECASE)
RE_EREF = re.compile(r"/EREF/([^/\n]+)", re.IGNORECASE)

# Invoice number patterns: 2026-0001, 2026/0001, INV2026-0001
RE_INVOICE_NUMBER = re.compile(r"\b(?:[A-Z]{0,4}[-/]?)?(\d{4})[-/](\d{3,5})\b", re.IGNORECASE)


# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class MT940Transaction:
    transaction_date: date
    value_date: Optional[date]
    amount: Decimal
    type: str                   # "CREDIT" | "DEBIT"
    counterpart_name: Optional[str]
    counterpart_iban: Optional[str]
    remittance_reference: Optional[str]
    raw_mt940_hash: str
    raw_86: str = ""


@dataclass
class MT940Statement:
    account_iban: str
    opening_balance: Decimal
    closing_balance: Decimal
    statement_date: Optional[date]
    transactions: List[MT940Transaction] = field(default_factory=list)


@dataclass
class ReconciliationMatch:
    transaction_hash: str
    invoice_id: str
    invoice_number: str
    confidence: str             # "AUTO" | "PENDING"
    match_reason: str


# ─── Parser ───────────────────────────────────────────────────────────────────

def _parse_mt940_date(yymmdd: str) -> date:
    """Parse YYMMDD string to date, assuming 2000s for YY < 70."""
    yy = int(yymmdd[:2])
    mm = int(yymmdd[2:4])
    dd = int(yymmdd[4:6])
    year = 2000 + yy if yy < 70 else 1900 + yy
    return date(year, mm, dd)


def _parse_amount(raw: str) -> Decimal:
    """Convert MT940 amount string (comma as decimal separator) to Decimal."""
    return Decimal(raw.replace(",", "."))


def _compute_hash(
    txn_date: date,
    amount: Decimal,
    counterpart_iban: Optional[str],
    remittance: Optional[str],
) -> str:
    key = f"{txn_date.isoformat()}|{amount}|{counterpart_iban or ''}|{remittance or ''}"
    return hashlib.sha256(key.encode()).hexdigest()


def _extract_86_fields(text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Return (counterpart_iban, counterpart_name, remittance_reference) from :86: block."""
    iban_match = RE_IBAN.search(text)
    name_match = RE_NAME.search(text)
    remi_match = RE_REMI.search(text) or RE_EREF.search(text)
    return (
        iban_match.group(1).strip() if iban_match else None,
        name_match.group(1).strip() if name_match else None,
        remi_match.group(1).strip() if remi_match else None,
    )


def parse_mt940(content: str) -> MT940Statement:
    """
    Parse a complete MT940 file content string into an MT940Statement.
    Handles multi-transaction statements and :86: continuation lines.
    """
    # Split into tag blocks
    blocks: List[Tuple[str, str]] = []
    for match in re.finditer(r":(\w+):(.*?)(?=:\w+:|$)", content, re.DOTALL):
        blocks.append((match.group(1), match.group(2).strip()))

    tag_map: dict = {}
    for tag, value in blocks:
        tag_map.setdefault(tag, []).append(value)

    # Account IBAN from :25:
    account_iban = tag_map.get("25", ["UNKNOWN"])[0].split("/")[-1].strip()

    # Opening balance from :60F:
    ob_raw = tag_map.get("60F", ["EUR0,"])[0]
    ob_dc = ob_raw[3] if len(ob_raw) > 3 else "C"
    ob_amount_str = ob_raw[10:] if len(ob_raw) > 10 else ob_raw[4:]
    opening_balance = _parse_amount(ob_amount_str)
    if ob_dc == "D":
        opening_balance = -opening_balance

    # Closing balance from :62F:
    cb_raw = tag_map.get("62F", ["EUR0,"])[0]
    cb_dc = cb_raw[3] if len(cb_raw) > 3 else "C"
    cb_amount_str = cb_raw[10:] if len(cb_raw) > 10 else cb_raw[4:]
    closing_balance = _parse_amount(cb_amount_str)
    if cb_dc == "D":
        closing_balance = -closing_balance

    # Parse :61: + :86: pairs
    transactions: List[MT940Transaction] = []
    raw_61_list = tag_map.get("61", [])
    raw_86_list = tag_map.get("86", [])

    for i, raw_61 in enumerate(raw_61_list):
        m = RE_61.search(":61:" + raw_61)
        if not m:
            continue

        value_date = _parse_mt940_date(m.group("value_date"))
        entry_date_str = m.group("entry_date")
        transaction_date = value_date

        dc_raw = m.group("dc").upper()
        txn_type = "CREDIT" if dc_raw.startswith("C") else "DEBIT"
        amount = _parse_amount(m.group("amount"))

        # :86: remittance for this transaction (may not exist)
        raw_86 = raw_86_list[i] if i < len(raw_86_list) else ""
        iban, name, remi = _extract_86_fields(raw_86)

        raw_hash = _compute_hash(transaction_date, amount, iban, remi)

        transactions.append(
            MT940Transaction(
                transaction_date=transaction_date,
                value_date=value_date,
                amount=amount,
                type=txn_type,
                counterpart_iban=iban,
                counterpart_name=name,
                remittance_reference=remi,
                raw_mt940_hash=raw_hash,
                raw_86=raw_86,
            )
        )

    return MT940Statement(
        account_iban=account_iban,
        opening_balance=opening_balance,
        closing_balance=closing_balance,
        statement_date=transactions[-1].transaction_date if transactions else None,
        transactions=transactions,
    )


# ─── Reconciliation Pipeline ──────────────────────────────────────────────────

def _extract_invoice_numbers(text: str) -> List[str]:
    """
    Extract potential invoice number patterns from remittance text.
    Matches: 2026-0001, 2026/0042, INV-2025-0099, etc.
    """
    matches = RE_INVOICE_NUMBER.findall(text)
    return [f"{year}-{seq.zfill(4)}" for year, seq in matches]


def reconcile_transactions(
    transactions: List[MT940Transaction],
    open_invoices: list,  # Invoice ORM objects: .id, .invoice_number, .total_incl_vat, .client
) -> List[ReconciliationMatch]:
    """
    Core reconciliation algorithm.

    Steps per CREDIT transaction:
      1. Exact amount match against open invoices.
      2. If exact: extract invoice number patterns from :86: remittance.
         a. Exact invoice number match → AUTO match.
         b. No number but single amount match → AUTO match (with lower confidence note).
         c. Fuzzy client name match (score ≥ 85) → PENDING.
      3. No amount match → skip.
    """
    matches: List[ReconciliationMatch] = []

    credits = [t for t in transactions if t.type == "CREDIT"]

    for txn in credits:
        # Build amount-matched candidates
        candidates = [
            inv for inv in open_invoices
            if Decimal(str(inv.total_incl_vat)) == txn.amount
        ]

        if not candidates:
            continue

        remittance_text = " ".join(filter(None, [
            txn.remittance_reference or "",
            txn.counterpart_name or "",
            txn.raw_86,
        ]))

        extracted_numbers = _extract_invoice_numbers(remittance_text)

        # Try exact invoice number match
        for inv in candidates:
            if any(
                num.lower() in inv.invoice_number.lower()
                or inv.invoice_number.lower() in num.lower()
                for num in extracted_numbers
            ):
                matches.append(ReconciliationMatch(
                    transaction_hash=txn.raw_mt940_hash,
                    invoice_id=inv.id,
                    invoice_number=inv.invoice_number,
                    confidence="AUTO",
                    match_reason=f"Amount match + invoice number '{inv.invoice_number}' found in remittance",
                ))
                break
        else:
            # Fuzzy match on client name or single candidate
            if len(candidates) == 1 and not extracted_numbers:
                # Only one invoice matches this amount
                matches.append(ReconciliationMatch(
                    transaction_hash=txn.raw_mt940_hash,
                    invoice_id=candidates[0].id,
                    invoice_number=candidates[0].invoice_number,
                    confidence="AUTO",
                    match_reason=f"Unique amount match (€{txn.amount}) — no competing invoices",
                ))
            else:
                # Fuzzy name match
                for inv in candidates:
                    client_name = inv.client.name if inv.client else ""
                    score = fuzz.partial_ratio(
                        remittance_text.lower(),
                        client_name.lower(),
                    )
                    if score >= 75:
                        matches.append(ReconciliationMatch(
                            transaction_hash=txn.raw_mt940_hash,
                            invoice_id=inv.id,
                            invoice_number=inv.invoice_number,
                            confidence="PENDING",
                            match_reason=f"Amount match + fuzzy name match ({score}% confidence)",
                        ))
                        break

    return matches

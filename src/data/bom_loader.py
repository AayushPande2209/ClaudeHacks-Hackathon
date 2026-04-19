from __future__ import annotations
"""BOM loader and parsers for uploaded materials."""

import io
import os
import json
import csv
from pathlib import Path

SAMPLE_BOM = [
    {
        "sku": "EB-MTR-01",
        "description": "BLDC Hub Motor Assembly - 1000W",
        "hs_code": "8501.32.45",
        "supplier": "Bafang Electric",
        "supplier_country": "China",
        "annual_volume_units": 15000,
        "unit_cost_usd": 185.00,
        "annual_spend_usd": 2775000,
        "alt_suppliers": ["Bosch eBike Systems (Germany)", "Yamaha (Japan)"],
        "has_domestic_alt": False,
        "alt_supplier": None,
        "lead_time_weeks": 10,
        "critical_path": True,
    },
    {
        "sku": "EB-BAT-03",
        "description": "18650 Lithium-Ion Battery Array - 48V 15Ah",
        "hs_code": "8507.60.00",
        "supplier": "Sunwoda Electronic",
        "supplier_country": "China",
        "annual_volume_units": 15000,
        "unit_cost_usd": 240.00,
        "annual_spend_usd": 3600000,
        "alt_suppliers": ["Panasonic (Japan)", "LG Energy (Korea)"],
        "has_domestic_alt": False,
        "alt_supplier": None,
        "lead_time_weeks": 14,
        "critical_path": True,
    },
    {
        "sku": "EB-MAG-04",
        "description": "Sintered Neodymium Permanent Magnets (NdFeB)",
        "hs_code": "8505.11.00",
        "supplier": "JL MAG Rare-Earth",
        "supplier_country": "China",
        "annual_volume_units": 300000,
        "unit_cost_usd": 4.50,
        "annual_spend_usd": 1350000,
        "alt_suppliers": ["Shin-Etsu (Japan)", "Hitachi Metals (Japan)"],
        "has_domestic_alt": False,
        "alt_supplier": None,
        "lead_time_weeks": 8,
        "critical_path": True,
    },
    {
        "sku": "EB-CTRL-02",
        "description": "FOC Vector Control PCB with MOSFETs",
        "hs_code": "8537.10.91",
        "supplier": "VinSmart EMS",
        "supplier_country": "Vietnam",
        "annual_volume_units": 15000,
        "unit_cost_usd": 85.00,
        "annual_spend_usd": 1275000,
        "alt_suppliers": ["Foxconn (Taiwan)", "Plexus (US)"],
        "has_domestic_alt": True,
        "alt_supplier": "Plexus (US)",
        "lead_time_weeks": 12,
        "critical_path": True,
    },
    {
        "sku": "EB-ENC-05",
        "description": "Die-Cast Aluminum Enclosure IP67",
        "hs_code": "7616.99.50",
        "supplier": "Catcher Technology",
        "supplier_country": "Taiwan",
        "annual_volume_units": 15000,
        "unit_cost_usd": 18.00,
        "annual_spend_usd": 270000,
        "alt_suppliers": ["Catcher (China)", "Protolabs (US)"],
        "has_domestic_alt": True,
        "alt_supplier": "Protolabs (US)",
        "lead_time_weeks": 6,
        "critical_path": False,
    }
]


def load_bom(path: str | None = None) -> list[dict]:
    env_path = os.getenv("TARIFFPILOT_BOM_PATH")
    target = path or env_path

    if not target:
        return SAMPLE_BOM

    p = Path(target)
    if not p.exists():
        print(f"[BOMLoader] Warning: {target} not found, using sample BOM")
        return SAMPLE_BOM

    if p.suffix.lower() == ".json":
        with open(p) as f:
            return json.load(f)

    if p.suffix.lower() in (".csv", ".tsv"):
        with open(p, "rb") as f:
            parsed = parse_bom_csv(f.read(), filename=p.name)
        return parsed["rows"]

    print(f"[BOMLoader] Unsupported format: {p.suffix}, using sample BOM")
    return SAMPLE_BOM


def extract_pdf_text(pdf_file: bytes | io.IOBase) -> str:
    """Extract all text from a PDF file using pdfplumber. Returns concatenated page text."""
    import pdfplumber

    if isinstance(pdf_file, (bytes, bytearray)):
        pdf_file = io.BytesIO(pdf_file)

    pages = []
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)
    return "\n".join(pages)


def parse_bom_csv(csv_file: bytes | io.IOBase, filename: str = "bom.csv") -> dict:
    """Parse uploaded CSV/TSV content into normalized BOM rows plus validation errors."""
    if hasattr(csv_file, "read"):
        csv_file = csv_file.read()
    if not isinstance(csv_file, (bytes, bytearray)):
        raise TypeError("csv_file must be bytes or a file-like object")

    suffix = Path(filename).suffix.lower()
    delimiter = "\t" if suffix == ".tsv" else ","
    text = csv_file.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    rows = []
    errors = []
    for i, raw in enumerate(reader):
        rows.append(_normalize_uploaded_row(dict(raw), i, errors))
    return {"rows": rows, "errors": errors}


def extract_csv_text(csv_file: bytes | io.IOBase, filename: str = "bom.csv", max_chars: int = 4000) -> str:
    """Return a compact plain-text preview of a CSV/TSV upload for agent context."""
    parsed = parse_bom_csv(csv_file, filename=filename)
    lines = []
    for row in parsed["rows"][:25]:
        lines.append(
            " | ".join([
                row.get("sku_code", ""),
                row.get("description", ""),
                row.get("supplier_country", ""),
                str(row.get("unit_cost_usd", "")),
                row.get("hs_code") or "",
            ]).strip(" |")
        )
    preview = "\n".join(lines)
    return preview[:max_chars]


def _normalize_uploaded_row(r: dict, i: int, errors: list[str]) -> dict:
    # Lowercase all keys for case-insensitive matching
    r = {k.strip().lower(): v for k, v in r.items()}

    def pick(*keys):
        for k in keys:
            v = r.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        return ""

    out = {}
    out["sku_code"] = pick("sku_code", "sku", "item_number", "item_no", "item #", "item", "part_number", "part_no", "no", "id") or f"SKU-{i:04d}"
    out["description"] = pick("description", "desc", "item_description", "part_description", "name", "item_name", "component")
    out["supplier_name"] = pick("supplier_name", "supplier", "vendor", "manufacturer", "supplier name")
    out["supplier_country"] = pick(
        "supplier_country",
        "country",
        "origin",
        "country_of_origin",
        "country of origin",
        "made in",
        "manufacturing country",
        "mfg country",
        "mfg_country",
        "source_country",
        "supplier country",
    )

    try:
        out["tier"] = int(pick("tier") or 1)
    except Exception:
        out["tier"] = 1
        errors.append(f"Row {i}: invalid tier")

    try:
        out["annual_quantity"] = int(float(pick("annual_quantity", "annual_volume_units", "qty", "quantity", "annual_qty") or 0))
    except Exception:
        out["annual_quantity"] = 0
        errors.append(f"Row {i}: invalid annual_quantity")

    try:
        raw_cost = pick("unit_cost_usd", "unit_cost", "unit cost (usd)", "unit cost", "cost (usd)", "cost", "cost_usd", "price", "unit_price", "price_usd")
        out["unit_cost_usd"] = float(raw_cost.lstrip("$").replace(",", "") or 0)
    except Exception:
        out["unit_cost_usd"] = 0.0
        errors.append(f"Row {i}: invalid unit_cost_usd")

    out["hs_code"] = pick("hs_code", "hs_codes", "hts_code", "hts", "hs", "tariff_code", "harmonized_code") or None

    try:
        out["annual_spend_usd"] = float(
            r.get("annual_spend_usd")
            or r.get("annual_spend")
            or out["annual_quantity"] * out["unit_cost_usd"]
        )
    except Exception:
        out["annual_spend_usd"] = float(out["annual_quantity"] * out["unit_cost_usd"])
        errors.append(f"Row {i}: invalid annual_spend_usd")

    out["has_domestic_alt"] = str(r.get("has_domestic_alt", "false")).lower() in ("true", "1", "yes")
    out["alt_supplier"] = r.get("alt_supplier") or r.get("alternative_supplier") or None
    out["lead_time_weeks"] = r.get("lead_time_weeks") or r.get("lead_time") or None
    out["critical_path"] = str(r.get("critical_path", "false")).lower() in ("true", "1", "yes")
    return out

#!/usr/bin/env python3
"""Prepare a reproducible, whole-order sample of SQLBI Contoso sales lines.

Requires Python 3 and bsdtar (libarchive). No generator or Python packages are used.
Run: python3 scripts/import-contoso.py
Use --archive /path/to/csv-100k.7z to reuse a verified local download.
"""

from __future__ import annotations

import argparse
import csv
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.request import urlopen

SOURCE_URL = "https://github.com/sql-bi/Contoso-Data-Generator-V2-Data/releases/download/ready-to-use-data/csv-100k.7z"
SOURCE_SHA256 = "f05a4a9010e6bb0f52845e7850cc114b5cd8df24dec623b475f74c702057944b"
OUTPUT = Path(__file__).resolve().parents[1] / "src/assets/contoso-retail-v2.json.gz"
SOURCE_LINE_COUNT = 223_974
SOURCE_ORDER_COUNT = 93_470
SELECTED_LINE_COUNT = 20_108
SELECTED_ORDER_COUNT = 8_304
SELECTED_TOTALS = {"quantity": 63_393, "revenueCents": 1_618_292_669,
                   "costCents": 714_330_740, "profitCents": 903_961_929}
SELECTED_YEARS = (2024, 2025)
ORDER_HASH_THRESHOLD = 67
CENT = Decimal("0.01")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")


def csv_rows(path: Path) -> list[dict[str, str]]:
    # newline="" lets csv handle quoted newlines and escaped quotes correctly.
    with path.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if not rows or any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f"Empty or malformed CSV: {path.name}")
    return rows


def unique_index(rows: list[dict[str, str]], key: str, table: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        value = row[key]
        if not value or value in result:
            raise ValueError(f"Missing or duplicate {table}.{key}: {value!r}")
        result[value] = row
    return result


def cents(value: Decimal) -> int:
    return int((value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def include_order(order_key: str, order_date: str) -> bool:
    """Keep every line of a selected 2024/2025 order."""
    year = date.fromisoformat(order_date).year
    return year in SELECTED_YEARS and hashlib.sha256(order_key.encode("utf-8")).digest()[0] < ORDER_HASH_THRESHOLD


def prepare(directory: Path, *, select_orders: bool = True) -> dict:
    sales = csv_rows(directory / "sales.csv")
    source_orders = {sale["OrderKey"] for sale in sales}
    source_dates = [date.fromisoformat(sale["OrderDate"]).isoformat() for sale in sales]
    selected_sales = [sale for sale in sales if not select_orders or include_order(sale["OrderKey"], sale["OrderDate"])]
    products = unique_index(csv_rows(directory / "product.csv"), "ProductKey", "product")
    customers = unique_index(csv_rows(directory / "customer.csv"), "CustomerKey", "customer")
    stores = unique_index(csv_rows(directory / "store.csv"), "StoreKey", "store")
    # The release also supplies Orders/OrderRows, which are an alternative view
    # of these transactions. Never append them to sales.csv.
    rows: list[dict] = []
    ids: set[str] = set()
    orders: set[str] = set()
    totals = {"quantity": 0, "revenueCents": 0, "costCents": 0, "profitCents": 0}
    for sale in selected_sales:
        order_id = sale["OrderKey"]
        line_id = f"{order_id}:{sale['LineNumber']}"
        if line_id in ids:
            raise ValueError(f"Duplicate sales line: {line_id}")
        ids.add(line_id)
        orders.add(order_id)
        product = products[sale["ProductKey"]]
        customer = customers[sale["CustomerKey"]]
        store = stores[sale["StoreKey"]]
        day = date.fromisoformat(sale["OrderDate"])
        quantity = int(sale["Quantity"])
        if quantity <= 0:
            raise ValueError(f"Invalid quantity for {line_id}")
        rate = Decimal(sale["ExchangeRate"])
        if rate <= 0 or sale["CurrencyCode"] == "USD" and rate != 1:
            raise ValueError(f"Invalid USD-to-local exchange rate for {line_id}")
        unit_price = Decimal(sale["UnitPrice"])
        net_price = Decimal(sale["NetPrice"])
        unit_cost = Decimal(sale["UnitCost"])
        if min(unit_price, net_price, unit_cost) < 0 or net_price > unit_price:
            raise ValueError(f"Invalid unit amounts for {line_id}")
        # Generator Engine.cs creates all three unit amounts from USD product
        # prices. Its ExchangeRate is USD -> order currency, so do not apply it
        # to the values used in this USD report.
        revenue = cents(net_price * quantity)
        cost = cents(unit_cost * quantity)
        profit = revenue - cost
        row = {
            "Order ID": order_id,
            "Line ID": line_id,
            "Date": day.isoformat(),
            "Year": day.year,
            "Quarter": f"Q{(day.month - 1) // 3 + 1}",
            "Month": MONTHS[day.month - 1],
            "Month Number": day.month,
            "Country": customer["CountryFull"],
            "Store Country": store["CountryName"],
            "Store": store["Description"],
            "Category": product["CategoryName"],
            "Subcategory": product["SubCategoryName"],
            "Product": product["ProductName"],
            "Brand": product["Brand"],
            "Quantity": quantity,
            "Revenue": revenue / 100,
            "Cost": cost / 100,
            "Gross Profit": profit / 100,
            "Order Currency": sale["CurrencyCode"],
            "Reporting Currency": "USD",
        }
        if not row["Country"] or not row["Category"] or not row["Product"]:
            raise ValueError(f"Missing joined dimension for {line_id}")
        rows.append(row)
        totals["quantity"] += quantity
        totals["revenueCents"] += revenue
        totals["costCents"] += cost
        totals["profitCents"] += profit
    if len(rows) != len(selected_sales) or len(ids) != len(selected_sales):
        raise ValueError("Sales-line reconciliation failed")
    if totals["revenueCents"] - totals["costCents"] != totals["profitCents"]:
        raise ValueError("Money reconciliation failed")
    dates = [row["Date"] for row in rows]
    complete_years = [year for year in sorted({row["Year"] for row in rows})
                      if min(dates) <= f"{year}-01-01" and max(dates) >= f"{year}-12-31"]
    # Availability is computed from the source date span, never current time.
    latest_complete_year = max(complete_years) if complete_years else max(row["Year"] for row in rows)
    return {
        "version": 2,
        "sourceSha256": SOURCE_SHA256,
        "metadata": {
            "lineCount": len(rows), "orderCount": len(orders),
            "minDate": min(dates), "maxDate": max(dates),
            "sourceLineCount": len(sales), "sourceOrderCount": len(source_orders),
            "sourceMinDate": min(source_dates), "sourceMaxDate": max(source_dates),
            "selection": {"years": list(SELECTED_YEARS),
                          "sha256FirstByteLessThan": ORDER_HASH_THRESHOLD},
            "reportingCurrency": "USD", "latestCompleteYear": latest_complete_year,
            "totals": totals,
        },
        "rows": rows,
    }


def validate_release(result: dict) -> None:
    metadata = result["metadata"]
    expected = {"sourceLineCount": SOURCE_LINE_COUNT, "sourceOrderCount": SOURCE_ORDER_COUNT,
                "lineCount": SELECTED_LINE_COUNT, "orderCount": SELECTED_ORDER_COUNT,
                "minDate": "2024-01-01", "maxDate": "2025-12-31",
                "latestCompleteYear": 2025, "totals": SELECTED_TOTALS}
    for key, value in expected.items():
        if metadata[key] != value:
            raise ValueError(f"Unexpected {key}: {metadata[key]!r}, expected {value!r}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, help="Reuse a local copy of the official archive")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="contoso-import-") as temp:
        archive = args.archive or Path(temp) / "csv-100k.7z"
        if not args.archive:
            with urlopen(SOURCE_URL, timeout=60) as response, archive.open("wb") as target:
                while chunk := response.read(1024 * 1024):
                    target.write(chunk)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        if digest != SOURCE_SHA256:
            raise ValueError(f"Archive SHA-256 mismatch: {digest}")
        directory = Path(temp) / "csv"
        directory.mkdir()
        subprocess.run(["bsdtar", "-xf", str(archive), "-C", str(directory),
                        "sales.csv", "product.csv", "customer.csv", "store.csv"], check=True)
        result = prepare(directory)
        validate_release(result)
        data = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode()
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        with OUTPUT.open("wb") as output:
            with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0, compresslevel=9) as stream:
                stream.write(data)
        print(json.dumps({**result["metadata"], "jsonBytes": len(data),
                          "gzipBytes": OUTPUT.stat().st_size, "output": str(OUTPUT)}, indent=2))


if __name__ == "__main__":
    main()

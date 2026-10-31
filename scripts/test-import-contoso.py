#!/usr/bin/env python3
"""Focused import-contract tests using quoted CSV and source-unit amounts."""

import csv
from copy import deepcopy
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).with_name("import-contoso.py")
spec = importlib.util.spec_from_file_location("import_contoso", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImportContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.write("product", [{"ProductKey": "3", "CategoryName": "Audio",
                                "SubCategoryName": "Headphones", "ProductName": 'A, "quoted" name', "Brand": "Contoso"}])
        self.write("customer", [{"CustomerKey": "2", "CountryFull": "Canada"}])
        self.write("store", [{"StoreKey": "1", "CountryName": "United States", "Description": "Web"}])
        self.write("sales", [{"OrderKey": "9", "LineNumber": "0", "OrderDate": "2025-02-01",
                              "ProductKey": "3", "CustomerKey": "2", "StoreKey": "1",
                              "Quantity": "2", "UnitPrice": "187.4925", "NetPrice": "187.4925",
                              "UnitCost": "62.1225", "CurrencyCode": "AUD", "ExchangeRate": "1.41628"}])

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name, rows):
        with (self.directory / (name + ".csv")).open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    def test_quoted_join_and_usd_unit_money(self):
        data = module.prepare(self.directory)
        self.assertEqual(data["metadata"]["lineCount"], 1)
        self.assertEqual(data["metadata"]["orderCount"], 1)
        self.assertEqual(data["rows"][0]["Product"], 'A, "quoted" name')
        self.assertEqual(data["rows"][0]["Country"], "Canada")
        self.assertEqual(data["rows"][0]["Store Country"], "United States")
        self.assertEqual(data["rows"][0]["Revenue"], 374.99)
        self.assertEqual(data["rows"][0]["Cost"], 124.25)
        self.assertEqual(data["rows"][0]["Gross Profit"], 250.74)
        self.assertEqual(data["rows"][0]["Quarter"], "Q1")

    def test_duplicate_dimension_is_rejected(self):
        self.write("product", [{"ProductKey": "3", "CategoryName": "A", "SubCategoryName": "B", "ProductName": "X", "Brand": "C"},
                               {"ProductKey": "3", "CategoryName": "A", "SubCategoryName": "B", "ProductName": "Y", "Brand": "C"}])
        with self.assertRaisesRegex(ValueError, "duplicate product.ProductKey"):
            module.prepare(self.directory)

    def test_duplicate_line_is_rejected(self):
        path = self.directory / "sales.csv"
        with path.open(newline="") as stream:
            sale = next(csv.DictReader(stream))
        self.write("sales", [sale, sale])
        with self.assertRaisesRegex(ValueError, "Duplicate sales line"):
            module.prepare(self.directory)

    def test_bad_date_is_rejected(self):
        path = self.directory / "sales.csv"
        with path.open(newline="") as stream:
            sale = next(csv.DictReader(stream))
        sale["OrderDate"] = "2025-02-30"
        self.write("sales", [sale])
        with self.assertRaises(ValueError):
            module.prepare(self.directory)

    def test_whole_order_selection_and_december_boundary(self):
        with (self.directory / "sales.csv").open(newline="") as stream:
            sale = next(csv.DictReader(stream))
        first = deepcopy(sale)
        first["OrderKey"] = "8"  # SHA-256 first byte 44: selected.
        first["OrderDate"] = "2024-01-01"
        second = deepcopy(first)
        second["LineNumber"] = "1"
        last = deepcopy(sale)
        last["OrderKey"] = "13"  # SHA-256 first byte 63: selected.
        last["OrderDate"] = "2025-12-31"
        excluded = deepcopy(sale)
        excluded["OrderKey"] = "1"  # SHA-256 first byte 107: excluded.
        self.write("sales", [first, second, last, excluded])

        result = module.prepare(self.directory)
        self.assertEqual({row["Line ID"] for row in result["rows"]}, {"8:0", "8:1", "13:0"})
        self.assertEqual(result["metadata"]["sourceLineCount"], 4)
        self.assertEqual(result["metadata"]["sourceOrderCount"], 3)
        self.assertEqual(result["metadata"]["orderCount"], 2)
        self.assertEqual(result["metadata"]["latestCompleteYear"], 2025)


if __name__ == "__main__":
    unittest.main()

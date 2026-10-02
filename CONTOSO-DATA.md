# Contoso retail data in the Pivot showcase

Source: SQLBI, [Contoso Data Generator V2 Data, `ready-to-use-data` release](https://github.com/sql-bi/Contoso-Data-Generator-V2-Data/releases/tag/ready-to-use-data), asset [`csv-100k.7z`](https://github.com/sql-bi/Contoso-Data-Generator-V2-Data/releases/download/ready-to-use-data/csv-100k.7z). Release commit `ac1fc8d`; archive SHA-256 `f05a4a9010e6bb0f52845e7850cc114b5cd8df24dec623b475f74c702057944b` (9,786,343 bytes).

Copyright (c) 2024 SQLBI. Source repository license: MIT. The [license text](https://github.com/sql-bi/Contoso-Data-Generator-V2-Data/blob/main/LICENSE) applies to the prepared asset and is reproduced below.

The source archive has 223,974 `sales.csv` lines in 93,470 orders. The browser asset selects complete orders dated 2024–2025 when the first byte of SHA-256(`OrderKey`) is below 67: **20,108 original transaction lines in 8,304 orders**. This stable order selection retains every line of each selected order. `orders.csv` and `orderrows.csv` represent the same orders and are not combined with `sales.csv`. Selected lines join on unique `ProductKey`, `CustomerKey`, and `StoreKey`. Customer `CountryFull` becomes `Country`; store `CountryName` stays separate as `Store Country`; product category, subcategory, name, and brand come from `product.csv`. No customer names, addresses, email, or other personal fields are published.

The generator's `Engine.cs` calculates `UnitPrice`, `NetPrice`, and `UnitCost` from USD product prices, while the sale's `ExchangeRate` is looked up from **USD to the order currency**. Thus the published report uses USD amounts without applying the exchange rate. `Revenue = Quantity × NetPrice`, `Cost = Quantity × UnitCost`, and `Gross Profit = Revenue − Cost`. Each line is rounded to cents with decimal half-up arithmetic before aggregation. Order currency is retained as a dimension only; all monetary measures use USD. Original dates and quantities are preserved.

The source archive covers 2016-05-18 to 2025-12-31; selected lines cover 2024-01-01 to 2025-12-31. The default report uses the latest complete calendar year, 2025. The prepared v2 JSON is 9,201,957 bytes and its reproducible gzip asset is 808,135 bytes. The release tier name “100K” describes approximate orders, not the actual line or order count.

Known selected-dataset totals: 63,393 units, USD 16,182,926.69 revenue, USD 7,143,307.40 cost, and USD 9,039,619.29 gross profit. The default 2025 filter contains 10,148 lines in 4,204 orders and USD 7,776,899.28 revenue. The v1 10K-source asset remains in the repository as a regression fixture; the demo loads v2.

Regenerate from the pinned URL with `pnpm data:contoso` (requires Python 3 and `bsdtar`/libarchive), or use a downloaded archive with `python3 scripts/import-contoso.py --archive /path/to/csv-100k.7z`. The script verifies the SHA-256, extracts only required tables, validates the source and selected counts, dates, USD cents totals, and joins, then writes `src/assets/contoso-retail-v2.json.gz`. Normal builds and visitors use this local asset only.

## MIT license

Copyright (c) 2024 SQLBI

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# Pivot your data

A browser-local Excel/CSV playground with three steps: choose a file, review detected fields, then build a Pivot report. Includes sample data, a source-record view, native Pivot field configuration, charts and CSV report export. The Vue workspace is shared by JavaScript, React and Angular hosts so file handling stays equivalent.

From the Pivot workspace root:

```sh
pnpm install --frozen-lockfile
pnpm --dir examples/import dev
pnpm --dir examples/import test
pnpm --dir examples/import typecheck
pnpm --dir examples/import build
pnpm --dir examples/import test:e2e
```

Requires Node >=22.22.3 and Playwright Chromium for browser tests.

Supported input: `.xlsx` and UTF-8 `.csv` with comma, semicolon or tab separators. Select one sheet/table per report. The review supports header/data row selection and text, number or ISO date types. Numeric text uses an explicit decimal separator; thousands separators and ambiguous date strings stay text. Excel formulas use cached values; this demo does not recalculate formulas.

Limits: 10 MiB per file, 100,000 selected rows, 200 columns and 1 million worksheet cells. Large or unsupported files are rejected, never silently truncated. Raw workbook cells remain in memory so type choices can be corrected. No file contents are sent to a server or persisted. Original Excel formatting, merged-table reconstruction, joins and legacy `.xls` files are outside this demo.


## Calculation policy

Imported type conversion and aggregate eligibility are separate. Empty numeric cells and malformed text must be reviewed under the chosen measure policy; a datatype label alone does not select strict aggregation. For new numeric reports, use the V2 numeric preset with invalid errors, scalar presets for value/distinct counts, and persist the execution pin. This demo does not change that policy merely by exporting CSV.

See the [source-verified aggregation guide](https://pro.rv-grid.com/guides/pivot/concepts/aggregations/) and [safe saved-report configuration](https://pro.rv-grid.com/guides/migrations/#pivot-calculation-policies-and-saved-reports). Keep this standalone workspace's installed reader/API version in view before copying configuration from another release.

import { exportVisiblePivotToCsv, mountPivotChart, type PivotChartRef } from '@revolist/pivot';
import type { ColumnGrouping, ColumnRegular, DataType } from '@revolist/revogrid';
import { exportVisiblePivotToXlsx } from './pivot.xlsx-export';

/** USD source amounts can accumulate binary floating-point noise; export cents. */
function exportRows(rows: Record<string, unknown>[] | undefined) {
  return rows?.map((row) => {
    const copy = { ...row };
    for (const [key, value] of Object.entries(copy)) {
      if (typeof value === 'number' && Number.isFinite(value)) copy[key] = Number(value.toFixed(2));
    }
    return copy;
  });
}

async function visibleResult(grid: HTMLRevoGridElement) {
  return {
    columns: await grid.getColumns(),
    source: exportRows(await grid.getVisibleSource()),
    pinnedBottomSource: exportRows(grid.pinnedBottomSource),
  };
}

export async function mountFinancialChart(grid: HTMLRevoGridElement, container: HTMLElement): Promise<PivotChartRef> {
  return mountPivotChart(grid, {
    container,
    controls: 'standard',
    presentation: { title: 'Sales by country and quarter' },
  });
}

export async function exportFinancialCsv(grid: HTMLRevoGridElement): Promise<void> {
  const csv = exportVisiblePivotToCsv({ ...await visibleResult(grid), bom: true });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pivot-visible-report.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportFinancialXlsx(grid: HTMLRevoGridElement): Promise<void> {
  const bytes = exportVisiblePivotToXlsx(await visibleResult(grid));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pivot-visible-report.xlsx';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);

type PivotColumn = ColumnGrouping | ColumnRegular;
const isGroup = (column: PivotColumn): column is ColumnGrouping =>
  Array.isArray((column as ColumnGrouping).children);
const headerDepth = (column: PivotColumn): number =>
  isGroup(column) ? 1 + Math.max(0, ...column.children.map(headerDepth)) : 1;
const headerWidth = (column: PivotColumn): number =>
  isGroup(column) ? column.children.reduce((sum, child) => sum + headerWidth(child), 0) : 1;

/** Creates the printable result table from the same visible grid model used by CSV/XLSX. */
export function buildPivotPrintTable(input: {
  columns: PivotColumn[]; source?: DataType[]; pinnedBottomSource?: DataType[];
}): string {
  const depth = Math.max(0, ...input.columns.map(headerDepth));
  const headerRows = Array.from({ length: depth }, () => [] as string[]);
  const leaves: ColumnRegular[] = [];
  const visit = (column: PivotColumn, level: number) => {
    if (isGroup(column)) {
      const span = headerWidth(column);
      if (!span) return;
      headerRows[level].push(`<th scope="colgroup" colspan="${span}">${escapeHtml(column.name)}</th>`);
      column.children.forEach((child) => visit(child, level + 1));
    } else {
      leaves.push(column);
      const rowSpan = depth - level;
      headerRows[level].push(`<th scope="col"${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''}>${escapeHtml(column.name)}</th>`);
    }
  };
  input.columns.forEach((column) => visit(column, 0));
  const headers = headerRows.map((row) => `<tr>${row.join('')}</tr>`).join('');
  const source = input.source ?? [];
  const rows = [...source, ...(input.pinnedBottomSource ?? [])];
  const body = rows.map((row, index) => `<tr${index >= source.length ? ' class="total"' : ''}>${leaves.map((column) =>
    `<td>${escapeHtml(row[column.prop])}</td>`).join('')}</tr>`).join('');
  return `<table><thead>${headers}</thead><tbody>${body}</tbody></table>`;
}

/** Opens the browser's print dialog; Save as PDF uses its paginated output. */
export async function printFinancialPivot(grid: HTMLRevoGridElement): Promise<void> {
  const result = await visibleResult(grid);
  const table = buildPivotPrintTable(result);
  const frame = document.createElement('iframe');
  frame.title = 'Visible pivot result for printing';
  frame.style.cssText = 'position:absolute;width:0;height:0;border:0';
  frame.srcdoc = `<!doctype html><html><head><title>Visible Pivot Result</title><style>
    @page { size: landscape; margin: 12mm; } body { font: 10px Arial,sans-serif; color:#17252a; }
    h1 { font-size:16px; } p { color:#53666c; } table { border-collapse:collapse; width:100%; }
    thead { display:table-header-group; } tr { break-inside:avoid; } th,td { border:1px solid #cad5d6; padding:5px; text-align:left; }
    th,.total { background:#e8f1f0; font-weight:700; }
  </style></head><body><h1>Visible Pivot Result</h1><p>Current visible rows and columns, including pinned totals.</p>
  ${table}</body></html>`;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  document.body.append(frame);
}

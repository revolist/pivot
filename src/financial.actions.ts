import { exportVisiblePivotToCsv, flattenPivotCsvColumns, mountPivotChart, type PivotChartRef } from '@revolist/pivot';
import { exportVisiblePivotToXlsx } from './pivot.xlsx-export';

export async function mountFinancialChart(grid: HTMLRevoGridElement, container: HTMLElement): Promise<PivotChartRef> {
  return mountPivotChart(grid, {
    container,
    controls: 'standard',
    presentation: { title: 'Sales by country and quarter' },
  });
}

export async function exportFinancialCsv(grid: HTMLRevoGridElement): Promise<void> {
  const csv = exportVisiblePivotToCsv({
    columns: await grid.getColumns(),
    source: await grid.getVisibleSource(),
    pinnedBottomSource: grid.pinnedBottomSource,
    bom: true,
  });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pivot-visible-report.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportFinancialXlsx(grid: HTMLRevoGridElement): Promise<void> {
  const bytes = exportVisiblePivotToXlsx({
    columns: await grid.getColumns(),
    source: await grid.getVisibleSource(),
    pinnedBottomSource: grid.pinnedBottomSource,
  });
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

/** Opens the browser's print dialog; Save as PDF uses its paginated output. */
export async function printFinancialPivot(grid: HTMLRevoGridElement): Promise<void> {
  const columns = flattenPivotCsvColumns(await grid.getColumns());
  const rows = [...await grid.getVisibleSource(), ...(grid.pinnedBottomSource ?? [])];
  const pinnedStart = rows.length - (grid.pinnedBottomSource?.length ?? 0);
  const headers = columns.map((column) => `<th scope="col">${escapeHtml(column.header)}</th>`).join('');
  const body = rows.map((row, index) => `<tr${index >= pinnedStart ? ' class="total"' : ''}>${columns.map((column) =>
    `<td>${escapeHtml(row[column.prop])}</td>`).join('')}</tr>`).join('');
  const frame = document.createElement('iframe');
  frame.title = 'Visible pivot result for printing';
  frame.style.cssText = 'position:absolute;width:0;height:0;border:0';
  frame.srcdoc = `<!doctype html><html><head><title>Visible Pivot Result</title><style>
    @page { size: landscape; margin: 12mm; } body { font: 10px Arial,sans-serif; color:#17252a; }
    h1 { font-size:16px; } p { color:#53666c; } table { border-collapse:collapse; width:100%; }
    thead { display:table-header-group; } tr { break-inside:avoid; } th,td { border:1px solid #cad5d6; padding:5px; text-align:left; }
    th,.total { background:#e8f1f0; font-weight:700; }
  </style></head><body><h1>Visible Pivot Result</h1><p>Current visible rows and columns, including pinned totals.</p>
  <table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  document.body.append(frame);
}

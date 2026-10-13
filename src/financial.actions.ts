import { PivotPlugin, mountPivotChart, type PivotChartRef } from '@revolist/pivot';
export { buildPivotPrintTable } from '@revolist/pivot';

/** Find the active public export owner for this grid. */
async function getPivotPlugin(grid: HTMLRevoGridElement) {
  const pivot = (await grid.getPlugins()).find((plugin) => plugin instanceof PivotPlugin);
  if (!pivot) throw new Error('The Pivot report is not available.');
  return pivot;
}

/** Explain chart safety limits without dropping data or leaving an empty chart view. */
export function financialActionError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'LIMIT_EXCEEDED') {
    return 'This report is too detailed to chart. Use Fields to filter the data or choose a grouped report, then open Chart again.';
  }
  return 'Could not complete this report action. Please try again.';
}

export async function mountFinancialChart(grid: HTMLRevoGridElement, container: HTMLElement, title = 'Pivot Table Demo'): Promise<PivotChartRef> {
  return mountPivotChart(grid, {
    container,
    controls: 'standard',
    presentation: { title },
  });
}

export async function exportFinancialCsv(grid: HTMLRevoGridElement): Promise<void> {
  const csv = (await getPivotPlugin(grid)).exportCsv({ bom: true });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pivot-visible-report.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportFinancialXlsx(grid: HTMLRevoGridElement): Promise<void> {
  const bytes = (await getPivotPlugin(grid)).exportXlsx();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pivot-visible-report.xlsx';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Opens the browser's print dialog; Save as PDF uses its paginated output. */
export async function printFinancialPivot(grid: HTMLRevoGridElement): Promise<void> {
  const table = (await getPivotPlugin(grid)).buildPrintTable();
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

import { exportVisiblePivotToCsv, mountPivotChart, type PivotChartRef } from '@revolist/pivot';

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

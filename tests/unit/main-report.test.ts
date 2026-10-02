import { describe, expect, it } from 'vitest';
import { exportPivotReportJson, importPivotReportJson, restorePivotConfig } from '../../src/financial.analytics';
import { createFinancialPreset, resolveFinancialRows } from '../../src/financial.pivot';
import { CONTOSO_FIXTURE } from './contoso-fixture';

describe('main sales report', () => {
  it('opens with 2025 revenue by country and category, quarter with month drill', () => {
    const report = createFinancialPreset();
    expect(report.rows).toEqual(['Country', 'Category']);
    expect(report.columns).toEqual(['Quarter', 'Month']);
    expect(report.columnLevels?.[0]).toMatchObject({ collapsible: true, collapsed: true });
    // New hierarchy levels (for example Year > Quarter > Month) start closed.
    expect(report.columnCollapse).toMatchObject({ enabled: true, collapsed: true });
    expect(report.values).toEqual([{ prop: 'Revenue', aggregator: 'sum', label: 'Revenue (USD)' }]);
    expect(report.dimensions?.find((dimension) => dimension.prop === 'Revenue')?.filter).toBe(false);
    expect(report.contextMenu).toMatchObject({ drillThrough: { columns: [
      'Order ID', 'Line ID', 'Date', 'Country', 'Store Country',
      'Category', 'Subcategory', 'Product', 'Brand', 'Quantity',
      'Revenue', 'Cost', 'Gross Profit',
    ] } });
    expect(report.filterSelections).toEqual({ Year: [2025] });
    expect(restorePivotConfig('sales')).toEqual(report);
  });

  it('uses explicitly supplied Contoso rows while the browser loads its local asset', () => {
    expect(resolveFinancialRows()).toEqual([]);
    expect(resolveFinancialRows(CONTOSO_FIXTURE.rows)).toBe(CONTOSO_FIXTURE.rows);
    expect(CONTOSO_FIXTURE.metadata.latestCompleteYear).toBe(2025);
  });

  it('accepts Contoso report JSON and rejects the old dataset version', () => {
    const current = JSON.parse(exportPivotReportJson(createFinancialPreset(), 'sales'));
    expect(current.dataset).toBe('contoso-retail-v2');
    expect(importPivotReportJson(JSON.stringify(current))?.preset).toBe('sales');
    expect(importPivotReportJson(JSON.stringify({ ...current, version: 1 }))).toBeNull();
    expect(importPivotReportJson(JSON.stringify({ ...current, dataset: 'contoso-retail-v1' }))).toBeNull();
  });

  it('keeps the three reports on the same 2025 scope and starts products collapsed', () => {
    for (const preset of ['sales', 'profitability', 'product'] as const) {
      expect(createFinancialPreset(preset).filterSelections).toEqual({ Year: [2025] });
    }
    expect(createFinancialPreset('profitability').valuesOnRows).toBe(true);
    expect(createFinancialPreset('product')).toMatchObject({ collapsed: true, expanded: {} });
    expect(createFinancialPreset('yoy').filterSelections).toEqual({ Year: [2024, 2025] });
  });
});

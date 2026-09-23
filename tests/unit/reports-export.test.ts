import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  exportPivotReportJson, importPivotReportJson, listSavedPivotReports,
  loadNamedPivotReport, saveNamedPivotReport, deleteNamedPivotReport,
} from '../../src/financial.analytics';
import { createFinancialPreset } from '../../src/financial.pivot';
import { exportVisiblePivotToXlsx } from '../../src/pivot.xlsx-export';
import { buildPivotPrintTable } from '../../src/financial.actions';

describe('Pivot reports', () => {
  beforeEach(() => {
    const entries = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
      clear: () => entries.clear(),
    } });
  });

  it('round-trips named reports and imported JSON without changing the default preset', () => {
    const config = createFinancialPreset('profitability');
    expect(saveNamedPivotReport('Quarter review', config, 'profitability')).toBe(true);
    expect(listSavedPivotReports()).toEqual(['Quarter review']);
    expect(loadNamedPivotReport('Quarter review')?.preset).toBe('profitability');
    expect(importPivotReportJson(exportPivotReportJson(config, 'profitability'))?.config.rows).toEqual(config.rows);
    expect(importPivotReportJson('{"version":99}')).toBeNull();
    deleteNamedPivotReport('Quarter review');
    expect(listSavedPivotReports()).toEqual([]);
  });

  it('exports the current visible result with grouped headers, numeric cells and pinned totals', () => {
    const bytes = exportVisiblePivotToXlsx({
      columns: [
        { name: 'Country', prop: 'country' },
        { name: '2025', children: [
          { name: 'Sales', prop: 'sales' }, { name: 'Profit', prop: 'profit' },
        ] },
      ],
      source: [{ country: 'Portugal', sales: 125.5, profit: -4 }],
      pinnedBottomSource: [{ country: 'Grand Total', sales: 125.5, profit: -4 }],
    });
    const workbook = unzipSync(bytes);
    const sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('ref="B1:C1"');
    expect(sheet).toContain('<c r="B3" s="2" t="n"><v>125.5</v></c>');
    expect(sheet).toContain('<c r="C4" s="3" t="n"><v>-4</v></c>');
    expect(sheet).toContain('Grand Total');
  });

  it('prints nested headers on separate rows and marks pinned totals', () => {
    const html = buildPivotPrintTable({
      columns: [
        { name: 'Country', prop: 'country' },
        { name: '2025', children: [
          { name: 'Q1', children: [
            { name: 'Sales', prop: 'sales' }, { name: 'Profit', prop: 'profit' },
          ] },
          { name: 'Year Total', prop: 'total' },
        ] },
      ],
      source: [{ country: 'A&B', sales: 125, profit: -4, total: 121 }],
      pinnedBottomSource: [{ country: 'Grand Total', sales: 125, profit: -4, total: 121 }],
    });
    const table = document.createElement('div');
    table.innerHTML = html;
    const headRows = table.querySelectorAll('thead tr');
    expect(headRows).toHaveLength(3);
    expect(headRows[0].querySelector('th[scope="colgroup"]')?.getAttribute('colspan')).toBe('3');
    expect(headRows[0].querySelector('th[scope="col"]')?.getAttribute('rowspan')).toBe('3');
    expect(headRows[1].querySelector('th[scope="colgroup"]')?.getAttribute('colspan')).toBe('2');
    expect(headRows[1].querySelector('th[scope="col"]')?.textContent).toBe('Year Total');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table.querySelector('tbody tr')?.textContent).toContain('A&B');
    expect(html).toContain('A&amp;B');
    expect(table.querySelector('tbody tr.total')?.textContent).toContain('Grand Total');
  });
});

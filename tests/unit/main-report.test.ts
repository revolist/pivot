import { describe, expect, it } from 'vitest';
import { activeFinancialFilters, restorePivotConfig } from '../../src/financial.analytics';
import { createFinancialPreset, resolveFinancialRows } from '../../src/financial.pivot';
import { SALES_TRANSACTIONS_V2 } from '../../src/sales-transactions-v2';

describe('main sales report', () => {
  it('opens with 2025 Sales by country and quarter', () => {
    const report = createFinancialPreset();
    expect(report.rows).toEqual(['Country']);
    expect(report.columns).toEqual(['Quarter']);
    expect(report.values).toEqual([{ prop: 'Sales', aggregator: 'sum' }]);
    expect(activeFinancialFilters(report)).toEqual(['Year: 2025']);
    expect(restorePivotConfig('sales')).toEqual(report);
  });

  it('uses the versioned transaction fixture by default', () => {
    expect(resolveFinancialRows()).toBe(SALES_TRANSACTIONS_V2);
    expect(resolveFinancialRows()).toHaveLength(20_000);
  });
});

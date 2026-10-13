import { describe, expect, it } from 'vitest';
import { SALES_TRANSACTIONS_V2 } from '../../src/sales-transactions-v2';
import {
  FINANCIAL_ANALYSIS_PRESET_IDS,
  FINANCIAL_PRESETS,
  createFinancialPreset,
} from '../../src/financial.pivot';

describe('financial analysis reports', () => {
  it('provides five distinct questions with a report configuration for each', () => {
    expect(FINANCIAL_ANALYSIS_PRESET_IDS).toEqual([
      'profit', 'contribution', 'running', 'yoy', 'ranking',
    ]);
    for (const id of FINANCIAL_ANALYSIS_PRESET_IDS) {
      const config = createFinancialPreset(id);
      expect(config.values.length).toBeGreaterThan(0);
      expect(FINANCIAL_PRESETS.find((preset) => preset.id === id)?.description).toMatch(/\?/);
    }
  });

  it('uses aggregated profit and sales for contribution rather than averaging row percentages', () => {
    const config = createFinancialPreset('contribution');
    expect(config.values[0].calculation).toEqual({ type: 'percentOfGrandTotal' });
    const segment = String(SALES_TRANSACTIONS_V2[0].Segment);
    const profit = SALES_TRANSACTIONS_V2.reduce((sum, record) =>
      sum + (record.Segment === segment ? Number(record.Profit) : 0), 0);
    const allProfit = SALES_TRANSACTIONS_V2.reduce((sum, record) => sum + Number(record.Profit), 0);
    expect(profit / allProfit).toBeGreaterThan(0);
    expect(profit / allProfit).toBeLessThan(1);
  });

  it('specifies the comparison axis and ranking measure explicitly', () => {
    expect(createFinancialPreset('running').values[0].calculation)
      .toEqual({ type: 'runningTotal', axis: 'columns', field: 'Month' });
    expect(createFinancialPreset('yoy').values[1].calculation)
      .toEqual({ type: 'percentDifferenceFrom', axis: 'columns', field: 'Year', base: 'previous' });
    expect(createFinancialPreset('ranking').values[1].format)
      .toEqual({ preset: 'number', options: { maximumFractionDigits: 0 } });
    expect(createFinancialPreset('ranking').values[1].calculation)
      .toEqual({ type: 'rank', axis: 'rows', field: 'Product', order: 'desc' });
  });

  it('returns independent preset configuration objects', () => {
    const first = createFinancialPreset('yoy');
    const second = createFinancialPreset('yoy');
    first.values[1].label = 'Changed';
    expect(second.values[1].label).toBe('YoY change');
  });
});

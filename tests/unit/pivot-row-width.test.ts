import { describe, expect, it } from 'vitest';
import { createFinancialPreset, financialPivotColumnSize } from '../../src/financial.pivot';

describe('financial Pivot report column sizing', () => {
  const host = { clientWidth: 1200 } as HTMLElement;

  it('reserves the main report row-label width in alternative reports', () => {
    expect(financialPivotColumnSize(host, createFinancialPreset('profitability'))).toBeGreaterThanOrEqual(275);
    expect(financialPivotColumnSize(host, createFinancialPreset('product'))).toBeGreaterThanOrEqual(275);
  });

  it('retains the fitted value columns in Sales Overview', () => {
    expect(financialPivotColumnSize(host, createFinancialPreset('sales'))).toBe(184);
  });
});

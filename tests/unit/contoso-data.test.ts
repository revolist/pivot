import { describe, expect, it } from 'vitest';
import { filterPivotSource } from '@revolist/pivot';
import { createFinancialPreset } from '../../src/financial.pivot';
import { CONTOSO_FIXTURE, CONTOSO_V1_FIXTURE } from './contoso-fixture';

const { rows, metadata } = CONTOSO_FIXTURE;
const cents = (value: number) => Math.round(value * 100);

describe('prepared Contoso sales lines', () => {
  it('preserves unique lines, orders, dates and USD money totals', () => {
    expect(CONTOSO_FIXTURE.version).toBe(2);
    expect(CONTOSO_FIXTURE.sourceSha256).toBe('f05a4a9010e6bb0f52845e7850cc114b5cd8df24dec623b475f74c702057944b');
    expect(rows).toHaveLength(20_108);
    expect(new Set(rows.map((row) => row['Line ID'])).size).toBe(rows.length);
    expect(new Set(rows.map((row) => row['Order ID'])).size).toBe(8_304);
    expect(metadata).toMatchObject({ lineCount: 20_108, orderCount: 8_304,
      minDate: '2024-01-01', maxDate: '2025-12-31', latestCompleteYear: 2025,
      sourceLineCount: 223_974, sourceOrderCount: 93_470,
      sourceMinDate: '2016-05-18', sourceMaxDate: '2025-12-31',
      selection: { years: [2024, 2025], sha256FirstByteLessThan: 67 },
      reportingCurrency: 'USD',
      totals: { quantity: 63_393, revenueCents: 1_618_292_669,
        costCents: 714_330_740, profitCents: 903_961_929 } });
    expect(rows.reduce((sum, row) => sum + row.Quantity, 0)).toBe(metadata.totals.quantity);
    expect(rows.reduce((sum, row) => sum + cents(row.Revenue), 0)).toBe(metadata.totals.revenueCents);
    expect(rows.reduce((sum, row) => sum + cents(row.Cost), 0)).toBe(metadata.totals.costCents);
    expect(rows.reduce((sum, row) => sum + cents(row['Gross Profit']), 0)).toBe(metadata.totals.profitCents);
    expect(metadata.totals.revenueCents - metadata.totals.costCents).toBe(metadata.totals.profitCents);
    for (const row of rows) {
      expect(row.Date.slice(0, 4)).toBe(String(row.Year));
      expect([2024, 2025]).toContain(row.Year);
      expect(row.Quarter).toBe(`Q${Math.ceil(row['Month Number'] / 3)}`);
      expect(row['Reporting Currency']).toBe('USD');
      expect(cents(row.Revenue) - cents(row.Cost)).toBe(cents(row['Gross Profit']));
    }
  });

  it('keeps original non-USD order currency while reporting source USD prices without double conversion', () => {
    expect(rows[0]).toMatchObject({ 'Line ID': '2923003:0', 'Order Currency': 'CAD',
      Quantity: 1, Revenue: 1534.5, Cost: 546.68, 'Gross Profit': 987.82 });
  });

  it('reconciles active year and category-quarter subtotals with source lines', () => {
    const config = createFinancialPreset('sales');
    const filtered = filterPivotSource(rows, config);
    expect(filtered.every((row) => row.Year === 2025)).toBe(true);
    const expected = rows.filter((row) => row.Year === 2025);
    expect(expected).toHaveLength(10_148);
    expect(new Set(expected.map((row) => row['Order ID'])).size).toBe(4_204);
    expect(expected.reduce((sum, row) => sum + cents(row.Revenue), 0)).toBe(777_689_928);
    expect(filtered.reduce((sum, row) => sum + cents(row.Revenue), 0))
      .toBe(expected.reduce((sum, row) => sum + cents(row.Revenue), 0));
    const category = 'Computers';
    const quarter = 'Q1';
    const subset = filtered.filter((row) => row.Category === category && row.Quarter === quarter);
    expect(subset.length).toBeGreaterThan(0);
    expect(subset).toHaveLength(656);
    expect(subset.reduce((sum, row) => sum + cents(row.Revenue), 0)).toBe(74_579_826);
    expect(subset.reduce((sum, row) => sum + cents(row.Revenue), 0)).toBe(
      rows.filter((row) => row.Year === 2025 && row.Category === category && row.Quarter === quarter)
        .reduce((sum, row) => sum + cents(row.Revenue), 0),
    );
  });

  it('retains the prior 10K-source asset for regression checks', () => {
    expect(CONTOSO_V1_FIXTURE).toMatchObject({ version: 1,
      metadata: { lineCount: 3_996, orderCount: 1_681 } });
  });
});

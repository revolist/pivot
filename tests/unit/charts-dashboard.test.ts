import { describe, expect, it } from 'vitest';
import { createChartsConfig, dashboardRows, totalRevenue } from '../../src/charts-dashboard.model';
import { SALES_TRANSACTIONS_V2 } from '../../src/sales-transactions-v2';

describe('Pivot charts dashboard model', () => {
  it('uses the same active member filters as Pivot for dashboard totals', () => {
    const config = createChartsConfig(2025, 'Country', 'Enterprise');
    const selected = dashboardRows(config);

    expect(config.rows).toEqual(['Country']);
    expect(config.columns).toEqual(['Quarter']);
    expect(config.values).toEqual([{ prop: 'Sales', aggregator: 'sum', label: 'Revenue (USD)' }]);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((row) => row.Year === 2025 && row.Segment === 'Enterprise')).toBe(true);
    expect(totalRevenue(selected)).toBeCloseTo(
      SALES_TRANSACTIONS_V2
        .filter((row) => row.Year === 2025 && row.Segment === 'Enterprise')
        .reduce((sum, row) => sum + row.Sales, 0),
      2,
    );
  });

  it('changes the Pivot grouping while retaining filter selections', () => {
    const config = createChartsConfig(2024, 'Product', 'Midmarket');
    expect(config.rows).toEqual(['Product']);
    expect(config.filterSelections).toEqual({ Year: [2024], Segment: ['Midmarket'] });
    expect(dashboardRows(config).every((row) => row.Year === 2024 && row.Segment === 'Midmarket')).toBe(true);
  });
});

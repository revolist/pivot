import { describe, expect, it } from 'vitest';
import { createChartsConfig, dashboardRows, totalRevenue } from '../../src/charts-dashboard.model';
import { CONTOSO_FIXTURE } from './contoso-fixture';

const source = CONTOSO_FIXTURE.rows;

describe('Pivot charts dashboard model', () => {
  it('uses the same active member filters as Pivot for dashboard totals', () => {
    const config = createChartsConfig(2025, 'Country', 'Contoso');
    const selected = dashboardRows(config, source);

    expect(config.rows).toEqual(['Country']);
    expect(config.columns).toEqual(['Quarter']);
    expect(config.values).toEqual([{ prop: 'Revenue', aggregator: 'sum', label: 'Revenue (USD)' }]);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((row) => row.Year === 2025 && row.Brand === 'Contoso')).toBe(true);
    expect(totalRevenue(selected)).toBeCloseTo(
      source.filter((row) => row.Year === 2025 && row.Brand === 'Contoso')
        .reduce((sum, row) => sum + row.Revenue, 0), 2,
    );
  });

  it('changes the grouping while retaining filter selections', () => {
    const config = createChartsConfig(2024, 'Category', 'Fabrikam');
    expect(config.rows).toEqual(['Category']);
    expect(config.filterSelections).toEqual({ Year: [2024], Brand: ['Fabrikam'] });
    expect(dashboardRows(config, source).every((row) => row.Year === 2024 && row.Brand === 'Fabrikam')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { createChartsConfig, dashboardRows, totalRevenue, comparisonChartHeight, dashboardFilterControl, updateDashboardFilter } from '../../src/charts-dashboard.model';
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

it('expands ordinary comparison reports and bounds large result height', () => {
  expect(comparisonChartHeight(0)).toBe(300);
  expect(comparisonChartHeight(8)).toBe(476);
  expect(comparisonChartHeight(2017)).toBe(comparisonChartHeight(12));
});

describe('dashboard filter controls', () => {
  it('represents unrestricted, multiple and excluded filters without selecting only the first value', () => {
    const config = createChartsConfig();
    config.filterSelections = {};
    expect(dashboardFilterControl(config, 'Year', [2024, 2025])).toEqual({ value: '', label: 'all years' });
    config.filterSelections = { Year: [2024, 2025], Brand: { mode: 'exclude', values: ['Contoso'] } };
    expect(dashboardFilterControl(config, 'Year', [2024, 2025])).toEqual({ value: '__custom__', label: '2024, 2025' });
    expect(dashboardFilterControl(config, 'Brand', ['Contoso'])).toEqual({ value: '__custom__', label: 'excluding Contoso' });
    config.filterSelections = { Year: [], Brand: { mode: 'exclude', values: [] } };
    expect(dashboardFilterControl(config, 'Year', [2024, 2025]).value).toBe('');
    expect(dashboardFilterControl(config, 'Brand', ['Contoso']).label).toBe('all brands');
    config.filterSelections = { Year: { mode: 'exclude', values: [2024] }, Brand: ['Contoso', 'Fabrikam'] };
    expect(dashboardFilterControl(config, 'Year', [2024, 2025]).label).toBe('excluding 2024');
    expect(dashboardFilterControl(config, 'Brand', ['Contoso', 'Fabrikam']).value).toBe('__custom__');
    config.filterSelections = { Year: [2024], Brand: ['Contoso'] };
    expect(dashboardFilterControl(config, 'Year', [2024, 2025])).toEqual({ value: '2024', label: '2024' });
    expect(dashboardFilterControl(config, 'Brand', ['Contoso'])).toEqual({ value: 'Contoso', label: 'Contoso' });
  });

  it('updates only the chosen filter, retaining arbitrary configurator layout and other filters', () => {
    const config = { ...createChartsConfig(), rows: ['Quarter'], columns: ['Category'],
      filterSelections: { Year: [2024, 2025], Brand: { mode: 'exclude' as const, values: ['Contoso'] }, Country: ['Australia'] } };
    const next = updateDashboardFilter(config, 'Year', '2024');
    expect(next.rows).toEqual(['Quarter']);
    expect(next.columns).toEqual(['Category']);
    expect(next.filterSelections).toEqual({ Year: [2024], Brand: { mode: 'exclude', values: ['Contoso'] }, Country: ['Australia'] });
    expect(updateDashboardFilter(next, 'Year', '').filterSelections).toEqual({ Brand: { mode: 'exclude', values: ['Contoso'] }, Country: ['Australia'] });
    expect(config.filterSelections.Year).toEqual([2024, 2025]);
  });
});

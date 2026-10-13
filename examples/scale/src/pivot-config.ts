/** Dimensions and measures for the client scale example. */
import type { PivotConfig } from '@revolist/pivot';

export function createScalePivotConfig(): PivotConfig {
  return {
    dimensions: [
      { prop: 'region', name: 'Region', size: 240 },
      { prop: 'segment', name: 'Segment', size: 240 },
      { prop: 'category', name: 'Category', size: 240 },
      { prop: 'year', name: 'Year' },
      { prop: 'quarter', name: 'Quarter' },
      { prop: 'sales', name: 'Sales (USD)', size: 200 },
      { prop: 'profit', name: 'Profit (USD)', size: 200 },
    ],
    rows: ['region', 'segment'],
    columns: ['year', 'quarter'],
    values: [{ prop: 'sales', aggregator: 'sum', label: 'Sales (USD)', format: { preset: 'currency', currency: 'USD' } }],
    filters: ['category'],
    totals: { grandTotal: true, subtotals: true },
    // Collapsed hierarchy rows display their totals through the group aggregate renderer.
    groupAggregations: true,
    collapsed: true,
    columnCollapse: { collapsed: true },
    hasConfigurator: true,
  };
}

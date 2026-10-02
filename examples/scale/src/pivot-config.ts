import type { PivotConfig } from '@revolist/pivot';

export const VIEW_ID = 'scale-sales-v1';
export const FIELDS_VERSION = 'scale-sales-fields-v1';

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
    collapsed: true,
    columnCollapse: { collapsed: true },
    hasConfigurator: true,
  };
}

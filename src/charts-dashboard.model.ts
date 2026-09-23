import type { ColumnRegular } from '@revolist/revogrid';
import type { PivotConfig, PivotConfigDimension } from '@revolist/pivot';
import { filterPivotSource } from '@revolist/pivot';
import { FINANCIAL_DIMENSIONS } from './financial.pivot';
import { SALES_TRANSACTIONS_V2, type SalesTransactionV2 } from './sales-transactions-v2';

export type DashboardYear = 2024 | 2025;
export type DashboardRows = 'Country' | 'Product';

const dimensionProps = new Set(['Country', 'Product', 'Segment', 'Year', 'Sales']);

export const CHARTS_DIMENSIONS: PivotConfigDimension[] = [
  ...FINANCIAL_DIMENSIONS
    .filter((dimension) => dimensionProps.has(String(dimension.prop)))
    .map((dimension) => dimension.prop === 'Sales'
      ? { ...dimension, columnType: 'currency' }
      : dimension),
  {
    prop: 'Quarter',
    fieldGroup: ['Dimensions', 'Date'],
    sortable: true,
    order: 'asc',
    filter: ['string', 'selection'],
    filterOptions: ['Q1', 'Q2', 'Q3', 'Q4'],
  },
];

export const CHARTS_COLUMNS: ColumnRegular[] = CHARTS_DIMENSIONS.map((dimension) => ({
  ...dimension,
  size: dimension.prop === 'Sales' ? 160 : 135,
}));

export function createChartsConfig(
  year: DashboardYear = 2025,
  rowField: DashboardRows = 'Country',
  segment?: string,
): PivotConfig {
  return {
    dimensions: CHARTS_DIMENSIONS,
    rows: [rowField],
    columns: ['Quarter'],
    values: [{ prop: 'Sales', aggregator: 'sum', label: 'Revenue (USD)' }],
    filters: ['Year', 'Segment'],
    filterSelections: {
      Year: [year],
      ...(segment ? { Segment: [segment] } : {}),
    },
    hasConfigurator: true,
    totals: { grandTotal: true, subtotals: false },
  };
}

export function dashboardRows(
  config: PivotConfig,
  source: SalesTransactionV2[] = SALES_TRANSACTIONS_V2,
): SalesTransactionV2[] {
  return filterPivotSource(source, config);
}

export function totalRevenue(rows: SalesTransactionV2[]): number {
  return rows.reduce((total, row) => total + row.Sales, 0);
}

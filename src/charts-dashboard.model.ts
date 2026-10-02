import type { ColumnRegular } from '@revolist/revogrid';
import type { PivotConfig, PivotConfigDimension } from '@revolist/pivot';
import { filterPivotSource } from '@revolist/pivot';
import { FINANCIAL_DIMENSIONS } from './financial.pivot';
import type { ContosoSale } from './contoso-data';

export type DashboardYear = 2024 | 2025;
export type DashboardRows = 'Country' | 'Category';

const dimensionProps = new Set(['Country', 'Category', 'Brand', 'Year', 'Revenue', 'Quarter']);

export const CHARTS_DIMENSIONS: PivotConfigDimension[] = [
  ...FINANCIAL_DIMENSIONS
    .filter((dimension) => dimensionProps.has(String(dimension.prop)))
    .map((dimension) => dimension.prop === 'Revenue'
      ? { ...dimension, columnType: 'currency' }
      : dimension.prop === 'Country'
        ? { ...dimension, size: 210 }
        : dimension),
];

export const CHARTS_COLUMNS: ColumnRegular[] = CHARTS_DIMENSIONS.map((dimension) => ({
  ...dimension,
  size: dimension.prop === 'Revenue' ? 160 : dimension.size ?? 135,
}));

export function createChartsConfig(
  year: DashboardYear = 2025,
  rowField: DashboardRows = 'Country',
  brand?: string,
): PivotConfig {
  return {
    dimensions: CHARTS_DIMENSIONS,
    rows: [rowField],
    columns: ['Quarter'],
    values: [{ prop: 'Revenue', aggregator: 'sum', label: 'Revenue (USD)' }],
    mergeValueHeaders: true,
    filters: ['Year', 'Country', 'Category', 'Brand'],
    filterSelections: {
      Year: [year],
      ...(brand ? { Brand: [brand] } : {}),
    },
    hasConfigurator: true,
    totals: { grandTotal: true, subtotals: false },
  };
}

export function dashboardRows(
  config: PivotConfig,
  source: ContosoSale[],
): ContosoSale[] {
  return filterPivotSource(source, config);
}

export function totalRevenue(rows: ContosoSale[]): number {
  return rows.reduce((total, row) => total + row.Revenue, 0);
}

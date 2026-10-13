/** Pure dashboard configuration and source reconciliation. The Vue dashboard owns events, chart mounting and cleanup. */
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

/** Single-choice controls must not pretend a Fields multi/exclusion selection is one member. */
export function dashboardFilterControl(
  config: PivotConfig,
  field: 'Year' | 'Brand',
  choices: readonly (string | number)[],
): { value: string; label: string } {
  const selection = config.filterSelections?.[field];
  const excluded = selection && !Array.isArray(selection);
  const values = Array.isArray(selection) ? selection : selection?.values ?? [];
  if (!values.length) return { value: '', label: field === 'Year' ? 'all years' : 'all brands' };
  const label = values.map(value => value === null ? '(blank)' : String(value)).join(', ');
  if (!excluded && values.length === 1 && choices.includes(values[0] as string | number)) {
    return { value: String(values[0]), label };
  }
  return { value: '__custom__', label: excluded ? `excluding ${label}` : label };
}

/** Change one quick filter while retaining the user's other Fields configuration. */
export function updateDashboardFilter(config: PivotConfig, field: 'Year' | 'Brand', value: string): PivotConfig {
  const filterSelections = { ...config.filterSelections };
  if (value) filterSelections[field] = [field === 'Year' ? Number(value) : value];
  else delete filterSelections[field];
  return { ...config, filterSelections,
    filters: [...new Set([...(config.filters ?? []), field])],
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

const COMPARISON_CATEGORY_HEIGHT = 32;
const COMPARISON_CHART_CHROME_HEIGHT = 220;
const MAX_EXPANDED_COMPARISON_CATEGORIES = 12;

/** Let the panel scroll ordinary reports; keep very large charts bounded and virtualized. */
export function comparisonChartHeight(categoryCount: number): number {
  return Math.max(300, Math.min(MAX_EXPANDED_COMPARISON_CATEGORIES, categoryCount)
    * COMPARISON_CATEGORY_HEIGHT + COMPARISON_CHART_CHROME_HEIGHT);
}

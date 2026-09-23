import type { ColumnRegular, DataType, GridPlugin } from '@revolist/revogrid';
import NumberColumnType from '@revolist/revogrid-column-numeral';
import {
  PivotChartsPlugin,
  PivotChartsUiPlugin,
  type PivotConfig,
  type PivotConfigDimension,
  clonePivotFilterSelectionMap,
  createPivotChartsRenderer,
  filterPivotSource,
  PivotPlugin,
  type PivotChartsConfig,
  type PivotChartsUiConfig,
} from '@revolist/pivot';
import {
  AdvanceFilterPlugin,
  ColumnCollapsePlugin,
  ContextMenuPlugin,
  FilterHeaderPlugin,
  MultiRowHeaderPlugin,
  RowOddPlugin,
  RowSelectPlugin,
  SameValueMergePlugin,
  commonAggregators,
  columnTypeRenderer,
} from '@revolist/revogrid-pro';
import { SALES_TRANSACTIONS_V2 } from './sales-transactions-v2';
import { createFinancialHeatmapColumnType } from './financial.heatmap';

export const FINANCIAL_COLUMN_TYPES = {
  currency: new NumberColumnType('$0,0'),
  number: new NumberColumnType('0,0.00'),
  integer: new NumberColumnType('0,0'),
  salesHeatmap: createFinancialHeatmapColumnType('Sales', 'currency'),
  profitHeatmap: createFinancialHeatmapColumnType('Profit', 'currency'),
  unitsHeatmap: createFinancialHeatmapColumnType('Units Sold', 'number'),
  grossSalesHeatmap: createFinancialHeatmapColumnType('Gross Sales', 'currency'),
  discountsHeatmap: createFinancialHeatmapColumnType('Discounts', 'currency'),
  cogsHeatmap: createFinancialHeatmapColumnType('COGS', 'currency'),
};

const percentile90 = (values: any[]) => {
  if (!values.length) return 0;
  const sorted = values.map(Number).sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.9) - 1] ?? 0;
};

const currencyAggregators = {
  sum: commonAggregators.sum,
  avg: commonAggregators.avg,
  min: commonAggregators.min,
  max: commonAggregators.max,
  p90: percentile90,
};

const numberAggregators = {
  sum: commonAggregators.sum,
  avg: commonAggregators.avg,
};

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthCompare: NonNullable<PivotConfigDimension['cellCompare']> = (_prop, a, b) =>
  MONTH_ORDER.indexOf(String(a.Month)) - MONTH_ORDER.indexOf(String(b.Month));

const FINANCIAL_DIMENSION_DEFINITIONS: PivotConfigDimension[] = [
  { prop: 'Country', fieldGroup: 'Dimensions', sortable: true, order: 'asc', merge: true, filter: ['string', 'selection'] },
  { prop: 'Segment', fieldGroup: 'Dimensions', sortable: true, order: 'asc', merge: true, filter: ['string', 'selection'] },
  { prop: 'Year', fieldGroup: ['Dimensions', 'Date'], sortable: true, order: 'asc', columnType: 'integer', filter: ['number', 'selection'] },
  { prop: 'Quarter', fieldGroup: ['Dimensions', 'Date'], sortable: true, order: 'asc', filter: ['string', 'selection'], filterOptions: ['Q1', 'Q2', 'Q3', 'Q4'] },
  {
    prop: 'Month',
    fieldGroup: ['Dimensions', 'Date'],
    sortable: true,
    order: 'asc',
    cellCompare: monthCompare,
    filter: ['string', 'selection'],
    filterOptions: [...MONTH_ORDER],
  },
  {
    prop: 'Product',
    fieldGroup: 'Dimensions',
    sortable: true,
    filter: ['string', 'selection'],
    filterOptions: ['Apex Suite', 'Beacon Pro', 'Cobalt Cloud', 'Delta One', 'Evergreen'],
  },
  {
    prop: 'Discount Band',
    fieldGroup: 'Dimensions',
    sortable: true,
    filter: ['string', 'selection'],
    filterOptions: ['None', 'Low', 'Medium', 'High'],
  },
  {
    prop: 'Units Sold',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'unitsHeatmap',
    filter: ['number'],
    aggregators: numberAggregators,
  },
  {
    prop: 'Sales',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'currency',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  {
    prop: 'Profit',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'profitHeatmap',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  {
    prop: 'Gross Sales',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'grossSalesHeatmap',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  {
    prop: 'Discounts',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'discountsHeatmap',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  {
    prop: 'COGS',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'cogsHeatmap',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  { prop: 'Date', fieldGroup: 'Dimensions', sortable: true, filter: ['string'] },
];

export const FINANCIAL_DIMENSIONS: PivotConfigDimension[] = FINANCIAL_DIMENSION_DEFINITIONS
  .map((dimension) => ({
    columnTemplate: columnTypeRenderer,
    ...dimension,
  }));

export const FINANCIAL_COLUMNS: ColumnRegular[] = FINANCIAL_DIMENSIONS.map((dimension) => ({
  ...dimension,
  size: dimension.size ?? 150,
}));

export const FINANCIAL_SHOWCASE_PLUGINS: GridPlugin[] = [
  RowSelectPlugin,
  SameValueMergePlugin,
  ContextMenuPlugin,
  PivotPlugin,
  PivotChartsPlugin,
  PivotChartsUiPlugin,
  ColumnCollapsePlugin,
  MultiRowHeaderPlugin,
  AdvanceFilterPlugin,
  FilterHeaderPlugin,
  RowOddPlugin,
] as GridPlugin[];

export const FINANCIAL_PIVOT_CHARTS: PivotChartsConfig = {
  renderer: createPivotChartsRenderer(),
  defaultChartType: 'groupedColumn',
  limits: {
    maxSeries: 120,
    maxDataPoints: 2_500,
  },
};

export const FINANCIAL_PIVOT_CHARTS_UI: PivotChartsUiConfig = {
  contextMenu: true,
};

export const FINANCIAL_MULTI_ROW_HEADER = {
  // Pivot row-axis headers contain sorting and filtering controls and should
  // retain their normal leaf-header geometry. Collapsed column groups opt in
  // to downward spanning independently through spanHeaderHeight.
  spanLeafHeaders: false,
} as const;

const SALES_OVERVIEW: PivotConfig = {
  dimensions: FINANCIAL_DIMENSIONS,
  rows: ['Country'],
  columns: ['Quarter'],
  values: [{ prop: 'Sales', aggregator: 'sum' }],
  filters: ['Year', 'Product', 'Discount Band'],
  filterSelections: { Year: [2025] },
  hasConfigurator: true,
  flatHeaders: false,
  collapsed: false,
  groupAggregations: true,
  columnCollapse: {
    enabled: false,
    collapsed: false,
    aggregator: {
      Sales: 'sum',
      Profit: 'sum',
      'Units Sold': 'sum',
    },
    placeholder: 'Period Total',
  },
  columnLevels: {},
  totals: {
    subtotals: false,
    grandTotal: true,
    grandTotalLabel: 'Grand Total',
  },
};

const PROFITABILITY: PivotConfig = {
  ...SALES_OVERVIEW,
  rows: ['Segment', 'Country'],
  columns: ['Year', 'Month'],
  values: [
    { prop: 'Profit', aggregator: 'sum' },
    { prop: 'Sales', aggregator: 'sum' },
    { prop: 'COGS', aggregator: 'sum' },
  ],
  filters: ['Year', 'Product', 'Discount Band'],
  filterSelections: { Year: [2025] },
  columnCollapse: {
    enabled: true,
    collapsed: true,
    aggregator: { Profit: 'sum', Sales: 'sum', COGS: 'sum' },
    placeholder: 'Period Total',
  },
};

const PRODUCT_PERFORMANCE: PivotConfig = {
  ...SALES_OVERVIEW,
  rows: ['Product', 'Segment'],
  columns: ['Year', 'Country'],
  values: [
    { prop: 'Gross Sales', aggregator: 'sum' },
    { prop: 'Units Sold', aggregator: 'sum' },
    { prop: 'Discounts', aggregator: 'sum' },
  ],
  filters: ['Year', 'Month', 'Discount Band'],
  filterSelections: { Year: [2025] },
  columnCollapse: {
    enabled: true,
    collapsed: true,
    aggregator: { 'Gross Sales': 'sum', 'Units Sold': 'sum', Discounts: 'sum' },
    placeholder: 'Market Total',
  },
};

const ANALYSIS_BASE: PivotConfig = {
  ...SALES_OVERVIEW,
  rows: ['Segment'],
  columns: ['Year'],
  filters: ['Country', 'Product', 'Discount Band'],
  filterSelections: {},
  columnCollapse: { enabled: false },
};

const PROFIT_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  values: [
    { id: 'profit', prop: 'Profit', aggregator: 'sum', label: 'Profit' },
    { id: 'sales', prop: 'Sales', aggregator: 'sum', label: 'Sales' },
  ],
};

const CONTRIBUTION_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  columns: [],
  values: [
    { id: 'profit-contribution', prop: 'Profit', aggregator: 'sum', label: 'Share of total profit',
      calculation: { type: 'percentOfGrandTotal' }, format: { preset: 'percent' } },
    { id: 'profit', prop: 'Profit', aggregator: 'sum', label: 'Profit' },
  ],
};

const RUNNING_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  rows: ['Country'],
  columns: ['Month'],
  filters: ['Year', 'Product'],
  filterSelections: { Year: [2025] },
  values: [{ id: 'cumulative-sales', prop: 'Sales', aggregator: 'sum', label: 'Sales year to date',
    calculation: { type: 'runningTotal', axis: 'columns', field: 'Month' } }],
};

const YEAR_OVER_YEAR_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  rows: ['Product'],
  columns: ['Year'],
  values: [
    { id: 'sales', prop: 'Sales', aggregator: 'sum', label: 'Sales' },
    { id: 'sales-yoy', prop: 'Sales', aggregator: 'sum', label: 'Year-over-year change',
      calculation: { type: 'percentDifferenceFrom', axis: 'columns', field: 'Year', base: 'previous' },
      format: { preset: 'percent' } },
  ],
};

const RANKING_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  rows: ['Product'],
  columns: [],
  filters: ['Year', 'Country'],
  filterSelections: { Year: [2025] },
  values: [
    { id: 'profit', prop: 'Profit', aggregator: 'sum', label: 'Profit' },
    { id: 'profit-rank', prop: 'Profit', aggregator: 'sum', label: 'Profit rank',
      calculation: { type: 'rank', axis: 'rows', field: 'Product', order: 'desc' } },
  ],
};

export type FinancialPresetId = 'sales' | 'profitability' | 'product'
  | 'profit' | 'contribution' | 'running' | 'yoy' | 'ranking';

export const FINANCIAL_ANALYSIS_PRESET_IDS: FinancialPresetId[] = [
  'profit', 'contribution', 'running', 'yoy', 'ranking',
];

export interface FinancialPreset {
  id: FinancialPresetId;
  label: string;
  description: string;
}

export const FINANCIAL_PRESETS: FinancialPreset[] = [
  {
    id: 'sales',
    label: 'Sales Overview',
    description: 'How did sales compare across countries and quarters in 2025?',
  },
  {
    id: 'profitability',
    label: 'Profitability',
    description: 'See which segments convert revenue into profit most effectively.',
  },
  {
    id: 'product',
    label: 'Product Performance',
    description: 'Understand which products drive volume, gross sales, and discounts.',
  },
  { id: 'profit', label: 'Profit', description: 'Which segments make or lose money in each year?' },
  { id: 'contribution', label: 'Contribution', description: 'What share of total profit comes from each segment? Negative profit can produce negative shares.' },
  { id: 'running', label: 'Running total', description: 'How did 2025 sales accumulate month by month in each country?' },
  { id: 'yoy', label: 'Year over year', description: 'Which products grew or declined from 2024 to 2025? The first year has no prior comparison.' },
  { id: 'ranking', label: 'Ranking', description: 'Which products rank highest by 2025 profit?' },
];

const PRESET_CONFIGS: Record<FinancialPresetId, PivotConfig> = {
  sales: SALES_OVERVIEW,
  profitability: PROFITABILITY,
  product: PRODUCT_PERFORMANCE,
  profit: PROFIT_ANALYSIS,
  contribution: CONTRIBUTION_ANALYSIS,
  running: RUNNING_ANALYSIS,
  yoy: YEAR_OVER_YEAR_ANALYSIS,
  ranking: RANKING_ANALYSIS,
};

export function createFinancialPreset(id: FinancialPresetId = 'sales'): PivotConfig {
  const config = PRESET_CONFIGS[id];
  return {
    ...config,
    dimensions: config.dimensions?.map((dimension) => ({ ...dimension })),
    rows: [...config.rows],
    columns: [...(config.columns || [])],
    values: config.values.map((value) => ({
      ...value,
      calculation: value.calculation ? structuredClone(value.calculation) : undefined,
      format: value.format ? { ...value.format } : undefined,
    })),
    filters: [...(config.filters || [])],
    filterSelections: clonePivotFilterSelectionMap(config.filterSelections || {}),
    columnLevels: config.columnLevels
      ? Object.fromEntries(
          Object.entries(config.columnLevels).map(([level, settings]) => [
            level,
            settings ? { ...settings } : settings,
          ]),
        )
      : undefined,
    totals: config.totals ? { ...config.totals } : undefined,
    columnCollapse: typeof config.columnCollapse === 'object'
      ? {
          ...config.columnCollapse,
          aggregator:
            typeof config.columnCollapse.aggregator === 'object'
              ? { ...config.columnCollapse.aggregator }
              : config.columnCollapse.aggregator,
        }
      : config.columnCollapse,
  };
}

export const FINANCIAL_SHOWCASE_PIVOT = createFinancialPreset();

export function resolveFinancialRows(rows?: DataType[]): DataType[] {
  return rows?.length ? rows : SALES_TRANSACTIONS_V2;
}

export function applyFinancialPivotOptions(
  config: PivotConfig | null,
  data: DataType[],
  configuratorVisible = true,
): PivotConfig | undefined {
  if (!config) return undefined;

  const rows = config.rows || [];
  const nextConfig: PivotConfig = {
    ...config,
    rows,
    hasConfigurator: configuratorVisible,
  };

  if (typeof nextConfig.expanded === 'undefined') {
    nextConfig.expanded = getInitialExpandedGroups(filterPivotSource(data, nextConfig), rows);
  }

  return nextConfig;
}

function getInitialExpandedGroups(data: DataType[], rows: Array<string | number>) {
  const expanded: Record<string, boolean> = {};
  const groupingDepth = Math.max(0, rows.length - 1);

  data.forEach((row) => {
    const path: unknown[] = [];
    for (let index = 0; index < groupingDepth; index += 1) {
      path.push(row[rows[index]] ?? null);
      expanded[path.join(',')] = true;
    }
  });

  return expanded;
}

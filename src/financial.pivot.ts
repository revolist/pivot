/** Shared report model for Main and Financial: dimensions, presets, plugin options and column sizing. Framework files only wire UI state and lifecycle. */
import type { ColumnRegular, DataType, GridPlugin } from '@revolist/revogrid';
import NumberColumnType from '@revolist/revogrid-column-numeral';
import * as ProPlugins from '@revolist/revogrid-pro';
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
  FilterHeaderPlugin,
  ContextMenuPlugin,
  RowOddPlugin,
  RowSelectPlugin,
  SameValueMergePlugin,
  commonAggregators,
  columnTypeRenderer,
} from '@revolist/revogrid-pro';
import { createFinancialHeatmapColumnType } from './financial.heatmap';

export const FINANCIAL_COLUMN_TYPES = {
  currency: new NumberColumnType('$0,0.00'),
  number: new NumberColumnType('0,0'),
  integer: new NumberColumnType('0,0'),
  salesHeatmap: createFinancialHeatmapColumnType('Revenue', 'currency'),
  profitHeatmap: createFinancialHeatmapColumnType('Gross Profit', 'currency'),
  unitsHeatmap: createFinancialHeatmapColumnType('Quantity', 'number'),
  costHeatmap: createFinancialHeatmapColumnType('Cost', 'currency'),
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
  { prop: 'Country', description: 'Customer country', fieldGroup: 'Dimensions', sortable: true, order: 'asc', merge: true, filter: ['string', 'selection'] },
  { prop: 'Store Country', description: 'Store country, separate from customer country', fieldGroup: 'Dimensions', sortable: true, order: 'asc', merge: true, filter: ['string', 'selection'] },
  { prop: 'Store', fieldGroup: 'Dimensions', sortable: true, filter: ['string', 'selection'] },
  { prop: 'Category', fieldGroup: 'Dimensions', sortable: true, order: 'asc', filter: ['string', 'selection'], size: 275 },
  { prop: 'Subcategory', fieldGroup: 'Dimensions', sortable: true, order: 'asc', filter: ['string', 'selection'] },
  { prop: 'Brand', fieldGroup: 'Dimensions', sortable: true, order: 'asc', filter: ['string', 'selection'] },
  { prop: 'Year', fieldGroup: ['Dimensions', 'Date'], sortable: true, order: 'asc', columnType: 'integer', filter: ['number', 'selection'] },
  { prop: 'Quarter', fieldGroup: ['Dimensions', 'Date'], sortable: true, order: 'asc', filter: ['string', 'selection'], filterOptions: ['Q1', 'Q2', 'Q3', 'Q4'] },
  { prop: 'Month Number', fieldGroup: ['Dimensions', 'Date'], sortable: true, order: 'asc', columnType: 'integer' },
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
    // Keep product names recognizable while leaving room for a value on mobile.
    size: 275,
    fieldGroup: 'Dimensions',
    sortable: true,
    filter: ['string', 'selection'],
  },
  {
    prop: 'Quantity',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'unitsHeatmap',
    filter: ['number'],
    aggregators: numberAggregators,
  },
  {
    prop: 'Revenue',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'currency',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  {
    prop: 'Gross Profit',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'profitHeatmap',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  {
    prop: 'Cost',
    fieldGroup: 'Data',
    sortable: true,
    columnType: 'costHeatmap',
    filter: ['number'],
    aggregators: currencyAggregators,
  },
  { prop: 'Date', fieldGroup: 'Dimensions', sortable: true, filter: ['string'] },
  { prop: 'Order ID', fieldGroup: 'Dimensions', sortable: true, filter: ['string'] },
  { prop: 'Line ID', fieldGroup: 'Dimensions', sortable: true, filter: ['string'] },
  { prop: 'Order Currency', fieldGroup: 'Dimensions', sortable: true, filter: ['string', 'selection'] },
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

/** Developer opt-in for inline Pivot header inputs; report filters remain available when off. */
export const FINANCIAL_HEADER_FILTERS_ENABLED = false;

// The public trial 2.9.5 omits this optional enhancement. Namespace lookup keeps
// standalone builds compatible while enabling it when the installed API has it.
const summaryPanelPlugin = Reflect.get(ProPlugins, 'PivotSummaryPanelPlugin') as GridPlugin | undefined;

export function createFinancialShowcasePlugins(
  headerFiltersEnabled = FINANCIAL_HEADER_FILTERS_ENABLED,
  summaryPanelEnabled = true,
): GridPlugin[] {
  return [
    RowSelectPlugin,
    SameValueMergePlugin,
    ContextMenuPlugin,
    PivotPlugin,
    ...(summaryPanelEnabled && typeof summaryPanelPlugin === 'function' ? [summaryPanelPlugin] : []),
    PivotChartsPlugin,
    PivotChartsUiPlugin,
    AdvanceFilterPlugin,
    ...(headerFiltersEnabled ? [FilterHeaderPlugin] : []),
    RowOddPlugin,
  ] as GridPlugin[];
}

export const FINANCIAL_SHOWCASE_PLUGINS = createFinancialShowcasePlugins();

export const FINANCIAL_PIVOT_CHARTS: PivotChartsConfig = {
  renderer: createPivotChartsRenderer(),
  defaultChartType: 'groupedColumn',
  limits: {
    maxSeries: 120,
    maxDataPoints: 50_000,
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
  rows: ['Country', 'Category'],
  columns: ['Quarter', 'Month'],
  values: [{ prop: 'Revenue', aggregator: 'sum', label: 'Revenue (USD)' }],
  filters: ['Year', 'Country', 'Category', 'Brand'],
  filterSelections: { Year: [2025] },
  hasConfigurator: true,
  contextMenu: { drillThrough: { columns: [
    'Order ID', 'Line ID', 'Date', 'Country', 'Store Country',
    'Category', 'Subcategory', 'Product', 'Brand', 'Quantity',
    'Revenue', 'Cost', 'Gross Profit',
  ] } },
  flatHeaders: false,
  collapsed: false,
  groupAggregations: true,
  columnCollapse: {
    enabled: true,
    // Reveal one hierarchy level at a time when fields are added or reordered.
    collapsed: true,
    aggregator: {
      Revenue: 'sum',
      'Gross Profit': 'sum',
      Quantity: 'sum',
    },
    placeholder: 'Quarter Total',
  },
  columnLevels: { 0: { collapsible: true, collapsed: true, filterable: false, sortable: false } },
  totals: {
    subtotals: false,
    grandTotal: true,
    grandTotalLabel: 'Grand Total',
  },
};

const PROFITABILITY: PivotConfig = {
  ...SALES_OVERVIEW,
  rows: ['Category', 'Subcategory'],
  columns: ['Year', 'Quarter'],
  values: [
    { prop: 'Revenue', aggregator: 'sum', label: 'Revenue (USD)' },
    { prop: 'Cost', aggregator: 'sum', label: 'Cost (USD)' },
    { prop: 'Gross Profit', aggregator: 'sum', label: 'Gross Profit (USD)' },
  ],
  valuesOnRows: true,
  filters: ['Year', 'Country', 'Category', 'Brand'],
  filterSelections: { Year: [2025] },
  columnCollapse: {
    enabled: true,
    collapsed: true,
    aggregator: { Revenue: 'sum', Cost: 'sum', 'Gross Profit': 'sum' },
    placeholder: 'Period Total',
  },
};

const PRODUCT_PERFORMANCE: PivotConfig = {
  ...SALES_OVERVIEW,
  rows: ['Category', 'Subcategory', 'Product'],
  columns: ['Year', 'Quarter'],
  values: [
    { prop: 'Revenue', aggregator: 'sum', label: 'Revenue (USD)' },
    { prop: 'Quantity', aggregator: 'sum', label: 'Quantity' },
  ],
  filters: ['Year', 'Country', 'Category', 'Brand'],
  filterSelections: { Year: [2025] },
  collapsed: true,
  expanded: {},
  columnCollapse: {
    enabled: true,
    collapsed: true,
    aggregator: { Revenue: 'sum', Quantity: 'sum' },
    placeholder: 'Market Total',
  },
};

const ANALYSIS_BASE: PivotConfig = {
  ...SALES_OVERVIEW,
  rows: ['Category'],
  columns: ['Year'],
  filters: ['Year', 'Country', 'Category', 'Brand'],
  filterSelections: { Year: [2024, 2025] },
};

const PROFIT_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  values: [
    { id: 'profit', prop: 'Gross Profit', aggregator: 'sum', label: 'Gross Profit' },
    { id: 'sales', prop: 'Revenue', aggregator: 'sum', label: 'Revenue' },
  ],
};

const CONTRIBUTION_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  columns: [],
  values: [
    { id: 'profit-contribution', prop: 'Gross Profit', aggregator: 'sum', label: 'Profit share',
      calculation: { type: 'percentOfGrandTotal' }, format: { preset: 'percent' } },
    { id: 'profit', prop: 'Gross Profit', aggregator: 'sum', label: 'Gross Profit' },
  ],
};

const RUNNING_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  rows: ['Country'],
  columns: ['Month'],
  filters: ['Year', 'Product'],
  filterSelections: { Year: [2025] },
  values: [{ id: 'cumulative-sales', prop: 'Revenue', aggregator: 'sum', label: 'Revenue YTD',
    calculation: { type: 'runningTotal', axis: 'columns', field: 'Month' } }],
};

const YEAR_OVER_YEAR_ANALYSIS: PivotConfig = {
  ...ANALYSIS_BASE,
  rows: ['Product'],
  columns: ['Year'],
  // A collapsed year has two distinct measures but no meaningful single
  // carrier value. Keep both measures visible for the comparison report.
  columnLevels: { 0: { collapsible: false, collapsed: false, filterable: false, sortable: false } },
  values: [
    { id: 'sales', prop: 'Revenue', aggregator: 'sum', label: 'Revenue' },
    { id: 'sales-yoy', prop: 'Revenue', aggregator: 'sum', label: 'YoY change',
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
    { id: 'profit', prop: 'Gross Profit', aggregator: 'sum', label: 'Gross Profit' },
    { id: 'profit-rank', prop: 'Gross Profit', aggregator: 'sum', label: 'Profit rank',
      calculation: { type: 'rank', axis: 'rows', field: 'Product', order: 'desc' },
      // Rank is a position, not the currency of its source profit measure.
      format: { preset: 'number', options: { maximumFractionDigits: 0 } } },
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
    description: 'Revenue by customer country and category, across quarters · USD',
  },
  {
    id: 'profitability',
    label: 'Profitability',
    description: 'Compare revenue, cost and gross profit by product category and quarter.',
  },
  {
    id: 'product',
    label: 'Product Performance',
    description: 'Explore product revenue and quantity within categories and subcategories.',
  },
  { id: 'profit', label: 'Profit', description: 'How does gross profit vary across categories and years? Expand a year to compare its revenue.' },
  { id: 'contribution', label: 'Contribution', description: 'What share of total profit comes from each category?' },
  { id: 'running', label: 'Running total', description: 'How did 2025 revenue accumulate month by month in each country?' },
  { id: 'yoy', label: 'Year over year', description: 'Which products grew or declined between years? The first year has no prior comparison.' },
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

/** Semantic measure formats are shared by the grid and printable report. */
function financialMeasureFormat(value: PivotConfig['values'][number]): PivotConfig['values'][number]['format'] {
  if (value.format) return { ...value.format };
  if (['Revenue', 'Cost', 'Gross Profit'].includes(String(value.prop))) {
    return { preset: 'currency', currency: 'USD', locale: 'en-US' };
  }
  if (value.prop === 'Quantity') {
    return { preset: 'number', locale: 'en-US', options: { maximumFractionDigits: 0 } };
  }
  return undefined;
}

export function createFinancialPreset(id: FinancialPresetId = 'sales'): PivotConfig {
  const config = PRESET_CONFIGS[id];
  return {
    ...config,
    dimensions: config.dimensions?.map((dimension) => ({
      ...dimension,
      // The default quarter headers use the field panel for filtering. Avoid
      // an unusable filter input on the generated Grand Total column.
      ...(id === 'sales' && dimension.prop === 'Revenue' ? { filter: false } : {}),
    })),
    rows: [...config.rows],
    columns: [...(config.columns || [])],
    values: config.values.map((value) => ({
      ...value,
      calculation: value.calculation ? structuredClone(value.calculation) : undefined,
      // CSV/XLSX exports retain the original aggregate precision.
      format: financialMeasureFormat(value),
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

/** Fit Sales Overview while reserving its row-label width in other compact reports. */
export function financialPivotColumnSize(host: HTMLElement, config: PivotConfig): number {
  const defaultSalesLayout = config.rows.join('|') === 'Country|Category'
    && config.columns?.join('|') === 'Quarter|Month'
    && config.values.length === 1
    && config.values[0]?.prop === 'Revenue';
  if (defaultSalesLayout) {
    return Math.max(130, Math.min(260, Math.floor((host.clientWidth - 275 - 2) / 5)));
  }
  return config.rows.length > 1 ? 275 : 128;
}

export function fitFinancialPivotColumns(grid: HTMLRevoGridElement, host: HTMLElement, config: PivotConfig): void {
  grid.colSize = financialPivotColumnSize(host, config);
}

export function resolveFinancialRows(rows?: DataType[]): DataType[] {
  return rows ?? [];
}

export function applyFinancialPivotOptions(
  config: PivotConfig | null,
  data: DataType[],
  configuratorVisible = false,
  configuratorMount?: HTMLElement,
  hostWidth = Infinity,
): PivotConfig | undefined {
  if (!config) return undefined;

  const rows = config.rows || [];
  const valueProps = new Set(config.values.map((value) => value.prop));
  const nextConfig: PivotConfig = {
    ...config,
    rows,
    // Generated measure columns inherit dimension filters. Keep their filters
    // out of the headers, including Grand Total, as fields are rearranged.
    dimensions: config.dimensions?.map((dimension) => ({
      ...dimension,
      // A pinned label must leave room for an entire amount on narrow hosts.
      ...(hostWidth > 0 && hostWidth < 650 && rows.includes(dimension.prop)
        ? { size: Math.min(dimension.size ?? 180, 180, Math.floor(hostWidth / 2)) }
        : {}),
      ...(valueProps.has(dimension.prop) ? { filter: false } : {}),
    })),
    mergeValueHeaders: config.values.length === 1,
    hasConfigurator: configuratorVisible,
    mountTo: configuratorVisible ? configuratorMount : undefined,
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

/** Ticket report configuration only. Source preparation and cell-to-ticket matching live in tickets.ts, UI in OperationsPivot.vue. */
import type { ColumnRegular, GridPlugin } from '@revolist/revogrid';
import { PivotPlugin, type PivotConfig, type PivotConfigDimension } from '@revolist/pivot';
import { commonAggregators } from '@revolist/revogrid-pro';
import { averageResolvedHours } from './tickets';

// A custom key preserves null inputs; Pivot's built-in "avg" coerces null to 0.
const measures = { sum: commonAggregators.sum, resolvedAverage: (values: unknown[]) => averageResolvedHours(values as Array<number | null>) };

export const dimensions: PivotConfigDimension[] = [
  { prop: 'Team', size: 140, sortable: true, filter: ['string', 'selection'] },
  { prop: 'Priority', sortable: true, filter: ['string', 'selection'] },
  { prop: 'Category', sortable: true, filter: ['string', 'selection'] },
  { prop: 'SLA Status', sortable: true, filter: ['string', 'selection'] },
  { prop: 'Ticket Count', size: 170, aggregators: { sum: measures.sum } },
  { prop: 'Resolution Hours', size: 160, aggregators: { resolvedAverage: measures.resolvedAverage } },
  { prop: 'SLA Breach Count', size: 160, aggregators: { sum: measures.sum } },
];

export const columns: ColumnRegular[] = dimensions.map(dimension => ({ ...dimension, size: 160 }));
export const plugins: GridPlugin[] = [PivotPlugin] as GridPlugin[];

export const pivotConfig: PivotConfig = {
  dimensions,
  rows: ['Team'],
  columns: ['Priority'],
  values: [
    { prop: 'Ticket Count', aggregator: 'sum' },
    { prop: 'Resolution Hours', aggregator: 'resolvedAverage', label: 'Resolution Hours', format: { preset: 'number', locale: 'en-US', options: { maximumFractionDigits: 2 } } },
    { prop: 'SLA Breach Count', aggregator: 'sum' },
  ],
  filters: ['Category', 'SLA Status'],
  hasConfigurator: false,
  totals: { subtotals: true, grandTotal: true, grandTotalLabel: 'All tickets' },
};

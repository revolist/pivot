import type { PivotConfig } from '@revolist/pivot';
import { FINANCIAL_DIMENSIONS } from '../src/financial.pivot';

const fields = new Set(['Country', 'Segment', 'Year', 'Sales']);

export const basicPivotRecipe: PivotConfig = {
  dimensions: FINANCIAL_DIMENSIONS.filter((dimension) => fields.has(String(dimension.prop))),
  rows: ['Country', 'Segment'],
  columns: ['Year'],
  values: [{ prop: 'Sales', aggregator: 'sum' }],
  totals: { subtotals: true, grandTotal: true },
};

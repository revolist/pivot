import type { ColumnType, PropertiesFunc } from '@revolist/revogrid';
import { mergeCellProperties } from '@revolist/revogrid-pro';

export type FinancialHeatmapField =
  | 'Quantity'
  | 'Revenue'
  | 'Gross Profit'
  | 'Cost';

interface FinancialHeatmapScale {
  sum: number;
  point: number;
  positive: readonly [number, number, number];
}

const FINANCIAL_HEATMAP_SCALES: Record<FinancialHeatmapField, FinancialHeatmapScale> = {
  Quantity: { sum: 12_500, point: 500, positive: [37, 99, 235] },
  Revenue: { sum: 4_400_000, point: 100_000, positive: [15, 255, 55] },
  'Gross Profit': { sum: 2_500_000, point: 60_000, positive: [22, 163, 74] },
  Cost: { sum: 2_000_000, point: 50_000, positive: [124, 58, 237] },
};

const NEGATIVE_RGB = [220, 38, 38] as const;

export function createFinancialHeatmapCellProperties(
  field: FinancialHeatmapField,
): PropertiesFunc {
  const scale = FINANCIAL_HEATMAP_SCALES[field];

  return ({ value, column }) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }

    const isSum = column?.aggregator === 'sum'
      || /\(sum\)\s*$/i.test(String(column?.name ?? ''));
    const maximum = isSum ? scale.sum : scale.point;
    const intensity = Math.min(1, Math.sqrt(Math.abs(numeric) / maximum));
    const alpha = 0.045 + intensity * 0.205;
    const [red, green, blue] = numeric < 0 ? NEGATIVE_RGB : scale.positive;

    return {
      class: 'financial-pivot-heatmap',
      style: {
        backgroundColor: `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`,
      },
      'data-tooltip': `${field} heatmap intensity: ${Math.round(intensity * 100)}%`,
    };
  };
}

const financialCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const financialNumber = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function createFinancialHeatmapColumnType(
  field: FinancialHeatmapField,
  format: 'currency' | 'number',
): ColumnType {
  const cellProperties = createFinancialHeatmapCellProperties(field);
  const formatter = format === 'currency' ? financialCurrency : financialNumber;

  return {
    cellProperties: mergeCellProperties(
      () => ({ class: { 'align-right': true } }),
      cellProperties,
    ),
    cellTemplate: (_h, params) => {
      return typeof params.value === 'number' && Number.isFinite(params.value)
        ? formatter.format(params.value)
        : String(params.value ?? '');
    },
  };
}

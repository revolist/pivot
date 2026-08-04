import { createFinancialPreset } from '../src/financial.pivot';

export function createFieldsFiltersTotalsRecipe() {
  const config = createFinancialPreset('sales');
  return {
    ...config,
    hasConfigurator: true,
    filters: ['Product', 'Discount Band'],
    filterSelections: { 'Discount Band': ['High'] },
    totals: { subtotals: true, grandTotal: true, grandTotalLabel: 'Grand Total' },
  };
}


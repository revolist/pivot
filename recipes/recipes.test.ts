import { describe, expect, it } from 'vitest';
import { basicPivotRecipe } from './basic-pivot';
import { createFieldsFiltersTotalsRecipe } from './fields-filters-totals';
import { chartsAndFormattingRecipe } from './charts-formatting';

describe('Pivot recipes', () => {
  it('provides a minimal analytical model', () => {
    expect(basicPivotRecipe.rows).toEqual(['Country', 'Segment']);
    expect(basicPivotRecipe.values).toEqual([{ prop: 'Sales', aggregator: 'sum' }]);
  });

  it('keeps configurator, filters, and totals together', () => {
    const recipe = createFieldsFiltersTotalsRecipe();
    expect(recipe.hasConfigurator).toBe(true);
    expect(recipe.filters).toContain('Product');
    expect(recipe.totals?.grandTotal).toBe(true);
  });

  it('ships chart and heatmap integration as one recipe', () => {
    expect(chartsAndFormattingRecipe.columnTypes.salesHeatmap).toBeTruthy();
    expect(chartsAndFormattingRecipe.additionalData.pivotCharts.renderer).toBeTruthy();
  });
});


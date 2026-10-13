import { afterEach, describe, expect, it, vi } from 'vitest';
import { FINANCIAL_PRESETS, applyFinancialPivotOptions, createFinancialPreset } from '../../src/financial.pivot';
import { persistPivotState, restorePivotConfig } from '../../src/financial.analytics';

describe('financial preset subtotal targets', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(FINANCIAL_PRESETS)('$label excludes subtotals only for its row fields', ({ id }) => {
    const config = createFinancialPreset(id);
    expect(new Set(config.totals?.disabledSubtotals?.rows?.fields)).toEqual(new Set(config.rows));
    const measures = new Set(config.values.map(value => value.prop));
    for (const level of Object.values(config.columnLevels ?? {})) {
      expect(level?.subtotalValues?.every(field => measures.has(field)) ?? true).toBe(true);
    }
  });

  it('restores stale subtotal rules without discarding saved report choices', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const config = createFinancialPreset('product');
    config.values = [{ prop: 'Profit', aggregator: 'avg' }];
    config.columnLevels = { 0: { subtotal: true, subtotalValues: ['Sales', 'Profit'] } };
    config.totals = {
      ...config.totals,
      disabledSubtotals: {
        rows: { fields: ['Country', 'Segment'], levels: [0, 8] },
        columns: { fields: ['Year', 'Month'], levels: [1, 4] },
      },
    };
    persistPivotState(config, 'product');
    expect(storage.has('revogrid:pivot-showcase:v1')).toBe(true);
    const restored = restorePivotConfig('product');
    expect(restored.rows).toEqual(config.rows);
    expect(restored.values).toEqual(config.values);
    expect(restored.columnLevels?.[0]?.subtotalValues).toEqual(['Profit']);
    expect(restored.totals?.disabledSubtotals).toEqual({
      rows: { fields: ['Segment'], levels: [0] },
      columns: { fields: ['Year'], levels: [1] },
    });
    expect(config.totals.disabledSubtotals?.rows?.fields).toEqual(['Country', 'Segment']);
  });

  it.each([false, true])('applies field visibility %s to a stale live preset', visible => {
    const config = createFinancialPreset('sales');
    config.rows = ['Product', 'Segment'];
    config.values = [{ prop: 'Gross Sales', aggregator: 'sum' }];
    const applied = applyFinancialPivotOptions(config, [], visible)!;
    expect(applied.hasConfigurator).toBe(visible);
    expect(applied.totals?.disabledSubtotals?.rows?.fields).toEqual(['Segment']);
    expect(applied.columnLevels?.[0]?.subtotalValues).toEqual([]);
    expect(config.totals?.disabledSubtotals?.rows?.fields).toEqual(['Country', 'Segment']);
  });
});

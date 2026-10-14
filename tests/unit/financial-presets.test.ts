import { afterEach, describe, expect, it, vi } from 'vitest';
import { FINANCIAL_PRESETS, applyFinancialPivotOptions, createFinancialPreset } from '../../src/financial.pivot';
import { exportPivotReportJson, importPivotReportJson, loadNamedPivotReport, loadSavedPivotReport, persistPivotState, restorePivotConfig, saveNamedPivotReport } from '../../src/financial.analytics';

describe('financial preset subtotal targets', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(FINANCIAL_PRESETS)('$label excludes subtotals only for its row fields', ({ id }) => {
    const config = createFinancialPreset(id);
    expect(config.totals?.subtotals).toBe(false);
    expect(config.totals?.disabledSubtotals?.rows?.fields?.every(field => config.rows.includes(field)) ?? true).toBe(true);
    const measures = new Set(config.values.map(value => value.prop));
    for (const level of Object.values(config.columnLevels ?? {})) {
      expect(level?.subtotalValues?.every(field => measures.has(field)) ?? true).toBe(true);
    }
  });

  it.each(['saved', 'named', 'json'] as const)('restores stale subtotal rules from %s without discarding saved report choices', kind => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const config = createFinancialPreset('product');
    config.values = [{ prop: 'Gross Profit', aggregator: 'avg' }];
    config.columnLevels = { 0: { subtotal: true, subtotalValues: ['Revenue', 'Gross Profit'] } };
    config.totals = {
      ...config.totals,
      disabledSubtotals: {
        rows: { fields: ['Country', 'Category'], levels: [0, 8] },
        columns: { fields: ['Year', 'Month'], levels: [1, 4] },
      },
    };
    const report = kind === 'saved'
      ? (persistPivotState(config, 'product'), loadSavedPivotReport())
      : kind === 'named'
        ? (saveNamedPivotReport('Subtotal report', config, 'product'), loadNamedPivotReport('Subtotal report'))
        : importPivotReportJson(exportPivotReportJson(config, 'product'));
    expect(report?.preset).toBe('product');
    const restored = report!.config;
    // Saving a report must not replace the default report on the next visit.
    expect(restorePivotConfig('sales').rows).toEqual(['Country', 'Category']);
    expect(restored.rows).toEqual(config.rows);
    expect(restored.values).toEqual(config.values);
    expect(restored.columnLevels?.[0]?.subtotalValues).toEqual(['Gross Profit']);
    expect(restored.totals?.disabledSubtotals).toEqual({
      rows: { fields: ['Category'], levels: [0] },
      columns: { fields: ['Year'], levels: [1] },
    });
    expect(config.totals.disabledSubtotals?.rows?.fields).toEqual(['Country', 'Category']);
  });

  it.each([false, true])('applies field visibility %s to a stale live preset', visible => {
    const config = createFinancialPreset('sales');
    config.rows = ['Product', 'Subcategory'];
    config.totals = { ...config.totals, disabledSubtotals: { rows: { fields: ['Country', 'Subcategory'] } } };
    config.columnLevels = { 0: { subtotal: true, subtotalValues: ['Revenue'] } };
    config.values = [{ prop: 'Quantity', aggregator: 'sum' }];
    const applied = applyFinancialPivotOptions(config, [], visible)!;
    expect(applied.hasConfigurator).toBe(visible);
    expect(applied.totals?.disabledSubtotals?.rows?.fields).toEqual(['Subcategory']);
    expect(applied.columnLevels?.[0]?.subtotalValues).toEqual([]);
    expect(config.totals?.disabledSubtotals?.rows?.fields).toEqual(['Country', 'Subcategory']);
  });
});

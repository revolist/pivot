import {
  createSerializablePivotConfig,
  parsePivotStateJson,
  serializePivotStateJson,
  type PivotConfig,
} from '@revolist/pivot';
import { createFinancialPreset, type FinancialPresetId } from './financial.pivot';

const PIVOT_STORAGE_KEY = 'revogrid:pivot-showcase:report:v2';

export function hasSavedPivotReport(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage.getItem(PIVOT_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function restoreActivePreset(): FinancialPresetId {
  return 'sales';
}

/** The sales report is always the first impression; saved state is restored only by action. */
export function restorePivotConfig(preset: FinancialPresetId): PivotConfig {
  return createFinancialPreset(preset);
}

export function loadSavedPivotReport(): { config: PivotConfig; preset: FinancialPresetId } | null {
  try {
    const json = window.localStorage.getItem(PIVOT_STORAGE_KEY);
    if (!json) return null;
    const saved = JSON.parse(json) as { preset?: FinancialPresetId; state?: string };
    const preset: FinancialPresetId = saved.preset === 'profitability' || saved.preset === 'product'
      ? saved.preset : 'sales';
    const fallback = createFinancialPreset(preset);
    const state = parsePivotStateJson(saved.state ?? '');
    return {
      preset,
      config: {
        ...fallback,
        ...state,
        dimensions: fallback.dimensions,
        rows: state.rows ?? fallback.rows,
        columns: state.columns ?? fallback.columns,
        values: state.values ?? fallback.values,
      },
    };
  } catch {
    return null;
  }
}

export function persistPivotState(config: PivotConfig, preset: FinancialPresetId): boolean {
  try {
    window.localStorage.setItem(PIVOT_STORAGE_KEY, JSON.stringify({
      preset,
      state: serializePivotStateJson(createSerializablePivotConfig(config)),
    }));
    return true;
  } catch {
    return false;
  }
}

export function activeFinancialFilters(config: PivotConfig): string[] {
  return Object.entries(config.filterSelections ?? {})
    .flatMap(([field, selection]) => {
      if (Array.isArray(selection)) return selection.length ? [`${field}: ${selection.join(', ')}`] : [];
      if (selection && typeof selection === 'object') return [`${field}: selection excluded`];
      return [];
    });
}

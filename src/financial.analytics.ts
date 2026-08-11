import {
  createSerializablePivotConfig,
  parsePivotStateJson,
  serializePivotStateJson,
  type PivotConfig,
} from '@revolist/pivot';
import {
  createFinancialPreset,
  type FinancialPresetId,
} from './financial.pivot';

const PIVOT_STORAGE_KEY = 'revogrid:pivot-showcase:v1';
const PIVOT_PRESET_STORAGE_KEY = 'revogrid:pivot-showcase:preset:v1';

export function restoreActivePreset(): FinancialPresetId {
  if (typeof window === 'undefined') return 'sales';
  try {
    const saved = window.localStorage.getItem(PIVOT_PRESET_STORAGE_KEY);
    return saved === 'profitability' || saved === 'product' ? saved : 'sales';
  } catch {
    return 'sales';
  }
}

export function restorePivotConfig(preset: FinancialPresetId): PivotConfig {
  const fallback = createFinancialPreset(preset);
  if (typeof window === 'undefined') return fallback;

  try {
    const json = window.localStorage.getItem(PIVOT_STORAGE_KEY);
    if (!json) return fallback;
    const saved = parsePivotStateJson(json);
    return {
      ...fallback,
      ...saved,
      dimensions: fallback.dimensions,
      rows: saved.rows ?? fallback.rows,
      columns: saved.columns ?? fallback.columns,
      values: saved.values ?? fallback.values,
    };
  } catch {
    return fallback;
  }
}

export function persistPivotState(
  config: PivotConfig,
  preset: FinancialPresetId,
) {
  try {
    const serializable = createSerializablePivotConfig(config);
    window.localStorage.setItem(
      PIVOT_STORAGE_KEY,
      serializePivotStateJson(serializable),
    );
    window.localStorage.setItem(PIVOT_PRESET_STORAGE_KEY, preset);
  } catch {
    // Storage can be unavailable in restricted browsing contexts.
  }
}

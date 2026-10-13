/** Saved report state only. Serialization uses the public Pivot API; grid rendering and export actions live in separate modules. */
import {
  createSerializablePivotConfig,
  parsePivotStateJson,
  serializePivotStateJson,
  type PivotConfig,
} from '@revolist/pivot';
import { CONTOSO_DATASET_ID } from './contoso-data';
import { createFinancialPreset, FINANCIAL_PRESETS, type FinancialPresetId } from './financial.pivot';

const PIVOT_STORAGE_KEY = 'revogrid:pivot-showcase:report:contoso-v2';
const NAMED_REPORTS_KEY = 'revogrid:pivot-showcase:named-reports:contoso-v2';
export interface SavedPivotReport { name: string; preset: FinancialPresetId; state: string }

function readReports(): SavedPivotReport[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(NAMED_REPORTS_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item): item is SavedPivotReport =>
      typeof item?.name === 'string' && typeof item?.state === 'string') : [];
  } catch { return []; }
}

export function listSavedPivotReports(): string[] { return readReports().map((report) => report.name); }

export function saveNamedPivotReport(name: string, config: PivotConfig, preset: FinancialPresetId): boolean {
  const normalized = name.trim().slice(0, 80);
  if (!normalized) return false;
  try {
    const reports = readReports().filter((report) => report.name !== normalized);
    reports.push({ name: normalized, preset, state: serializePivotStateJson(createSerializablePivotConfig(config)) });
    window.localStorage.setItem(NAMED_REPORTS_KEY, JSON.stringify(reports));
    return true;
  } catch { return false; }
}

export function loadNamedPivotReport(name: string): { config: PivotConfig; preset: FinancialPresetId } | null {
  const report = readReports().find((item) => item.name === name);
  return report ? parseSavedReport(report) : null;
}

export function deleteNamedPivotReport(name: string): void {
  window.localStorage.setItem(NAMED_REPORTS_KEY, JSON.stringify(readReports().filter((report) => report.name !== name)));
}

export function exportPivotReportJson(config: PivotConfig, preset: FinancialPresetId): string {
  return JSON.stringify({ format: 'revogrid-pivot-showcase', version: 2, dataset: CONTOSO_DATASET_ID, preset,
    state: serializePivotStateJson(createSerializablePivotConfig(config)) }, null, 2);
}

export function importPivotReportJson(json: string): { config: PivotConfig; preset: FinancialPresetId } | null {
  try {
    const value = JSON.parse(json);
    if (value.format !== 'revogrid-pivot-showcase' || value.version !== 2 ||
        value.dataset !== CONTOSO_DATASET_ID || typeof value.state !== 'string') return null;
    return parseSavedReport(value);
  } catch { return null; }
}

function parseSavedReport(saved: { preset?: FinancialPresetId; state?: string }): { config: PivotConfig; preset: FinancialPresetId } | null {
  try {
    const preset: FinancialPresetId = FINANCIAL_PRESETS.some((candidate) => candidate.id === saved.preset)
      ? saved.preset! : 'sales';
    const fallback = createFinancialPreset(preset);
    const state = parsePivotStateJson(saved.state ?? '');
    return { preset, config: { ...fallback, ...state, dimensions: fallback.dimensions,
      rows: state.rows ?? fallback.rows, columns: state.columns ?? fallback.columns,
      values: state.values ?? fallback.values } };
  } catch { return null; }
}

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
    return parseSavedReport(JSON.parse(json));
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

export type ReportAction = 'export-json' | { kind: 'save-named' | 'restore-named' | 'delete-named'; name: string }
  | { kind: 'import-json'; json: string };

export function handleReportAction(action: ReportAction, config: PivotConfig, preset: FinancialPresetId): {
  restored?: { config: PivotConfig; preset: FinancialPresetId }; error?: string;
} {
  if (action === 'export-json') {
    const blob = new Blob([exportPivotReportJson(config, preset)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pivot-report.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return {};
  }
  if (action.kind === 'save-named') return saveNamedPivotReport(action.name, config, preset)
    ? {} : { error: 'This browser could not save the named report.' };
  if (action.kind === 'delete-named') {
    try { deleteNamedPivotReport(action.name); return {}; }
    catch { return { error: 'This browser could not delete the named report.' }; }
  }
  const restored = action.kind === 'import-json'
    ? importPivotReportJson(action.json) : loadNamedPivotReport(action.name);
  return restored ? { restored } : { error: 'The report is invalid or incompatible with this version.' };
}

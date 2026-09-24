import { defineCustomElements } from '@revolist/revogrid/loader';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
import './financial-pivot-header/financial-pivot-header.scss';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import {
  activeFinancialFilters,
  hasSavedPivotReport,
  handleReportAction,
  listSavedPivotReports,
  loadSavedPivotReport,
  persistPivotState,
  restoreActivePreset,
  restorePivotConfig,
} from './financial.analytics';
import { exportFinancialCsv, exportFinancialXlsx, mountFinancialChart, printFinancialPivot } from './financial.actions';
import {
  FINANCIAL_COLUMNS,
  FINANCIAL_COLUMN_TYPES,
  FINANCIAL_MULTI_ROW_HEADER,
  FINANCIAL_PIVOT_CHARTS,
  FINANCIAL_PIVOT_CHARTS_UI,
  FINANCIAL_SHOWCASE_PLUGINS,
  applyFinancialPivotOptions,
  createFinancialPreset,
  resolveFinancialRows,
  type FinancialPresetId,
} from './financial.pivot';
import {
  FINANCIAL_PIVOT_CONFIGURATOR_EVENT,
  FINANCIAL_PIVOT_EXPANDED_EVENT,
  FINANCIAL_PIVOT_ACTION_EVENT,
  FINANCIAL_PIVOT_PRESET_EVENT,
  createFinancialPivotHeader,
  type FinancialPivotAction,
} from './financial-pivot-header/financial-pivot-header';

defineCustomElements();

const isSmallScreen = () => window.matchMedia('(max-width: 1439px)').matches;

export function load(
  parentSelector: string,
  rows: any[] | { isDark?: boolean } = [],
  options: { initialPreset?: FinancialPresetId } = {},
) {
  const parent = document.querySelector(parentSelector);
  if (!parent) return;

  const { isDark } = currentTheme();
  const data = resolveFinancialRows(Array.isArray(rows) ? rows : undefined);
  let activePreset: FinancialPresetId = options.initialPreset ?? restoreActivePreset();
  let pivotConfig: PivotConfig = restorePivotConfig(activePreset);
  let configuratorVisible = !isSmallScreen();
  let expanded = false;
  let chartVisible = false;
  let chart: PivotChartRef | undefined;
  let savedAvailable = hasSavedPivotReport();

  const container = document.createElement('div');
  container.className = 'financial-pivot-showcase grow flex flex-col gap-2 h-full p-2 box-border';

  const header = createFinancialPivotHeader({
    activePreset,
    configuratorVisible,
    expanded,
    chartVisible,
    savedAvailable,
    savedReports: listSavedPivotReports(),
    activeFilters: activeFinancialFilters(pivotConfig),
  });

  const chartContainer = document.createElement('div');
  chartContainer.className = 'financial-pivot-chart';
  chartContainer.setAttribute('aria-label', 'Pivot chart');
  chartContainer.hidden = true;
  const actionError = document.createElement('div');
  actionError.setAttribute('role', 'alert');
  actionError.className = 'financial-pivot-header__question';

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'grow min-h-0 overflow-auto';
  const gridContainer = document.createElement('div');
  gridContainer.className = 'pivot-grid-container h-full overflow-hidden';
  let grid: HTMLRevoGridElement;

  function applyPivotOptions() {
    grid.pivot = applyFinancialPivotOptions(
      pivotConfig,
      data,
      configuratorVisible,
    );
  }

  function refreshLayout() {
    header.state = {
      activePreset,
      configuratorVisible,
      expanded,
      chartVisible,
      savedAvailable,
      savedReports: listSavedPivotReports(),
      activeFilters: activeFinancialFilters(pivotConfig),
    };
    chartContainer.hidden = !chartVisible;
    Object.assign(container.style, expanded
      ? { position: 'fixed', inset: '8px', zIndex: '1000', background: 'var(--financial-pivot-expanded-background)' }
      : { position: '', inset: '', zIndex: '', background: '' });
  }

  const onPivotConfigUpdate = (event: CustomEvent<PivotConfig>) => {
    pivotConfig = event.detail || createFinancialPreset();
    refreshLayout();
  };
  function initializeGrid() {
    grid = document.createElement('revo-grid') as any;
    grid.className = 'overflow-hidden skip-style h-full min-h-0 cell-border';
    Object.assign(grid, {
      hideAttribution: true,
      range: true,
      resize: true,
      filter: true,
      multiRowHeader: FINANCIAL_MULTI_ROW_HEADER,
      colSize: 128,
      readonly: true,
      theme: isDark() ? 'darkCompact' : 'compact',
      columns: FINANCIAL_COLUMNS,
      columnTypes: FINANCIAL_COLUMN_TYPES,
      plugins: FINANCIAL_SHOWCASE_PLUGINS,
      pivotCharts: FINANCIAL_PIVOT_CHARTS,
      pivotChartsUi: FINANCIAL_PIVOT_CHARTS_UI,
      pivot: applyFinancialPivotOptions(
        pivotConfig,
        data,
        configuratorVisible,
      ),
    });
    grid.addEventListener('pivot-config-update', onPivotConfigUpdate as EventListener);
    gridContainer.appendChild(grid);
    grid.source = data;
  }

  function replacePivotOptions() {
    grid.pivot = undefined;
    window.setTimeout(applyPivotOptions);
  }

  header.addEventListener(FINANCIAL_PIVOT_PRESET_EVENT, (event) => {
    const id = (event as CustomEvent<FinancialPresetId>).detail;
    pivotConfig = createFinancialPreset(id);
    activePreset = id;
    refreshLayout();
    replacePivotOptions();
  });
  header.addEventListener(FINANCIAL_PIVOT_CONFIGURATOR_EVENT, () => {
    configuratorVisible = !configuratorVisible;
    applyPivotOptions();
    refreshLayout();
  });
  header.addEventListener(FINANCIAL_PIVOT_EXPANDED_EVENT, () => {
    expanded = !expanded;
    refreshLayout();
  });
  header.addEventListener(FINANCIAL_PIVOT_ACTION_EVENT, async (event) => {
    const action = (event as CustomEvent<FinancialPivotAction>).detail;
    actionError.textContent = '';
    try {
      if (action === 'export-json' || typeof action === 'object') {
        const result = handleReportAction(action, pivotConfig, activePreset);
        if (result.restored) {
          pivotConfig = result.restored.config;
          activePreset = result.restored.preset;
          replacePivotOptions();
        }
        actionError.textContent = result.error ?? '';
        refreshLayout();
        return;
      }
      if (action === 'reset') {
        activePreset = options.initialPreset ?? 'sales';
        pivotConfig = createFinancialPreset(activePreset);
        refreshLayout();
        replacePivotOptions();
      }
      if (action === 'save') {
        savedAvailable = persistPivotState(pivotConfig, activePreset);
        if (!savedAvailable) actionError.textContent = 'This browser could not save the report.';
        refreshLayout();
      }
      if (action === 'restore') {
        const saved = loadSavedPivotReport();
        if (saved) {
          pivotConfig = saved.config;
          activePreset = saved.preset;
          refreshLayout();
          replacePivotOptions();
        } else actionError.textContent = 'The saved report could not be restored.';
      }
      if (action === 'export') await exportFinancialCsv(grid);
      if (action === 'export-xlsx') await exportFinancialXlsx(grid);
      if (action === 'print') await printFinancialPivot(grid);
      if (action === 'chart') {
        chartVisible = !chartVisible;
        refreshLayout();
        if (chartVisible && !chart) chart = await mountFinancialChart(grid, chartContainer);
      }
    } catch {
      actionError.textContent = `Could not complete ${action}.`;
    }
  });
  scrollContainer.appendChild(gridContainer);
  container.append(header, actionError, chartContainer, scrollContainer);
  parent.appendChild(container);
  refreshLayout();
  initializeGrid();
  const disconnectTheme = observeCurrentTheme((darkTheme) => {
    grid.theme = darkTheme ? 'darkCompact' : 'compact';
  });

  return () => {
    disconnectTheme();
    chart?.destroy();
    grid.removeEventListener('pivot-config-update', onPivotConfigUpdate as EventListener);
    grid.remove();
    container.remove();
  };
}

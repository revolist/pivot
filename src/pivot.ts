/** Vanilla host for the shared financial report model. Vue/React/Angular use the same data, presets, actions and state helpers. */
import { defineCustomElements } from '@revolist/revogrid/loader';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
import './financial-pivot-header/financial-pivot-header.scss';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import { loadContosoData } from './contoso-data';
import {
  hasSavedPivotReport,
  handleReportAction,
  listSavedPivotReports,
  loadSavedPivotReport,
  persistPivotState,
  restoreActivePreset,
  restorePivotConfig,
} from './financial.analytics';
import { exportFinancialCsv, exportFinancialXlsx, financialActionError, mountFinancialChart, printFinancialPivot } from './financial.actions';
import { createFinancialFieldsDrawer } from './financial-fields-drawer';
import {
  FINANCIAL_COLUMNS,
  FINANCIAL_COLUMN_TYPES,
  FINANCIAL_MULTI_ROW_HEADER,
  FINANCIAL_PIVOT_CHARTS,
  FINANCIAL_PIVOT_CHARTS_UI,
  FINANCIAL_SHOWCASE_PLUGINS,
  applyFinancialPivotOptions,
  createFinancialPreset,
  fitFinancialPivotColumns,
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

export function load(
  parentSelector: string,
  rows: any[] | { isDark?: boolean } = [],
  options: { initialPreset?: FinancialPresetId; chartTitle?: string } = {},
) {
  const parent = document.querySelector(parentSelector);
  if (!parent) return;

  const { isDark } = currentTheme();
  const providedRows = Array.isArray(rows) && rows.length ? rows : undefined;
  let data = resolveFinancialRows(providedRows);
  let disposed = false;
  let activePreset: FinancialPresetId = options.initialPreset ?? restoreActivePreset();
  let pivotConfig: PivotConfig = restorePivotConfig(activePreset);
  let configuratorVisible = false;
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
  });

  const summaryMount = document.createElement('div');

  const chartContainer = document.createElement('div');
  chartContainer.className = 'financial-pivot-chart';
  chartContainer.setAttribute('aria-label', 'Pivot chart');
  chartContainer.hidden = true;
  const actionError = document.createElement('div');
  actionError.setAttribute('role', 'alert');
  actionError.className = 'financial-pivot-header__question';

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'financial-pivot-grid-view grow min-h-0 overflow-auto';
  const gridContainer = document.createElement('div');
  gridContainer.className = 'pivot-grid-container h-full overflow-hidden';
  let grid: HTMLRevoGridElement;
  const fieldsDrawer = createFinancialFieldsDrawer(() => {
    configuratorVisible = false;
    applyPivotOptions();
    refreshLayout();
  });

  function applyPivotOptions() {
    fitFinancialPivotColumns(grid, gridContainer, pivotConfig);
    grid.pivot = applyFinancialPivotOptions(
      pivotConfig,
      data,
      configuratorVisible,
      fieldsDrawer.mountTo,
      gridContainer.clientWidth,
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
    };
    chartContainer.hidden = !chartVisible;
    container.classList.toggle('financial-pivot-showcase--chart', chartVisible);
    scrollContainer.setAttribute('aria-hidden', String(chartVisible));
    Object.assign(container.style, expanded
      ? { position: 'fixed', inset: '8px', zIndex: '1000', background: 'var(--financial-pivot-expanded-background)' }
      : { position: '', inset: '', zIndex: '', background: '' });
    if (grid) fitFinancialPivotColumns(grid, gridContainer, pivotConfig);
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
      pivotSummaryPanel: { mountTo: summaryMount },
      pivotCharts: FINANCIAL_PIVOT_CHARTS,
      pivotChartsUi: FINANCIAL_PIVOT_CHARTS_UI,
      pivot: applyFinancialPivotOptions(
        pivotConfig,
        data,
        configuratorVisible,
        fieldsDrawer.mountTo,
        gridContainer.clientWidth,
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
    if (configuratorVisible) fieldsDrawer.hide();
    else {
      fieldsDrawer.show(document.activeElement as HTMLElement);
      configuratorVisible = true;
    }
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
        refreshLayout();
        actionError.textContent = result.error ?? '';
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
        if (chartVisible && !chart) chart = await mountFinancialChart(grid, chartContainer, options.chartTitle);
      }
    } catch (error) {
      if (action === 'chart') { chartVisible = false; refreshLayout(); }
      actionError.textContent = financialActionError(error);
    }
  });
  scrollContainer.appendChild(gridContainer);
  container.append(header, summaryMount, actionError, chartContainer, scrollContainer);
  parent.appendChild(container);
  refreshLayout();
  initializeGrid();
  let narrowHost = gridContainer.clientWidth < 650;
  const resizeObserver = new ResizeObserver(() => {
    fitFinancialPivotColumns(grid, gridContainer, pivotConfig);
    const narrow = gridContainer.clientWidth < 650;
    if (narrow !== narrowHost) {
      narrowHost = narrow;
      applyPivotOptions();
    }
  });
  resizeObserver.observe(gridContainer);
  if (!providedRows) {
    actionError.textContent = 'Loading Contoso retail data…';
    void loadContosoData().then((dataset) => {
      if (disposed) return;
      data = dataset.rows;
      grid.source = data;
      applyPivotOptions();
      actionError.textContent = '';
      refreshLayout();
    }).catch((error) => {
      if (!disposed) actionError.textContent = `Could not load the Contoso dataset: ${error instanceof Error ? error.message : String(error)}`;
    });
  }
  const disconnectTheme = observeCurrentTheme((darkTheme) => {
    grid.theme = darkTheme ? 'darkCompact' : 'compact';
  });

  return () => {
    disposed = true;
    disconnectTheme();
    resizeObserver.disconnect();
    chart?.destroy();
    fieldsDrawer.destroy();
    grid.removeEventListener('pivot-config-update', onPivotConfigUpdate as EventListener);
    grid.remove();
    container.remove();
  };
}

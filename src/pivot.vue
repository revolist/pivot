<template>
  <div
    class="financial-pivot-showcase grow flex flex-col gap-2 h-full box-border"
    :class="{ 'financial-pivot-showcase--chart': chartVisible }"
    :data-expanded="expanded"
  >
    <financial-pivot-header
      :state.prop="headerState"
      @financial-pivot-preset-select="onPresetSelect"
      @financial-pivot-configurator-toggle="toggleFields"
      @financial-pivot-expanded-toggle="expanded = !expanded"
      @financial-pivot-action="onAction"
    />
    <div ref="summaryMount" />
    <div v-if="loading" role="status" class="financial-pivot-header__question">Loading Contoso retail data…</div>
    <div v-if="loadError" role="alert" class="financial-pivot-header__question">{{ loadError }}</div>
    <div v-if="actionError" role="alert" class="financial-pivot-header__question">{{ actionError }}</div>
    <div v-show="chartVisible" ref="chartContainer" class="financial-pivot-chart" aria-label="Pivot chart" />

    <div v-if="!loading && !loadError" class="financial-pivot-grid-view grow min-h-0 overflow-auto" :aria-hidden="chartVisible">
      <div
        ref="gridHost"
        class="pivot-grid-container h-full overflow-hidden gap-1"
      >
        <RevoGrid
          class="overflow-hidden skip-style h-full min-h-0 cell-border"
          hide-attribution
          range
          resize
          filter
          :multi-row-header.prop="FINANCIAL_MULTI_ROW_HEADER"
          :colSize="columnSize"
          :source="rows"
          :columns="FINANCIAL_COLUMNS"
          :pivot.prop="pivot"
          :pivot-summary-panel.prop="summaryOptions"
          :pivot-charts.prop="FINANCIAL_PIVOT_CHARTS"
          :pivot-charts-ui.prop="chartUi"
          :theme="isDark ? 'darkCompact' : 'compact'"
          :plugins="plugins"
          :column-types="columnTypes"
          readonly
          @aftergridinit="onGridReady"
          @pivot-config-update="configUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import RevoGrid from '@revolist/vue3-datagrid';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
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
import { exportFinancialCsv, exportFinancialXlsx, financialActionError, financialChartSettingsUi, setInlineChartSettingsVisible, usesChartSettingsDrawer, mountFinancialChart, printFinancialPivot } from './financial.actions';
import { createFinancialFieldsDrawer, type FinancialFieldsDrawer } from './financial-fields-drawer';
import {
  FINANCIAL_COLUMNS,
  FINANCIAL_COLUMN_TYPES,
  FINANCIAL_MULTI_ROW_HEADER,
  FINANCIAL_PIVOT_CHARTS,
  FINANCIAL_PIVOT_CHARTS_UI,
  FINANCIAL_SHOWCASE_PLUGINS,
  applyFinancialPivotOptions,
  createFinancialPreset,
  financialPivotColumnSize,
  resolveFinancialRows,
  type FinancialPresetId,
} from './financial.pivot';
import {
  defineFinancialPivotHeaderElement,
  type FinancialPivotAction,
  type FinancialPivotHeaderState,
} from './financial-pivot-header/financial-pivot-header';

defineFinancialPivotHeaderElement();

const isDark = ref(currentTheme().isDark());
let disconnectTheme: (() => void) | undefined;
const props = defineProps<{ rows?: any[]; initialPreset?: FinancialPresetId; chartTitle?: string }>();
const initialRows = resolveFinancialRows(props.rows);
const rows = shallowRef(initialRows);
const loading = ref(!props.rows);
const loadError = ref('');
const actionError = ref('');
let fieldsDrawer: FinancialFieldsDrawer | undefined;
const configuratorMount = shallowRef<HTMLElement>();
const chartSettingsMount = shallowRef<HTMLElement>();
const chartUi = computed(() => financialChartSettingsUi(FINANCIAL_PIVOT_CHARTS_UI, chartSettingsMount.value, chartFieldsVisible.value));

onMounted(() => {
  fieldsDrawer = createFinancialFieldsDrawer(() => {
    configuratorVisible.value = false;
    chartFieldsVisible.value = false;
  });
  configuratorMount.value = fieldsDrawer.mountTo;
  chartSettingsMount.value = fieldsDrawer.chartMountTo;
  disconnectTheme = observeCurrentTheme((value) => {
    isDark.value = value;
  });
  if (!props.rows) {
    void loadContosoData().then((data) => {
      rows.value = data.rows;
    }).catch((error) => {
      loadError.value = `Could not load the Contoso dataset: ${error instanceof Error ? error.message : String(error)}`;
    }).finally(() => { loading.value = false; });
  }
});
onBeforeUnmount(() => { disconnectTheme?.(); fieldsDrawer?.destroy(); gridResizeObserver?.disconnect(); });

const activePreset = ref<FinancialPresetId>(props.initialPreset ?? restoreActivePreset());
const pivotConfig = shallowRef<PivotConfig>(restorePivotConfig(activePreset.value));
const configuratorVisible = ref(false);
const expanded = ref(false);
const chartVisible = ref(false);
const chartFieldsVisible = ref(false);
const chartContainer = ref<HTMLElement>();
let chart: PivotChartRef | undefined;
const savedAvailable = ref(hasSavedPivotReport());
const reportsRevision = ref(0);
const gridHost = ref<HTMLElement>();
const columnSize = ref(128);
const hostWidth = ref(0);
// Resolve the public element when the wrapper has finished initializing the grid.
const gridElement = shallowRef<HTMLRevoGridElement>();
const onGridReady = (event: Event) => {
  gridElement.value = event.target as HTMLRevoGridElement;
};
watch([gridElement, chartVisible], async ([grid, visible], _previous, onCleanup) => {
  if (!grid || !visible || chart || !chartContainer.value) return;
  let active = true;
  onCleanup(() => { active = false; });
  try {
    await grid.componentOnReady();
    if (!active) return;
    const mounted = await mountFinancialChart(grid, chartContainer.value, props.chartTitle, fieldsDrawer?.chartMountTo);
    if (active) chart = mounted;
    else mounted.destroy();
  } catch (error) {
    if (active) {
      chartVisible.value = false;
      actionError.value = financialActionError(error);
    }
  }
}, { flush: 'post' });
let gridResizeObserver: ResizeObserver | undefined;
const fitColumns = () => {
  if (gridHost.value) {
    hostWidth.value = gridHost.value.clientWidth;
    columnSize.value = financialPivotColumnSize(gridHost.value, pivotConfig.value);
  }
};
watch(gridHost, (host) => {
  gridResizeObserver?.disconnect();
  if (!host) return;
  gridResizeObserver = new ResizeObserver(fitColumns);
  gridResizeObserver.observe(host);
  void nextTick(fitColumns);
});
watch(pivotConfig, () => { void nextTick(fitColumns); });
const columnTypes = ref(FINANCIAL_COLUMN_TYPES);
const plugins = FINANCIAL_SHOWCASE_PLUGINS;
const summaryMount = shallowRef<HTMLElement>();
const summaryOptions = computed(() => ({ mountTo: summaryMount.value }));
const headerState = computed<FinancialPivotHeaderState>(() => ({
  activePreset: activePreset.value,
  configuratorVisible: chartVisible.value ? chartFieldsVisible.value : configuratorVisible.value,
  expanded: expanded.value,
  chartVisible: chartVisible.value,
  savedAvailable: savedAvailable.value,
  savedReports: (reportsRevision.value, listSavedPivotReports()),
}));

const pivot = computed(() =>
  applyFinancialPivotOptions(
    pivotConfig.value,
    rows.value,
    configuratorVisible.value,
    configuratorMount.value,
    hostWidth.value,
  ),
);

const toggleFields = () => {
  if (chartVisible.value && gridElement.value) {
    if (!usesChartSettingsDrawer()) {
      chartFieldsVisible.value = !chartFieldsVisible.value;
      setInlineChartSettingsVisible(gridElement.value, chartFieldsVisible.value);
      return;
    }
    if (chartFieldsVisible.value) fieldsDrawer?.hide();
    else {
      chartFieldsVisible.value = true;
      fieldsDrawer?.show(document.activeElement as HTMLElement, 'chart');
    }
    return;
  }
  if (configuratorVisible.value) fieldsDrawer?.hide();
  else {
    fieldsDrawer?.show(document.activeElement as HTMLElement);
    configuratorVisible.value = true;
  }
};

const configUpdate = (event: CustomEvent<PivotConfig>) => {
  pivotConfig.value = event.detail || createFinancialPreset();
};

const selectPreset = (id: FinancialPresetId) => {
  if (gridElement.value) gridElement.value.pivot = undefined;
  window.setTimeout(() => {
    pivotConfig.value = createFinancialPreset(id);
    activePreset.value = id;
  });
};

const onPresetSelect = (event: Event) => {
  selectPreset((event as CustomEvent<FinancialPresetId>).detail);
};

const onAction = async (event: Event) => {
  const action = (event as CustomEvent<FinancialPivotAction>).detail;
  actionError.value = '';
  try {
    if (action === 'export-json' || typeof action === 'object') {
      const result = handleReportAction(action, pivotConfig.value, activePreset.value);
      if (result.restored) {
        if (gridElement.value) gridElement.value.pivot = undefined;
        window.setTimeout(() => {
          pivotConfig.value = result.restored!.config;
          activePreset.value = result.restored!.preset;
        });
      }
      savedAvailable.value = hasSavedPivotReport();
      reportsRevision.value++;
      actionError.value = result.error ?? '';
      return;
    }
    if (action === 'reset') selectPreset(props.initialPreset ?? 'sales');
    if (action === 'save') {
      savedAvailable.value = persistPivotState(pivotConfig.value, activePreset.value);
      if (!savedAvailable.value) actionError.value = 'This browser could not save the report.';
    }
    if (action === 'restore') {
      const saved = loadSavedPivotReport();
      if (saved) {
        if (gridElement.value) gridElement.value.pivot = undefined;
        window.setTimeout(() => {
          pivotConfig.value = saved.config;
          activePreset.value = saved.preset;
        });
      } else actionError.value = 'The saved report could not be restored.';
    }
    if (action === 'export' && gridElement.value) await exportFinancialCsv(gridElement.value);
    if (action === 'export-xlsx' && gridElement.value) await exportFinancialXlsx(gridElement.value);
    if (action === 'print' && gridElement.value) await printFinancialPivot(gridElement.value);
    if (action === 'chart') {
      fieldsDrawer?.hide();
      chartVisible.value = !chartVisible.value;
    }
  } catch {
    actionError.value = 'Could not complete this report action. Please try again.';
  }
};
onBeforeUnmount(() => chart?.destroy());
</script>

<style lang="scss">
@use './financial-pivot-header/financial-pivot-header.scss';

revo-grid.cell-border .rgHeaderCell[highlight] {
  box-shadow: 0 -3px 0 0 #00b997 inset, -1px 0 0 0 var(--revo-grid-cell-border) inset;
}
</style>

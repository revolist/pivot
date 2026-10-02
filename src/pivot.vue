<template>
  <div
    class="financial-pivot-showcase grow flex flex-col gap-2 h-full box-border"
    :class="{ 'financial-pivot-showcase--chart': chartVisible }"
    :style="expandedStyle"
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
          :pivot-charts-ui.prop="FINANCIAL_PIVOT_CHARTS_UI"
          :theme="isDark ? 'darkCompact' : 'compact'"
          :plugins="plugins"
          :column-types="columnTypes"
          readonly
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
import { exportFinancialCsv, exportFinancialXlsx, mountFinancialChart, printFinancialPivot } from './financial.actions';
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
const props = defineProps<{ rows?: any[]; initialPreset?: FinancialPresetId }>();
const initialRows = resolveFinancialRows(props.rows);
const rows = shallowRef(initialRows);
const loading = ref(!props.rows);
const loadError = ref('');
const actionError = ref('');
let fieldsDrawer: FinancialFieldsDrawer | undefined;
const configuratorMount = shallowRef<HTMLElement>();

onMounted(() => {
  fieldsDrawer = createFinancialFieldsDrawer(() => { configuratorVisible.value = false; });
  configuratorMount.value = fieldsDrawer.mountTo;
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
const chartContainer = ref<HTMLElement>();
let chart: PivotChartRef | undefined;
const savedAvailable = ref(hasSavedPivotReport());
const reportsRevision = ref(0);
const gridHost = ref<HTMLElement>();
const columnSize = ref(128);
// The Vue wrapper ref is a component instance; actions need the public grid element API.
const gridElement = computed(() => gridHost.value?.querySelector('revo-grid') as HTMLRevoGridElement | undefined);
let gridResizeObserver: ResizeObserver | undefined;
const fitColumns = () => {
  if (gridHost.value) columnSize.value = financialPivotColumnSize(gridHost.value, pivotConfig.value);
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
  configuratorVisible: configuratorVisible.value,
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
  ),
);

const toggleFields = () => {
  if (configuratorVisible.value) fieldsDrawer?.hide();
  else {
    fieldsDrawer?.show(document.activeElement as HTMLElement);
    configuratorVisible.value = true;
  }
};

const expandedStyle = computed(() => expanded.value
  ? { position: 'fixed' as const, inset: '8px', zIndex: 1000, background: 'var(--financial-pivot-expanded-background)' }
  : undefined,
);

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
      chartVisible.value = !chartVisible.value;
      if (chartVisible.value && !chart) {
        await nextTick();
        if (gridElement.value && chartContainer.value) chart = await mountFinancialChart(gridElement.value, chartContainer.value);
      }
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

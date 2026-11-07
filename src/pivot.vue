<template>
  <div
    class="financial-pivot-showcase grow flex flex-col gap-2 h-full box-border"
    :class="{ 'financial-pivot-showcase--chart': chartVisible }"
    :data-expanded="expanded"
    @keydown.esc="configuratorVisible = false"
  >
    <div class="financial-pivot-main">
      <financial-pivot-header
        :state.prop="headerState"
        @financial-pivot-preset-select="onPresetSelect"
        @financial-pivot-configurator-toggle="toggleFields"
        @financial-pivot-expanded-toggle="expanded = !expanded"
        @financial-pivot-action="onAction"
      />
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
            :pivot-charts.prop="FINANCIAL_PIVOT_CHARTS"
            :pivot-charts-ui.prop="FINANCIAL_PIVOT_CHARTS_UI"
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
    <aside :hidden="!configuratorVisible" class="financial-pivot-sidebar" :aria-label="chartVisible ? 'Chart fields' : 'Pivot fields'">
      <div :hidden="chartVisible" ref="configuratorMount" class="financial-pivot-sidebar__mount" />
      <div :hidden="!chartVisible" ref="chartSettingsMount" class="financial-pivot-sidebar__mount" />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import RevoGrid from '@revolist/vue3-datagrid';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import { loadContosoData } from './contoso-data';
import {
  restoreActivePreset,
  restorePivotConfig,
} from './financial.analytics';
import { exportFinancialCsv, exportFinancialXlsx, financialActionError, mountFinancialChart, printFinancialPivot } from './financial.actions';
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
const configuratorMount = shallowRef<HTMLElement>();
const chartSettingsMount = shallowRef<HTMLElement>();

onMounted(() => {
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
onBeforeUnmount(() => { disconnectTheme?.(); gridResizeObserver?.disconnect(); });

const activePreset = ref<FinancialPresetId>(props.initialPreset ?? restoreActivePreset());
const pivotConfig = shallowRef<PivotConfig>(restorePivotConfig(activePreset.value));
const configuratorVisible = ref(false);
const expanded = ref(false);
const chartVisible = ref(false);
const chartContainer = ref<HTMLElement>();
let chart: PivotChartRef | undefined;
const gridHost = ref<HTMLElement>();
const columnSize = ref(128);
const hostWidth = ref(0);
// Resolve the public element when the wrapper has finished initializing the grid.
const gridElement = shallowRef<HTMLRevoGridElement>();
const onGridReady = (event: Event) => {
  gridElement.value = event.target as HTMLRevoGridElement;
};
watch([gridElement, chartVisible], async ([grid, visible], _previous, onCleanup) => {
  if (!grid || !visible || chart || !chartContainer.value || !chartSettingsMount.value) return;
  let active = true;
  onCleanup(() => { active = false; });
  try {
    await grid.componentOnReady();
    if (!active) return;
    const mounted = await mountFinancialChart(grid, chartContainer.value, chartSettingsMount.value, props.chartTitle);
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
const headerState = computed<FinancialPivotHeaderState>(() => ({
  activePreset: activePreset.value,
  configuratorVisible: configuratorVisible.value,
  expanded: expanded.value,
  chartVisible: chartVisible.value,
}));

const pivot = computed(() =>
  applyFinancialPivotOptions(
    pivotConfig.value,
    rows.value,
    configuratorVisible.value && !chartVisible.value,
    configuratorMount.value,
    hostWidth.value,
  ),
);

const toggleFields = () => { configuratorVisible.value = !configuratorVisible.value; };

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
    if (action === 'export' && gridElement.value) await exportFinancialCsv(gridElement.value);
    if (action === 'export-xlsx' && gridElement.value) await exportFinancialXlsx(gridElement.value);
    if (action === 'print' && gridElement.value) await printFinancialPivot(gridElement.value);
    if (action === 'chart') {
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

<template>
  <div
    class="financial-pivot-showcase grow flex flex-col gap-2 h-full box-border"
    :style="expandedStyle"
  >
    <financial-pivot-header
      :state.prop="headerState"
      @financial-pivot-preset-select="onPresetSelect"
      @financial-pivot-configurator-toggle="configuratorVisible = !configuratorVisible"
      @financial-pivot-expanded-toggle="expanded = !expanded"
      @financial-pivot-action="onAction"
    />
    <div v-if="actionError" role="alert" class="financial-pivot-header__question">{{ actionError }}</div>
    <div v-show="chartVisible" ref="chartContainer" class="financial-pivot-chart" aria-label="Pivot chart" />

    <div class="grow min-h-0 overflow-auto">
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
          :colSize="180"
          :source="rows"
          :columns="FINANCIAL_COLUMNS"
          :pivot.prop="pivot"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import RevoGrid from '@revolist/vue3-datagrid';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
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
const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1439px)').matches;

onMounted(() => {
  disconnectTheme = observeCurrentTheme((value) => {
    isDark.value = value;
  });
});
onBeforeUnmount(() => disconnectTheme?.());

const activePreset = ref<FinancialPresetId>(props.initialPreset ?? restoreActivePreset());
const pivotConfig = shallowRef<PivotConfig>(restorePivotConfig(activePreset.value));
const configuratorVisible = ref(!isSmallScreen());
const expanded = ref(false);
const chartVisible = ref(false);
const chartContainer = ref<HTMLElement>();
let chart: PivotChartRef | undefined;
const savedAvailable = ref(hasSavedPivotReport());
const reportsRevision = ref(0);
const actionError = ref('');
const gridHost = ref<HTMLElement>();
// The Vue wrapper ref is a component instance; actions need the public grid element API.
const gridElement = computed(() => gridHost.value?.querySelector('revo-grid') as HTMLRevoGridElement | undefined);
const columnTypes = ref(FINANCIAL_COLUMN_TYPES);
const plugins = FINANCIAL_SHOWCASE_PLUGINS;
const headerState = computed<FinancialPivotHeaderState>(() => ({
  activePreset: activePreset.value,
  configuratorVisible: configuratorVisible.value,
  expanded: expanded.value,
  chartVisible: chartVisible.value,
  savedAvailable: savedAvailable.value,
  savedReports: (reportsRevision.value, listSavedPivotReports()),
  activeFilters: activeFinancialFilters(pivotConfig.value),
}));

const pivot = computed(() =>
  applyFinancialPivotOptions(
    pivotConfig.value,
    rows.value,
    configuratorVisible.value,
  ),
);

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
      actionError.value = result.error ?? '';
      savedAvailable.value = hasSavedPivotReport();
      reportsRevision.value++;
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
    actionError.value = `Could not complete ${action}.`;
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

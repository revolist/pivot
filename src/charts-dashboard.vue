<template>
  <section class="pivot-dashboard" :class="{ 'is-dark': isDark }" :data-chart-stage="chartStage">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Interactive Pivot dashboard</p>
        <h1>Explore revenue from report to chart</h1>
        <p>Change the period, brand, or report layout. The three linked charts follow the Pivot filters.</p>
      </div>
      <a href="https://pro.rv-grid.com/guides/pivot/" target="_blank" rel="noopener noreferrer">Pivot guide ↗</a>
    </header>

    <div class="dashboard-controls" aria-label="Dashboard controls">
      <label>Year
        <select :value="yearControl.value" aria-label="Year" @change="updateFilter('Year', $event)">
          <option value="">All years</option>
          <option v-if="yearControl.value === '__custom__'" value="__custom__" disabled>{{ yearControl.label }}</option>
          <option :value="2025">2025</option>
          <option :value="2024">2024</option>
        </select>
      </label>
      <label>Brand
        <select :value="brandControl.value" aria-label="Brand" @change="updateFilter('Brand', $event)">
          <option v-if="brandControl.value === '__custom__'" value="__custom__" disabled>{{ brandControl.label }}</option>
          <option value="">All brands</option>
          <option v-for="name in brands" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <div class="dashboard-compare" role="radiogroup" aria-labelledby="dashboard-compare-label">
        <span id="dashboard-compare-label" class="dashboard-compare-label">Compare</span>
        <div class="dashboard-compare-options">
          <label><input :checked="rowField === 'Country'" type="radio" name="dashboard-rows" value="Country" @change="updateRows('Country')" /> Countries</label>
          <label><input :checked="rowField === 'Category'" type="radio" name="dashboard-rows" value="Category" @change="updateRows('Category')" /> Categories</label>
        </div>
      </div>
      <button type="button" @click="reset">Reset report</button>
      <button type="button" aria-haspopup="dialog" :aria-expanded="fieldsVisible" @click="toggleFields">Fields</button>
      <div class="dashboard-summary" aria-live="polite">
        <span>{{ filteredRows.length.toLocaleString() }} filtered lines · {{ yearControl.label }} · {{ brandControl.label }}</span>
      </div>
    </div>

    <p v-if="loading" role="status">Loading Contoso retail data…</p>
    <p v-if="loadError" role="alert">{{ loadError }}</p>

    <div class="dashboard-layout">
      <div class="dashboard-charts" :style="{ '--dashboard-chart-height': `${comparisonHeight}px` }">
        <section class="dashboard-card" aria-label="Quarterly revenue chart">
          <span class="dashboard-card-kicker">01 / Report series</span>
          <h2>{{ quarterlyLayout ? 'Quarterly revenue' : 'Revenue' }} by {{ activeRowLabel.toLowerCase() }}</h2>
          <p>Report series side by side for each report row.</p>
          <div class="dashboard-chart-viewport">
            <div ref="quarterChartHost" class="chart-host" data-testid="quarter-chart"></div>
          </div>
        </section>
        <section class="dashboard-card" aria-label="Comparison chart">
          <span class="dashboard-card-kicker">02 / Report mix</span>
          <h2>{{ activeRowLabel }} comparison</h2>
          <p>Stacked bars show each row's total and series composition.</p>
          <div class="dashboard-chart-viewport" :style="{ height: `${comparisonHeight}px` }">
            <div ref="comparisonChartHost" class="chart-host" data-testid="comparison-chart"></div>
          </div>
        </section>
        <section class="dashboard-card" aria-label="Quarterly revenue share chart">
          <span class="dashboard-card-kicker">03 / Revenue share</span>
          <h2>Revenue share by quarter</h2>
          <p>Each quarter's contribution to filtered revenue.</p>
          <div class="dashboard-chart-viewport">
            <div ref="shareChartHost" class="chart-host" data-testid="share-chart"></div>
          </div>
        </section>
        <p v-if="chartError" class="chart-error" role="alert">{{ chartError }}</p>
      </div>
      <section class="dashboard-card dashboard-report" aria-label="Pivot report">
        <div ref="gridHost" class="dashboard-grid">
          <RevoGrid
            hide-attribution
            range
            resize
            readonly
            :source="rows"
            :columns="CHARTS_COLUMNS"
            :colSize="columnSize"
            :pivot.prop="pivot"
            :pivot-charts.prop="dashboardCharts"
            :pivot-charts-ui.prop="FINANCIAL_PIVOT_CHARTS_UI"
            :column-types="FINANCIAL_COLUMN_TYPES"
            :plugins="dashboardPlugins"
            :theme="isDark ? 'darkCompact' : 'compact'"
            @pivot-config-update="onConfigUpdate"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import RevoGrid from '@revolist/vue3-datagrid';
import type { PivotChartRef, PivotChartsPlugin, PivotChartUpdatedEventDetail, PivotConfig } from '@revolist/pivot';
import { createPivotChartsRenderer } from '@revolist/pivot';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import { loadContosoData, type ContosoSale } from './contoso-data';
import { createFinancialFieldsDrawer, type FinancialFieldsDrawer } from './financial-fields-drawer';
import {
  FINANCIAL_COLUMN_TYPES,
  FINANCIAL_PIVOT_CHARTS,
  FINANCIAL_PIVOT_CHARTS_UI,
  createFinancialShowcasePlugins,
} from './financial.pivot';
import {
  CHARTS_COLUMNS,
  createChartsConfig,
  dashboardRows,
  comparisonChartHeight,
  type DashboardRows,
  dashboardFilterControl,
  updateDashboardFilter,
} from './charts-dashboard.model';

const dashboardPlugins = createFinancialShowcasePlugins(false, false);

// Compact axis ticks keep million-dollar ranges readable; bar tooltips retain exact values.
const axisNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const dashboardCharts = {
  ...FINANCIAL_PIVOT_CHARTS,
  renderer: createPivotChartsRenderer({ transitions: { duration: 900, easing: 'ease-out' } }),
  localeText: { renderer: { formatNumber: (value: number) => axisNumber.format(value) } },
};

const rows = shallowRef<ContosoSale[]>([]);
const brands = computed(() => [...new Set(rows.value.map((row) => row.Brand))].sort());
const loading = ref(true);
const loadError = ref('');
const fieldsVisible = ref(false);
const configuratorMount = shallowRef<HTMLElement>();
const pivotConfig = shallowRef<PivotConfig>(createChartsConfig());
const rowField = computed(() => pivotConfig.value.rows.length === 1 ? pivotConfig.value.rows[0] : undefined);
const yearControl = computed(() => dashboardFilterControl(pivotConfig.value, 'Year', [2024, 2025]));
const brandControl = computed(() => dashboardFilterControl(pivotConfig.value, 'Brand', brands.value));
const pivot = computed<PivotConfig>(() => ({
  ...pivotConfig.value,
  hasConfigurator: fieldsVisible.value,
  mountTo: fieldsVisible.value ? configuratorMount.value : undefined,
}));
const quarterlyLayout = computed(() => pivotConfig.value.columns?.join('|') === 'Quarter');
const activeRowLabel = computed(() => String(pivotConfig.value.rows?.[0] ?? 'All records'));
const filteredRows = computed(() => dashboardRows(pivotConfig.value, rows.value));
const quarterCount = computed(() => new Set(filteredRows.value.map((row) => row.Quarter)).size || 4);
const gridHost = ref<HTMLElement>();
const gridWidth = ref(0);
const columnSize = computed(() => {
  const config = pivotConfig.value;
  if (config.columns?.join('|') !== 'Quarter' || config.values.length !== 1 || config.rows.length !== 1) return 128;
  const totalColumns = quarterCount.value + (config.totals?.grandTotal ? 1 : 0);
  const rowWidth = config.dimensions?.find((dimension) => dimension.prop === config.rows[0])?.size ?? 0;
  // Preserve complete dollar amounts on narrow screens; the grid supplies horizontal scrolling.
  return Math.max(148, Math.floor((gridWidth.value - rowWidth - 2) / (totalColumns + (rowWidth ? 0 : 1))));
});
const quarterChartHost = ref<HTMLElement>();
const comparisonChartHost = ref<HTMLElement>();
const shareChartHost = ref<HTMLElement>();
const comparisonHeight = ref(300);

async function syncComparisonHeight() {
  const comparison = charts[1];
  const plugin = chartDataPlugin;
  const request = ++heightRequest;
  if (!comparison || !plugin) return;
  const model = comparison.model;
  const dataset = await plugin.getChartData({ chartType: model.chartType, totals: model.totals, query: model.query });
  if (!disposed && request === heightRequest && charts[1] === comparison) {
    comparisonHeight.value = comparisonChartHeight(dataset.categories.length);
  }
}

function onChartUpdated(event: CustomEvent<PivotChartUpdatedEventDetail>) {
  if (event.detail.chartId === charts[1]?.id) {
    void syncComparisonHeight().catch(error => { if (!disposed) chartError.value = String(error); });
  }
}
const chartError = ref('');
const chartStage = ref('waiting for grid');
const isDark = ref(currentTheme().isDark());
let disconnectTheme: (() => void) | undefined;
let fieldsDrawer: FinancialFieldsDrawer | undefined;
let grid: HTMLRevoGridElement | null = null;
let charts: PivotChartRef[] = [];
let chartDataPlugin: ActiveChartsPlugin | undefined;
let heightRequest = 0;
let mounting = false;
let gridObserver: MutationObserver | undefined;
let gridResizeObserver: ResizeObserver | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let disposed = false;

type ActiveChartsPlugin = Pick<PivotChartsPlugin, 'createChart' | 'getChartData'>;

function isActiveChartsPlugin(plugin: unknown): plugin is ActiveChartsPlugin {
  return !!plugin && typeof plugin === 'object'
    && typeof (plugin as ActiveChartsPlugin).createChart === 'function'
    && typeof (plugin as ActiveChartsPlugin).getChartData === 'function';
}

function connectGrid() {
  const current = gridHost.value?.querySelector<HTMLRevoGridElement>(':scope > revo-grid') ?? null;
  if (grid === current) return;
  grid?.removeEventListener('pivot-model-changed', mountCharts);
  grid?.removeEventListener('pivot-chart-updated', onChartUpdated);
  charts.forEach((chart) => chart.destroy());
  charts = [];
  grid = current;
  attempts = 0;
  grid?.addEventListener('pivot-model-changed', mountCharts);
  grid?.addEventListener('pivot-chart-updated', onChartUpdated);
}

function updateFilter(field: 'Year' | 'Brand', event: Event) {
  pivotConfig.value = updateDashboardFilter(pivotConfig.value, field, (event.target as HTMLSelectElement).value);
}

function updateRows(field: DashboardRows) {
  pivotConfig.value = { ...pivotConfig.value, rows: [field] };
}

function toggleFields(event: MouseEvent) {
  if (fieldsVisible.value) fieldsDrawer?.hide();
  else {
    fieldsDrawer?.show(event.currentTarget as HTMLElement);
    fieldsVisible.value = true;
  }
}

function reset() {
  pivotConfig.value = createChartsConfig();
}

function onConfigUpdate(event: CustomEvent<Partial<PivotConfig>>) {
  if (!event.detail) return;
  // The public event is typed as a partial config. Preserve unaffected fields.
  const nextConfig = { ...pivotConfig.value, ...event.detail };
  pivotConfig.value = nextConfig;
}

async function mountCharts() {
  connectGrid();
  if (disposed || !grid || mounting || charts.length || !quarterChartHost.value || !comparisonChartHost.value || !shareChartHost.value) return;
  const activeGrid = grid;
  mounting = true;
  chartError.value = '';
  try {
    chartStage.value = 'waiting for chart plugin';
    const activePlugins: unknown[] = await activeGrid.getPlugins();
    if (disposed) return;
    const activeCharts = activePlugins.find(isActiveChartsPlugin);
    if (!activeCharts) throw new Error(`Chart plugin is not active yet (${activePlugins.length} plugins)`);
    connectGrid();
    if (activeGrid !== grid) throw new Error('Grid element was replaced during chart startup');
    chartDataPlugin = activeCharts;
    // Set the shared chart height before rendering: a resize settles native entrance motion.
    const comparisonData = await activeCharts.getChartData({ chartType: 'stackedBar' });
    if (disposed) return;
    comparisonHeight.value = comparisonChartHeight(comparisonData.categories.length);
    await nextTick();
    connectGrid();
    if (activeGrid !== grid) throw new Error('Grid element was replaced during chart startup');
    chartStage.value = 'creating quarterly chart';
    charts.push(await activeCharts.createChart({
      container: quarterChartHost.value,
      chartType: 'groupedColumn',
      linked: true,
      presentation: { legendPosition: 'bottom', yAxisTitle: 'Revenue (USD)' },
    }));
    if (disposed) {
      charts.forEach((chart) => chart.destroy());
      charts = [];
      return;
    }
    connectGrid();
    if (activeGrid !== grid) throw new Error('Grid element was replaced during chart startup');
    chartStage.value = 'creating comparison chart';
    charts.push(await activeCharts.createChart({
      container: comparisonChartHost.value,
      chartType: 'stackedBar',
      linked: true,
      presentation: { legendPosition: 'bottom', xAxisTitle: 'Revenue (USD)' },
    }));
    connectGrid();
    if (activeGrid !== grid) throw new Error('Grid element was replaced during chart startup');
    if (disposed) {
      charts.forEach((chart) => chart.destroy());
      charts = [];
      return;
    }
    chartStage.value = 'creating revenue share chart';
    charts.push(await activeCharts.createChart({
      container: shareChartHost.value,
      chartType: 'donut',
      linked: true,
      totals: 'none',
      // Four quarters make a readable whole while inheriting the report's filters.
      query: { slice: { rows: ['Quarter'], columns: [], measures: [{ prop: 'Revenue', aggregator: 'sum' }] } },
      presentation: { legendPosition: 'bottom' },
    }));
    connectGrid();
    if (activeGrid !== grid) throw new Error('Grid element was replaced during chart startup');
    if (disposed) {
      charts.forEach((chart) => chart.destroy());
      charts = [];
      return;
    }
    await syncComparisonHeight();
    await nextTick();
    chartStage.value = 'ready';
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
  } catch (error) {
    charts.forEach((chart) => chart.destroy());
    charts = [];
    const reason = error instanceof Error ? error.message : String(error);
    if (!disposed && attempts < 40) {
      attempts += 1;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { void mountCharts(); }, 250);
    } else if (!disposed) {
      chartError.value = `Charts could not be loaded (${chartStage.value}): ${reason}`;
    }
  } finally {
    mounting = false;
  }
}

onMounted(async () => {
  fieldsDrawer = createFinancialFieldsDrawer(() => { fieldsVisible.value = false; });
  configuratorMount.value = fieldsDrawer.mountTo;
  disconnectTheme = observeCurrentTheme((value) => { isDark.value = value; });
  try {
    const dataset = await loadContosoData();
    rows.value = dataset.rows;
  } catch (error) {
    loadError.value = `Could not load the Contoso dataset: ${error instanceof Error ? error.message : String(error)}`;
  } finally { loading.value = false; }
  await nextTick();
  // The wrapper owns the custom element; watch only for replacement of its public grid.
  connectGrid();
  if (gridHost.value) {
    gridResizeObserver = new ResizeObserver(([entry]) => { gridWidth.value = entry.contentRect.width; });
    gridResizeObserver.observe(gridHost.value);
    gridObserver = new MutationObserver(() => { connectGrid(); void mountCharts(); });
    gridObserver.observe(gridHost.value, { childList: true });
  }
  // The first Pivot model may have committed before the listener was attached.
  void mountCharts();
});

onBeforeUnmount(() => {
  disposed = true;
  if (retryTimer) clearTimeout(retryTimer);
  gridObserver?.disconnect();
  gridResizeObserver?.disconnect();
  grid?.removeEventListener('pivot-model-changed', mountCharts);
  grid?.removeEventListener('pivot-chart-updated', onChartUpdated);
  charts.forEach((chart) => chart.destroy());
  disconnectTheme?.();
  fieldsDrawer?.destroy();
});
</script>

<style lang="scss">
@use './financial-pivot-header/financial-pivot-header.scss';
</style>

<style scoped src="./charts-dashboard.scss" lang="scss"></style>

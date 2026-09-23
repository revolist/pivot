<template>
  <section class="pivot-dashboard">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Interactive Pivot dashboard</p>
        <h1>Explore revenue from report to chart</h1>
        <p>Change the period, customer segment, or report layout. The two linked charts follow the Pivot result.</p>
      </div>
      <a href="https://pro.rv-grid.com/guides/pivot/" target="_blank" rel="noopener noreferrer">Pivot guide ↗</a>
    </header>

    <div class="dashboard-controls" aria-label="Dashboard controls">
      <label>Year
        <select v-model.number="year" aria-label="Year" @change="updateControls">
          <option :value="2025">2025</option>
          <option :value="2024">2024</option>
        </select>
      </label>
      <label>Segment
        <select v-model="segment" aria-label="Segment" @change="updateControls">
          <option value="">All segments</option>
          <option v-for="name in segments" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <fieldset>
        <legend>Compare</legend>
        <label><input v-model="rowField" type="radio" value="Country" @change="updateControls" /> Countries</label>
        <label><input v-model="rowField" type="radio" value="Product" @change="updateControls" /> Products</label>
      </fieldset>
      <button type="button" @click="reset">Reset report</button>
      <button type="button" :aria-expanded="fieldsVisible" @click="fieldsVisible = !fieldsVisible">
        {{ fieldsVisible ? 'Hide fields' : 'Show fields' }}
      </button>
    </div>

    <div class="dashboard-summary" aria-live="polite">
      <strong>{{ currency.format(revenue) }}</strong> revenue
      <span>{{ filteredRows.length.toLocaleString() }} source lines · {{ year }} · {{ segment || 'all segments' }}</span>
    </div>

    <div class="dashboard-layout">
      <div class="dashboard-charts">
        <section class="dashboard-card" aria-label="Quarterly revenue chart">
          <h2>Quarterly revenue by {{ activeRowLabel.toLowerCase() }}</h2>
          <p>Compare Q1–Q4 revenue in the current report.</p>
          <div ref="quarterChartHost" class="chart-host" data-testid="quarter-chart"></div>
        </section>
        <section class="dashboard-card" aria-label="Comparison chart">
          <h2>{{ activeRowLabel }} comparison</h2>
          <p>The same Pivot result in a horizontal view.</p>
          <div ref="comparisonChartHost" class="chart-host" data-testid="comparison-chart"></div>
        </section>
        <p v-if="chartError" class="chart-error" role="alert">{{ chartError }}</p>
      </div>
      <section class="dashboard-card dashboard-report" aria-label="Pivot report">
        <div class="report-heading">
          <h2>Pivot report</h2>
          <span>Revenue (USD) · {{ activeRowLabel }} × Quarter</span>
        </div>
        <div ref="gridHost" class="dashboard-grid">
          <RevoGrid
            hide-attribution
            range
            resize
            readonly
            :source="rows"
            :columns="CHARTS_COLUMNS"
            :pivot.prop="pivot"
            :pivot-charts.prop="FINANCIAL_PIVOT_CHARTS"
            :pivot-charts-ui.prop="FINANCIAL_PIVOT_CHARTS_UI"
            :column-types="FINANCIAL_COLUMN_TYPES"
            :plugins="FINANCIAL_SHOWCASE_PLUGINS"
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
import { mountPivotChart, type PivotChartRef, type PivotConfig } from '@revolist/pivot';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import {
  FINANCIAL_COLUMN_TYPES,
  FINANCIAL_PIVOT_CHARTS,
  FINANCIAL_PIVOT_CHARTS_UI,
  FINANCIAL_SHOWCASE_PLUGINS,
} from './financial.pivot';
import { SALES_TRANSACTIONS_V2 } from './sales-transactions-v2';
import {
  CHARTS_COLUMNS,
  createChartsConfig,
  dashboardRows,
  totalRevenue,
  type DashboardRows,
  type DashboardYear,
} from './charts-dashboard.model';

const rows = shallowRef(SALES_TRANSACTIONS_V2);
const year = ref<DashboardYear>(2025);
const segment = ref('');
const segments = ['Enterprise', 'Government', 'Midmarket', 'Small Business'];
const rowField = ref<DashboardRows>('Country');
const fieldsVisible = ref(window.innerWidth >= 1440);
const pivotConfig = shallowRef<PivotConfig>(createChartsConfig());
const pivot = computed<PivotConfig>(() => ({
  ...pivotConfig.value,
  hasConfigurator: fieldsVisible.value,
}));
const activeRowLabel = computed(() => String(pivotConfig.value.rows?.[0] ?? 'All records'));
const filteredRows = computed(() => dashboardRows(pivotConfig.value, rows.value));
const revenue = computed(() => totalRevenue(filteredRows.value));
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const gridHost = ref<HTMLElement>();
const quarterChartHost = ref<HTMLElement>();
const comparisonChartHost = ref<HTMLElement>();
const chartError = ref('');
const isDark = ref(currentTheme().isDark());
let disconnectTheme: (() => void) | undefined;
let grid: HTMLRevoGridElement | null = null;
let charts: PivotChartRef[] = [];
let mounting = false;
let gridObserver: MutationObserver | undefined;

function updateControls() {
  pivotConfig.value = createChartsConfig(year.value, rowField.value, segment.value);
}

function reset() {
  year.value = 2025;
  segment.value = '';
  rowField.value = 'Country';
  updateControls();
}

function onConfigUpdate(event: CustomEvent<Partial<PivotConfig>>) {
  if (!event.detail) return;
  // The public event is typed as a partial config. Preserve unaffected fields.
  const nextConfig = { ...pivotConfig.value, ...event.detail };
  pivotConfig.value = nextConfig;
  if (nextConfig.rows?.[0] === 'Country' || nextConfig.rows?.[0] === 'Product') {
    rowField.value = nextConfig.rows[0];
  }
  const selectedYear = nextConfig.filterSelections?.Year;
  if (Array.isArray(selectedYear) && (selectedYear[0] === 2024 || selectedYear[0] === 2025)) {
    year.value = selectedYear[0];
  }
  const selectedSegment = nextConfig.filterSelections?.Segment;
  segment.value = Array.isArray(selectedSegment) && typeof selectedSegment[0] === 'string'
    ? selectedSegment[0] : '';
}

async function mountCharts() {
  if (!grid || mounting || charts.length || !quarterChartHost.value || !comparisonChartHost.value) return;
  mounting = true;
  chartError.value = '';
  try {
    charts.push(await mountPivotChart(grid, {
      container: quarterChartHost.value,
      chartType: 'groupedColumn',
      linked: true,
      presentation: { legendPosition: 'bottom', yAxisTitle: 'Revenue (USD)' },
    }));
    charts.push(await mountPivotChart(grid, {
      container: comparisonChartHost.value,
      chartType: 'groupedBar',
      linked: true,
      presentation: { legendPosition: 'bottom', xAxisTitle: 'Revenue (USD)' },
    }));
  } catch (error) {
    charts.forEach((chart) => chart.destroy());
    charts = [];
    chartError.value = `Charts could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    mounting = false;
  }
}

onMounted(async () => {
  disconnectTheme = observeCurrentTheme((value) => { isDark.value = value; });
  await nextTick();
  const connectGrid = () => {
    if (grid) return;
    // The wrapper owns the custom element; this query is only for its public lifecycle event.
    grid = gridHost.value?.querySelector('revo-grid') ?? null;
    if (!grid) return;
    gridObserver?.disconnect();
    grid.addEventListener('pivot-model-changed', mountCharts);
    // The first model may have committed before the listener was attached.
    void mountCharts();
  };
  connectGrid();
  if (!grid && gridHost.value) {
    gridObserver = new MutationObserver(connectGrid);
    gridObserver.observe(gridHost.value, { childList: true, subtree: true });
  }
});

onBeforeUnmount(() => {
  gridObserver?.disconnect();
  grid?.removeEventListener('pivot-model-changed', mountCharts);
  charts.forEach((chart) => chart.destroy());
  disconnectTheme?.();
});
</script>

<style src="./charts-dashboard.scss" lang="scss"></style>

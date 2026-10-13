<template>
  <main class="operations-demo" :class="{ 'is-dark': isDark }">
    <header class="page-header">
      <div>
        <p class="eyebrow">RevoGrid Pivot · support operations</p>
        <h1>Where are tickets breaching SLA?</h1>
        <p>Compare ticket volume, resolution time, and SLA breaches by team and priority. Focus a value cell to inspect its source tickets.</p>
      </div>
      <a href="https://pro.rv-grid.com/guides/pivot/" target="_blank" rel="noreferrer">Pivot guide ↗</a>
    </header>

    <section class="controls" aria-label="Ticket scope">
      <label>Team
        <select v-model="team">
          <option value="All">All teams</option>
          <option v-for="item in TEAMS" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label>Priority
        <select v-model="priority">
          <option value="All">All priorities</option>
          <option v-for="item in PRIORITIES" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <button type="button" @click="reset">Reset scope</button>
    </section>

    <div class="workspace">
      <section class="pivot-panel" aria-labelledby="pivot-heading">
        <div class="panel-heading">
          <div><h2 id="pivot-heading">Pivot summary</h2><p>Focus a value to investigate the underlying tickets.</p></div>
        </div>
        <div class="pivot-grid">
          <RevoGrid
            class="cell-border"
            hide-attribution
            readonly
            resize
            :source="scopedTickets"
            :columns="columns"
            :plugins="plugins"
            :pivot.prop="pivotConfig"
            :theme="isDark ? 'darkCompact' : 'compact'"
            @afterfocus="onPivotFocus"
          />
        </div>
      </section>

      <section class="detail-panel" aria-labelledby="detail-heading">
        <div class="panel-heading">
          <h2 id="detail-heading">Source tickets</h2>
          <div class="detail-actions">
            <button class="inspect-button" type="button" :disabled="!focusedCell" @click="inspectFocusedCell">Inspect focused cell</button>
            <button v-if="cellMode" type="button" @click="showScope">Show selected scope</button>
          </div>
        </div>
        <p class="detail-scope" aria-live="polite">{{ cellMode ? activeLabel : scopeLabel }}</p>
        <p class="detail-description">{{ detailDescription }}</p>
        <RevoGrid
          :key="`${cellMode}:${page}:${team}:${priority}`"
          class="ticket-grid"
          hide-attribution
          readonly
          resize
          :source="detailRows"
          :columns="detailColumns"
          :plugins="detailPlugins"
          :pagination.prop="detailPagination"
          :row-size="44"
          :theme="isDark ? 'darkCompact' : 'compact'"
          @pagechange="onDetailPageChange"
        />
        <p class="detail-page-info">Showing {{ visibleTickets.length ? page * pageSize + 1 : 0 }}–{{ Math.min((page + 1) * pageSize, detailCount) }} of {{ detailCount }}</p>
      </section>
    </div>
    <p class="provenance">Synthetic, deterministic sample · 480 tickets opened in 2025 · dates shown in UTC · no customer data.</p>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import RevoGrid from '@revolist/vue3-datagrid';
import type { ColumnRegular, FocusAfterRenderEvent, GridPlugin } from '@revolist/revogrid';
import { getPivotColumnMeta, getPivotRowMeta, type PivotDrilldownCellRef } from '@revolist/pivot';
import { PaginationPlugin, type PageChangeEvent, type PaginationFullConfig } from '@revolist/revogrid-pro';
import { columns, pivotConfig, plugins } from './pivot';
import { PRIORITIES, TEAMS, TICKETS, pageTickets, ticketsForPivotCell, ticketsInScope, type TicketPriority, type TicketTeam } from './tickets';
import { currentTheme, observeCurrentTheme } from '../../../src/shared/theme';

const team = ref<TicketTeam | 'All'>('All');
const priority = ref<TicketPriority | 'All'>('All');
const isDark = ref(currentTheme().isDark());
let disconnectTheme: (() => void) | undefined;
onMounted(() => { disconnectTheme = observeCurrentTheme(value => { isDark.value = value; }); });
onUnmounted(() => { disconnectTheme?.(); });
const page = ref(0);
const pageSize = 15;
const detailPlugins: GridPlugin[] = [PaginationPlugin];
const detailColumns: ColumnRegular[] = [
  { prop: 'id', name: 'ID', size: 130 },
  { prop: 'team', name: 'Team', size: 125 },
  { prop: 'priority', name: 'Priority', size: 100 },
  { prop: 'category', name: 'Category', size: 130 },
  { prop: 'opened', name: 'Opened', size: 115 },
  { prop: 'resolution', name: 'Resolution', size: 105 },
  { prop: 'sla', name: 'SLA', size: 95 },
];
const focusedCell = ref<PivotDrilldownCellRef | null>(null);
const activeCell = ref<PivotDrilldownCellRef | null>(null);
const focusedLabel = ref('');
const activeLabel = ref('');
const cellMode = ref(false);
const drillTickets = ref<typeof TICKETS>([]);
const drillTotal = ref(0);
const scopedTickets = computed(() => ticketsInScope(TICKETS, { team: team.value, priority: priority.value }));
const detailCount = computed(() => cellMode.value ? drillTotal.value : scopedTickets.value.length);
const detailPagination = computed<PaginationFullConfig>(() => ({
  itemsPerPage: pageSize,
  initialPage: page.value,
  total: detailCount.value,
  totalInfo: false,
  locales: { first: 'First', previous: 'Previous', next: 'Next', last: 'Last' },
}));
const visibleTickets = computed(() => cellMode.value ? drillTickets.value : pageTickets(scopedTickets.value, page.value, pageSize));
const detailRows = computed(() => visibleTickets.value.map(ticket => ({
  id: ticket['Ticket ID'],
  team: ticket.Team,
  priority: ticket.Priority,
  category: ticket.Category,
  opened: ticket['Opened At'].slice(0, 10),
  resolution: ticket['Resolution Hours'] === null ? 'Open' : `${ticket['Resolution Hours']} h`,
  sla: ticket['SLA Status'],
})));
const scopeLabel = computed(() => `${team.value === 'All' ? 'All teams' : team.value} · ${priority.value === 'All' ? 'All priorities' : priority.value}`);
const detailDescription = computed(() => {
  if (!cellMode.value) return 'These records are the input to the pivot above for the selected scope. Open tickets do not contribute to average resolution time.';
  if (activeCell.value?.dataIndex === 1) return 'Resolved tickets contributing to the focused average. Open tickets have no resolution time.';
  if (activeCell.value?.dataIndex === 2) return 'Tickets contributing to the focused SLA breach count.';
  return 'Tickets contributing to the focused ticket count.';
});
watch([team, priority], () => { showScope(); focusedCell.value = null; });
function reset() { team.value = 'All'; priority.value = 'All'; showScope(); focusedCell.value = null; }
function showScope() { activeCell.value = null; cellMode.value = false; page.value = 0; }

function onPivotFocus(event: CustomEvent<FocusAfterRenderEvent>) {
  const row = getPivotRowMeta(event.detail.model);
  const column = getPivotColumnMeta(event.detail.column);
  if (!row || !column?.measure || !column.prop) {
    focusedCell.value = null;
    return;
  }
  focusedCell.value = { rowPath: [...row.path], columnPath: [...column.path], dataIndex: column.measure.valueIndex };
  const rowLabel = team.value === 'All' ? row.labels.join(' / ') || 'All teams' : team.value;
  const columnLabel = priority.value === 'All' ? column.labels.join(' / ') || 'All priorities' : priority.value;
  focusedLabel.value = `${rowLabel} · ${columnLabel} · ${column.measure.label}`;
}

function loadDrillPage(nextPage: number) {
  if (!activeCell.value) return;
  const records = ticketsForPivotCell(scopedTickets.value, activeCell.value);
  drillTickets.value = pageTickets(records, nextPage, pageSize);
  drillTotal.value = records.length;
  page.value = nextPage;
  cellMode.value = true;
}
function inspectFocusedCell() {
  if (!focusedCell.value) return;
  // Focus prepares the next inspection; the current label stays with its records.
  activeCell.value = focusedCell.value;
  activeLabel.value = focusedLabel.value;
  loadDrillPage(0);
}
function changePage(nextPage: number) {
  if (cellMode.value) loadDrillPage(nextPage);
  else page.value = nextPage;
}
function onDetailPageChange(event: CustomEvent<PageChangeEvent>) { changePage(event.detail.skip); }
</script>

<style scoped>
.operations-demo {
  --ops-ink: #242424;
  --ops-muted: #606060;
  --ops-card: #fff;
  --ops-input: #fff;
  --ops-border: #dedede;
  --ops-accent: var(--rv-ui-accent, #087f68);
  box-sizing: border-box;
  min-height: 100%;
  padding: 18px 22px;
  color: var(--ops-ink);
  font: 14px/1.45 system-ui, sans-serif;
}
.operations-demo.is-dark {
  --ops-ink: #e8e8e8;
  --ops-muted: #b5b5b5;
  --ops-card: #242424;
  --ops-input: #2d2d2d;
  --ops-border: #404040;
  --ops-accent: var(--rv-ui-accent, #087f68);
}
.page-header, .controls, .workspace, .provenance { max-width: 1500px; margin-left: auto; margin-right: auto; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.page-header h1 { margin: 2px 0 6px; font-size: clamp(25px, 2.6vw, 34px); line-height: 1.15; letter-spacing: -.025em; }
.page-header p { max-width: 780px; margin: 0; color: var(--ops-muted); }
.page-header a { margin-top: 8px; color: var(--ops-accent); font-weight: 650; white-space: nowrap; }
.eyebrow { color: var(--ops-accent) !important; font-size: 11px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
.controls { display: flex; align-items: center; gap: 10px 18px; flex-wrap: wrap; padding: 4px 0; background: transparent; border: 0; }
.controls label { display: flex; align-items: center; gap: 8px; font-weight: 650; }
.controls select, .controls button, .detail-actions button { min-height: 34px; padding: 5px 10px; color: var(--ops-ink); background: var(--ops-input); border: 1px solid var(--ops-border); border-radius: 7px; font: inherit; }
.controls button, .detail-actions button { cursor: pointer; }
.controls :is(select, button):focus-visible, .detail-actions button:focus-visible { outline: 2px solid var(--ops-accent); outline-offset: 2px; }
.workspace { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; }
.pivot-panel, .detail-panel { display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--ops-card); border: 1px solid var(--ops-border); border-radius: 11px; box-shadow: 0 2px 10px #15334a0a; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--ops-border); }
.panel-heading h2 { margin: 0; padding: 0; border: 0; font-size: 16px; line-height: 1.3; }
.panel-heading p { margin: 2px 0 0; color: var(--ops-muted); font-size: 12px; }
.pivot-panel > :is(.pivot-grid, .pivot-plugin) { display: flex; flex: 1; min-height: 470px; overflow: auto; }
.pivot-panel revo-grid { flex: 1; min-width: 620px; min-height: 0; }
.detail-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.detail-actions .inspect-button { color: var(--rv-ui-accent-fg, #fff); background: var(--ops-accent); border-color: var(--ops-accent); font-weight: 650; }
.detail-actions button:disabled { opacity: .48; cursor: not-allowed; }
.detail-scope { margin: 8px 14px 0; color: var(--ops-ink); font-size: 12px; font-weight: 700; }
.detail-description, .detail-page-info, .provenance { color: var(--ops-muted); font-size: 12px; }
.detail-description { margin: 4px 14px 10px; }
.ticket-grid { display: block; width: 100%; height: 400px; }
.detail-page-info { margin: 8px 14px; font-variant-numeric: tabular-nums; }
.provenance { padding: 9px 2px 0; }
@media (max-width: 1050px) { .workspace { grid-template-columns: 1fr; } }
@media (max-width: 650px) {
  .operations-demo { padding: 12px; }
  .page-header { display: block; }
  .page-header a { display: inline-block; margin-top: 9px; }
  .controls label { width: 100%; justify-content: space-between; }
  .controls select { min-width: 158px; }
  .panel-heading { align-items: flex-start; flex-wrap: wrap; }
  .detail-actions { width: 100%; }
  .detail-actions button { flex: 1; }
  .pivot-panel > :is(.pivot-grid, .pivot-plugin) { min-height: 410px; }
}
</style>

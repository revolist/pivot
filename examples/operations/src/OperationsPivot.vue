<template>
  <main class="operations-demo">
    <header class="page-header">
      <div>
        <p class="eyebrow">RevoGrid Pivot · support operations</p>
        <h1>Where are tickets breaching SLA?</h1>
        <p>Compare volume, average resolution time, and breaches by team and priority. Select a scope to inspect its source tickets.</p>
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
      <span class="scope-count" aria-live="polite">{{ summary.count }} source tickets</span>
    </section>
    <div class="scope-divider" aria-hidden="true"></div>

    <div class="workspace">
      <section class="pivot-panel" aria-labelledby="pivot-heading">
        <div class="panel-heading"><h2 id="pivot-heading">Pivot summary</h2></div>
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
            theme="compact"
            @afterfocus="onPivotFocus"
          />
        </div>
      </section>

      <section class="detail-panel" aria-labelledby="detail-heading">
        <div class="panel-heading">
          <h2 id="detail-heading">Source tickets</h2>
          <div class="detail-actions">
            <button type="button" :disabled="!focusedCell" @click="inspectFocusedCell">Inspect focused value cell</button>
            <button v-if="cellMode" type="button" @click="showScope">Show selected scope</button>
          </div>
          <span>{{ cellMode ? focusedLabel : scopeLabel }}</span>
        </div>
        <p class="detail-description">{{ cellMode ? 'Showing the source records for the focused pivot value cell.' : 'These records are the exact input to the pivot above for the selected scope.' }} Open tickets do not contribute to average resolution time.</p>
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
          theme="compact"
          @pagechange="onDetailPageChange"
        />
        <p class="detail-page-info">Showing {{ visibleTickets.length ? page * pageSize + 1 : 0 }}–{{ Math.min((page + 1) * pageSize, detailCount) }} of {{ detailCount }}</p>
      </section>
    </div>
    <p class="provenance">Synthetic, deterministic sample · 480 tickets opened in 2025 · dates shown in UTC · no customer data.</p>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import RevoGrid from '@revolist/vue3-datagrid';
import type { ColumnRegular, FocusAfterRenderEvent, GridPlugin } from '@revolist/revogrid';
import { getPivotColumnMeta, getPivotRowMeta, type PivotDrilldownCellRef } from '@revolist/pivot';
import { PaginationPlugin, type PageChangeEvent, type PaginationFullConfig } from '@revolist/revogrid-pro';
import { columns, pivotConfig, plugins } from './pivot';
import { PRIORITIES, TEAMS, TICKETS, pageTickets, summarizeTickets, ticketsForPivotCell, ticketsInScope, type TicketPriority, type TicketTeam } from './tickets';

const team = ref<TicketTeam | 'All'>('All');
const priority = ref<TicketPriority | 'All'>('All');
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
const cellMode = ref(false);
const drillTickets = ref<typeof TICKETS>([]);
const drillTotal = ref(0);
const scopedTickets = computed(() => ticketsInScope(TICKETS, { team: team.value, priority: priority.value }));
const summary = computed(() => summarizeTickets(scopedTickets.value));
const detailCount = computed(() => cellMode.value ? drillTotal.value : summary.value.count);
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
  focusedLabel.value = `${row.labels.join(' / ') || 'All teams'} · ${column.labels.join(' / ') || 'All priorities'} · ${column.measure.label}`;
}

function loadDrillPage(nextPage: number) {
  if (!activeCell.value) return;
  const records = ticketsForPivotCell(scopedTickets.value, activeCell.value);
  drillTickets.value = pageTickets(records, nextPage, pageSize);
  drillTotal.value = records.length;
  page.value = nextPage;
  cellMode.value = true;
}
function inspectFocusedCell() { activeCell.value = focusedCell.value; loadDrillPage(0); }
function changePage(nextPage: number) {
  if (cellMode.value) loadDrillPage(nextPage);
  else page.value = nextPage;
}
function onDetailPageChange(event: CustomEvent<PageChangeEvent>) { changePage(event.detail.skip); }
</script>

<style scoped>
.operations-demo{font:14px/1.5 system-ui,sans-serif;color:#253040;background:transparent;min-height:100vh;padding:24px;box-sizing:border-box}
.page-header,.controls,.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-header{align-items:start;max-width:1500px;margin:auto auto 20px}.page-header h1{font-size:clamp(26px,3vw,38px);line-height:1.15;margin:4px 0 8px}.page-header p{margin:0;color:#596779}.page-header a{white-space:nowrap;color:#087e66;font-weight:600}.eyebrow{color:#087e66!important;text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:700}
.controls,.workspace,.provenance{max-width:1500px;margin-left:auto;margin-right:auto}.controls{justify-content:flex-start;background:#fff;padding:12px 16px;flex-wrap:wrap}.controls label{display:flex;align-items:center;gap:8px;font-weight:600}.controls select,.controls button{font:inherit;background:#fff;border:1px solid #bdc9d6;border-radius:7px;padding:7px 10px;color:inherit}.controls button{cursor:pointer}.scope-count{margin-left:auto;color:#596779}
.scope-divider{border-top:1px solid #dce4ed;margin:12px -24px 0}.pivot-panel,.detail-panel{background:#fff}.panel-heading span,.detail-description,.detail-page-info,.provenance{color:#617084;font-size:12px}.workspace{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;margin-top:12px}.pivot-panel,.detail-panel{min-width:0;overflow:hidden}.pivot-panel{display:flex;flex-direction:column}.panel-heading{padding:12px 16px;border-bottom:1px solid #e5ebf1}.panel-heading h2{font-size:16px;line-height:1.5;margin:0;padding:0;border:0}.pivot-panel > :is(.pivot-grid,.pivot-plugin){display:flex;flex:1;min-height:530px;overflow:auto}.pivot-panel revo-grid{flex:1;min-width:620px;min-height:0}.ticket-grid{display:block;width:100%;height:430px}.detail-page-info{margin:8px 16px}.provenance{padding:8px 2px}
@media(max-width:1050px){.workspace{grid-template-columns:1fr}}@media(max-width:600px){.operations-demo{padding:12px}.scope-divider{margin-left:-12px;margin-right:-12px}.page-header{display:block}.page-header a{display:inline-block;margin-top:12px}.controls label{width:100%;justify-content:space-between}.scope-count{margin-left:0}}
.detail-panel .panel-heading{justify-content:flex-start;flex-wrap:wrap;padding-top:6px;padding-bottom:6px}.detail-panel .panel-heading > span{margin-left:auto}.detail-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.detail-actions button{font:inherit;background:#fff;border:1px solid #bdc9d6;border-radius:7px;padding:5px 10px;cursor:pointer}.detail-actions button:disabled{opacity:.45;cursor:not-allowed}
.ticket-grid :deep(.rv-pagination-panel){font-size:13px}.ticket-grid :deep(.rv-pagination-panel button),.ticket-grid :deep(.rv-pagination-panel select){font:inherit}
</style>

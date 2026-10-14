<template>
  <main ref="workspace" class="import-pivot" :class="{ 'is-dark': isDark, 'is-exploring': step === 3 }">
    <header v-if="step === 3" class="import-topbar">
      <div class="import-report-source"><span class="import-file-symbol"><ImportIcon name="file" /></span><div><strong>{{ acceptedName }}</strong><small>{{ acceptedSheet }} <span>·</span> {{ reportRows.length.toLocaleString() }} rows <span>·</span> {{ acceptedFields.length }} fields</small></div></div><div class="import-report-actions"><button type="button" class="import-btn" @click="reviewData">Review data</button><button type="button" class="import-btn" @click="replaceFile">Replace file</button></div>
    </header>
    <input ref="fileInput" class="import-sr-only" tabindex="-1" type="file" accept=".xlsx,.csv" aria-label="Choose Excel or CSV file" @change="onFileInput" />
    <div v-if="error" class="import-alert" role="alert"><span>{{ error }}</span><button type="button" aria-label="Dismiss error" @click="error = ''"><ImportIcon name="close" /></button></div>

    <section v-if="step === 1" class="import-welcome" aria-labelledby="import-title">
      <div class="import-intro">
        <span class="import-eyebrow">Import data</span>
        <h1 id="import-title">Analyze your spreadsheet</h1>
        <p>Open a file, review your fields, and build an interactive pivot.</p>
      </div>
      <div class="import-upload-card" :class="{ 'is-dragging': dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
        <div class="import-file-art"><ImportIcon :name="busy ? 'upload' : 'file'" /></div>
        <h2>{{ busy ? 'Reading your spreadsheet…' : 'Drop your file here' }}</h2>
        <p>{{ busy ? 'Finding sheets, headers, and fields.' : 'Browse your device or drag an Excel or CSV file here.' }}</p>
        <button v-if="!busy" class="import-btn import-primary" type="button" @click="chooseFile"><ImportIcon name="upload" /> Choose a file</button>
        <button v-else class="import-btn" type="button" @click="cancelImport">Cancel import</button>
        <span class="import-upload-formats">.xlsx · .csv <span>up to 10 MB</span></span>
      </div>
      <div class="import-sample-row"><span>Explore with an example</span><button type="button" :disabled="busy" @click="loadSample">Try sample sales data <ImportIcon name="arrow" /></button></div>
      <p class="import-reassurance"><ImportIcon name="lock" /> Files are processed on your device. Nothing is uploaded.</p>
    </section>

    <section v-else-if="step === 2" class="import-review" aria-labelledby="import-review-title">
      <div class="import-section-heading"><div><span class="import-eyebrow">Review import</span><h1 id="import-review-title">Review your data</h1><p>Check the worksheet, headers, and field types before creating your pivot.</p></div><button class="import-btn" type="button" @click="replaceFile"><ImportIcon name="reset" /> Choose another file</button></div>
      <div class="import-review-card">
        <div class="import-file-summary"><span class="import-file-symbol"><ImportIcon name="file" /></span><div><strong>{{ workbook?.name }}</strong><small>{{ workbook?.sheets.length }} sheet{{ workbook?.sheets.length === 1 ? '' : 's' }} available · processed locally</small></div><span class="import-detected"><ImportIcon name="check" /> Ready to import</span></div>
        <div class="import-review-controls">
          <label>Worksheet<select v-model.number="sheetIndex" aria-label="Worksheet"><option v-for="(sheet, i) in workbook?.sheets" :key="sheet.name" :value="i">{{ sheet.name }}</option></select></label>
          <label>Header row<input v-model.number="headerRow" type="number" min="1" :max="Math.max(1, cells.length - 1)" aria-label="Header row" /></label>
          <label>Decimal separator<select v-model="decimal" aria-label="Decimal separator"><option value=".">Point (1234.56)</option><option value=",">Comma (1234,56)</option></select></label>
          <details class="import-range"><summary>Data range</summary><div><label>First data row<input v-model.number="firstRow" type="number" :min="headerRow + 1" :max="cells.length" /></label><label>Last data row<input v-model.number="lastRow" type="number" :min="firstRow" :max="cells.length" /></label></div></details>
        </div>
        <div v-if="inspectionError" class="import-inline-warning" role="alert">{{ inspectionError }}</div>
        <template v-else>
          <div class="import-preview-heading"><h2>Data preview <span>{{ table.source.length.toLocaleString() }} rows · {{ fields.length }} fields</span></h2><span>Change a type below if needed</span></div>
          <div class="import-preview-scroll"><table class="import-preview-table"><thead><tr><th v-for="field in fields" :key="field.key"><span>{{ field.name }}</span><select v-model="field.type" :aria-label="`Type for ${field.name}`"><option value="text">Aa Text</option><option value="number"># Number</option><option value="date">◷ Date (ISO)</option></select></th></tr></thead><tbody><tr v-for="(row, i) in table.source.slice(0, 5)" :key="i"><td v-for="(field, j) in fields" :key="field.key" :title="displayCell(row[j])" :class="{ 'is-number': field.type === 'number' }">{{ displayCell(row[j]) || '—' }}</td></tr></tbody></table></div>
          <p class="import-preview-caption">Showing {{ Math.min(5, table.source.length) }} preview rows. Your pivot will include all {{ table.source.length.toLocaleString() }} selected rows.</p>
          <div v-if="mixedFields.length" class="import-inline-warning">Mixed values detected in {{ mixedFields.join(', ') }}. Kept as Text so every value is preserved.</div>
          <div v-if="prepared.errors.length" class="import-inline-warning" role="alert"><p v-for="message in prepared.errors" :key="message">{{ message }}</p></div>
        </template>
        <div class="import-review-footer"><span><ImportIcon name="lock" /> Processed on your device</span><span>Excel formulas use saved results. Dates use ISO format.</span></div>
      </div>
      <div class="import-create-row"><div class="import-suggestion"><span><ImportIcon name="table" /></span><div><small>Suggested report</small><strong>{{ suggestion.label }}</strong><p>You can change every field in the next step.</p></div></div><div class="import-create-actions"><button type="button" class="import-btn" :disabled="!canCreate" @click="createReport(true)">Start empty</button><button type="button" class="import-btn import-primary" :disabled="!canCreate" @click="createReport(false)">Create pivot <ImportIcon name="arrow" /></button></div></div>
    </section>

    <section v-else class="import-explore" aria-label="Pivot workspace">
      <div class="import-report-body">
        <section class="import-results" aria-label="Report results">
          <div class="import-report-toolbar"><div class="import-view-tabs" role="tablist" aria-label="Data view"><button v-for="view in views" :key="view.id" type="button" role="tab" :aria-selected="activeView === view.id" @click="changeView(view.id)"><ImportIcon :name="view.icon" />{{ view.label }}</button></div><div><button type="button" class="import-btn import-fields-toggle" :aria-expanded="fieldsOpen" @click="openFields"><ImportIcon name="fields" /> Fields</button><button type="button" class="import-btn" :disabled="activeView === 'source' || !pivot?.values.length" @click="exportCsv"><ImportIcon name="download" /> Export CSV</button></div></div>
          <div class="import-report-caption"><div><h2>{{ reportTitle }}</h2><p>{{ activeView === 'source' ? 'Original selected records, with your accepted field types.' : 'Arrange fields and choose aggregations in the field builder.' }}</p></div><button type="button" class="import-reset" @click="resetReport">Reset layout</button></div>
          <div v-show="activeView === 'pivot'" class="import-pivot-stage">
            <div v-if="!pivot?.values.length" class="import-empty-report"><span><ImportIcon name="table" /></span><h3>Build your first report</h3><p>Add a field to Values in the field builder to create your report.</p><button class="import-btn" type="button" @click="openFields">Open field builder →</button></div>
            <RevoGrid v-if="pivot" :key="reportVersion" class="import-result-grid cell-border" hide-attribution readonly resize :source="reportRows" :columns="reportColumns" :plugins="plugins" :pivot.prop="pivot" :pivot-charts.prop="chartConfig" :theme="isDark ? 'darkCompact' : 'compact'" :row-size="38" :col-size="165" stretch @aftergridinit="onGridReady" @pivot-config-update="onConfigUpdate" />
          </div>
          <RevoGrid v-if="activeView === 'source'" class="import-source-grid cell-border" hide-attribution readonly resize :source="reportRows" :columns="sourceColumns" :theme="isDark ? 'darkCompact' : 'compact'" :row-size="38" />
          <div v-show="activeView === 'chart'" ref="chartHost" class="import-chart" aria-label="Pivot chart" />
          <div class="import-report-status"><span><i></i> All {{ reportRows.length.toLocaleString() }} selected rows included</span><span>Browser only · no data saved</span></div>
        </section>
        <button v-if="fieldsOpen" type="button" class="import-fields-backdrop" aria-label="Close field builder" @click="closeFields" />
        <aside ref="fieldsAside" class="import-fields" :class="{ 'is-open': fieldsOpen }" aria-label="Build your pivot" :role="fieldsOpen ? 'dialog' : undefined" :aria-modal="fieldsOpen ? true : undefined" @keydown="onFieldsKeydown"><div class="import-fields-heading"><div><h2>Build your pivot</h2></div><button class="import-fields-close" type="button" aria-label="Close field builder" @click="closeFields"><ImportIcon name="close" /></button></div><p class="import-fields-hint">Drag a field, or use its menu to choose an area.</p><div ref="configuratorHost" class="import-configurator" /></aside>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import RevoGrid from '@revolist/vue3-datagrid';
import ImportIcon from './ImportIcon.vue';
import { PivotPlugin, PivotChartsPlugin, PivotChartsUiPlugin, createPivotChartsRenderer, type PivotConfig, type PivotChartRef } from '@revolist/pivot';
import type { GridPlugin } from '@revolist/revogrid';
import { observeCurrentTheme } from '../../../src/shared/theme';
import { exportFinancialCsv, financialActionError, mountFinancialChart } from '../../../src/financial.actions';
import { createImportPivot, detectHeader, displayCell, inspectTable, prepareSource, sampleWorkbook, suggestReport } from './import.model';
import { LIMITS, type Field, type Matrix, type Workbook } from './import.types';
import './style.css';

const step = ref(1), error = ref(''), busy = ref(false), dragging = ref(false), isDark = ref(false);
const fileInput = ref<HTMLInputElement>();
const workspace = ref<HTMLElement>();
const workbook = shallowRef<Workbook>();
const sheetIndex = ref(0), headerRow = ref(1), firstRow = ref(2), lastRow = ref(2);
const decimal = ref<'.' | ','>('.');
const fields = ref<Field[]>([]);
const cells = computed<Matrix>(() => workbook.value?.sheets[sheetIndex.value]?.cells ?? []);
const inspectionError = ref('');
const table = computed(() => {
  try { return inspectTable(cells.value, headerRow.value, firstRow.value, lastRow.value, decimal.value); }
  catch { return { fields: [], source: [] as Matrix }; }
});
function refreshFields() {
  try {
    fields.value = inspectTable(cells.value, headerRow.value, firstRow.value, lastRow.value, decimal.value).fields;
    inspectionError.value = '';
  } catch (reason) { fields.value = []; inspectionError.value = String((reason as Error).message); }
}
watch(cells, () => {
  headerRow.value = detectHeader(cells.value);
  firstRow.value = headerRow.value + 1;
  lastRow.value = cells.value.length;
  refreshFields();
});
watch(decimal, refreshFields);
watch(headerRow, () => { firstRow.value = headerRow.value + 1; refreshFields(); });
watch([firstRow, lastRow], refreshFields);
const prepared = computed(() => prepareSource(table.value.source, fields.value, decimal.value));
const mixedFields = computed(() => fields.value.filter(field => field.mixed && field.type === 'text').map(field => field.name));
const suggestion = computed(() => suggestReport(fields.value));
const canCreate = computed(() => !inspectionError.value && table.value.source.length > 0 && fields.value.length > 0 && !prepared.value.errors.length);
let worker: Worker | undefined;
let importGeneration = 0;
function cancelImport() { importGeneration++; worker?.terminate(); worker = undefined; busy.value = false; }
function chooseFile() { if (fileInput.value) { fileInput.value.value = ''; fileInput.value.click(); } }
function onFileInput(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (file) readFile(file); }
function onDrop(event: DragEvent) { dragging.value = false; const file = event.dataTransfer?.files[0]; if (file) readFile(file); }
function readFile(file: File) {
  cancelImport(); error.value = '';
  if (!/\.(xlsx|csv)$/i.test(file.name)) { error.value = 'Choose an Excel (.xlsx) or CSV (.csv) file.'; return; }
  if (file.size > LIMITS.bytes) { error.value = 'Choose a file smaller than 10 MB.'; return; }
  busy.value = true;
  const generation = importGeneration;
  try {
    worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => {
      if (generation !== importGeneration) return;
      if (event.data.error) error.value = event.data.error;
      else acceptWorkbook(event.data.workbook);
      worker?.terminate(); worker = undefined; busy.value = false;
    };
    worker.onerror = () => { if (generation === importGeneration) { error.value = 'Could not read this file. Save it as XLSX or UTF-8 CSV and try again.'; cancelImport(); } };
    worker.postMessage(file);
  } catch { error.value = 'File processing is unavailable in this browser. Please try a current browser.'; cancelImport(); }
}
function acceptWorkbook(value: Workbook) { workbook.value = value; sheetIndex.value = 0; step.value = 2; focusHeading('import-review-title'); }
function loadSample() { cancelImport(); error.value = ''; acceptWorkbook(sampleWorkbook()); }
function focusHeading(id: string) { void nextTick(() => { const heading = workspace.value?.querySelector<HTMLElement>(`#${id}`); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true }); workspace.value?.scrollTo({ top: 0 }); }); }

const pivot = shallowRef<PivotConfig>();
const reportRows = shallowRef<Record<string, string | number | null>[]>([]);
const acceptedFields = shallowRef<Field[]>([]);
const acceptedName = ref(''), acceptedSheet = ref('');
const configuratorHost = ref<HTMLElement>(), fieldsAside = ref<HTMLElement>();
const grid = shallowRef<HTMLRevoGridElement>();
const reportVersion = ref(0), fieldsOpen = ref(false);
const views = [{ id: 'pivot', label: 'Pivot', icon: 'table' }, { id: 'source', label: 'Source data', icon: 'file' }, { id: 'chart', label: 'Chart', icon: 'chart' }] as const;
type View = typeof views[number]['id'];
const activeView = ref<View>('pivot');
const plugins = [PivotPlugin, PivotChartsPlugin, PivotChartsUiPlugin] as GridPlugin[];
const chartConfig = { renderer: createPivotChartsRenderer({ fontFamily: 'inherit' }), defaultChartType: 'groupedColumn' as const };
const sourceColumns = computed(() => acceptedFields.value.map(field => ({ prop: field.key, name: field.name, size: 170 })));
const reportColumns = computed(() => [...sourceColumns.value, { prop: 'record_count', name: 'Record count', size: 160 }]);
const reportTitle = computed(() => {
  if (activeView.value === 'source') return 'Behind the numbers';
  const value = pivot.value?.values[0];
  if (!value) return 'Your pivot';
  const measure = acceptedFields.value.find(field => field.key === value.prop)?.name ?? 'Record count';
  const category = acceptedFields.value.find(field => field.key === pivot.value?.rows[0])?.name;
  return `${measure}${category ? ` by ${category}` : ''}`;
});
async function createReport(startEmpty: boolean) {
  if (!canCreate.value) return;
  disposeChart(); grid.value = undefined;
  reportRows.value = prepared.value.rows;
  acceptedFields.value = fields.value.map(field => ({ ...field }));
  acceptedName.value = workbook.value?.name ?? ''; acceptedSheet.value = workbook.value?.sheets[sheetIndex.value].name ?? '';
  pivot.value = undefined; step.value = 3; activeView.value = 'pivot'; fieldsOpen.value = false;
  await nextTick();
  workspace.value?.scrollTo({ top: 0 });
  pivot.value = createImportPivot(acceptedFields.value, startEmpty, configuratorHost.value);
  reportVersion.value++;
}
function onGridReady(event: Event) { grid.value = event.target as HTMLRevoGridElement; }
function onConfigUpdate(event: Event) { const detail = (event as CustomEvent<PivotConfig>).detail; if (detail) pivot.value = detail; }
function reviewData() { disposeChart(); pivot.value = undefined; grid.value = undefined; step.value = 2; error.value = ''; focusHeading('import-review-title'); }
function replaceFile() { cancelImport(); disposeChart(); pivot.value = undefined; grid.value = undefined; workbook.value = undefined; reportRows.value = []; acceptedFields.value = []; step.value = 1; error.value = ''; fieldsOpen.value = false; focusHeading('import-title'); }
function resetReport() { disposeChart(); activeView.value = 'pivot'; pivot.value = createImportPivot(acceptedFields.value, false, configuratorHost.value); reportVersion.value++; }
const chartHost = ref<HTMLElement>();
let chart: PivotChartRef | undefined;
let chartGeneration = 0;
function disposeChart() { chartGeneration++; chart?.destroy(); chart = undefined; }
async function changeView(view: View) {
  error.value = '';
  if (view !== 'chart') { activeView.value = view; return; }
  if (!grid.value || !pivot.value?.values.length) { error.value = 'Add a field to Values before opening a chart.'; return; }
  activeView.value = view;
  await nextTick();
  if (chart || !chartHost.value) return;
  const generation = ++chartGeneration;
  try {
    const result = await mountFinancialChart(grid.value, chartHost.value, reportTitle.value);
    if (generation !== chartGeneration) result.destroy(); else chart = result;
  } catch (reason) { if (generation === chartGeneration) { error.value = financialActionError(reason); activeView.value = 'pivot'; } }
}
async function exportCsv() { try { if (grid.value) await exportFinancialCsv(grid.value); } catch { error.value = 'The report is still getting ready. Please try exporting again.'; } }
let fieldsTrigger: HTMLElement | null = null;
function openFields() {
  fieldsTrigger = document.activeElement as HTMLElement;
  if (!window.matchMedia('(max-width: 900px)').matches) { fieldsAside.value?.querySelector<HTMLElement>('input, button')?.focus(); return; }
  fieldsOpen.value = true;
  void nextTick(() => fieldsAside.value?.querySelector<HTMLButtonElement>('.import-fields-close')?.focus());
}
function closeFields() { fieldsOpen.value = false; fieldsTrigger?.focus(); }
function onFieldsKeydown(event: KeyboardEvent) {
  if (!fieldsOpen.value) return;
  if (event.key === 'Escape') { event.preventDefault(); closeFields(); }
  if (event.key === 'Tab') {
    const focusable = [...(fieldsAside.value?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [tabindex="0"]') ?? [])].filter(element => element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
}
function onDrawerEscape(event: KeyboardEvent) {
  if (fieldsOpen.value && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeFields(); }
}
function onResize() { if (fieldsOpen.value && !window.matchMedia('(max-width: 900px)').matches) closeFields(); }
let disconnectTheme: (() => void) | undefined;
onMounted(() => {
  disconnectTheme = observeCurrentTheme(dark => { isDark.value = dark; });
  document.addEventListener('keydown', onDrawerEscape, true);
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  cancelImport(); disposeChart(); disconnectTheme?.();
  document.removeEventListener('keydown', onDrawerEscape, true);
  window.removeEventListener('resize', onResize);
});
</script>

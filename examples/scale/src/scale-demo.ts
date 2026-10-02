import { defineCustomElements } from '@revolist/revogrid/loader';
import {
  PIVOT_MODEL_CHANGED_EVENT,
  PivotPlugin,
  type PivotConfig,
  type PivotModelChangedEventDetail,
} from '@revolist/pivot';
import { generateScaleRowsAsync } from './data';
import { createScalePivotConfig } from './pivot-config';
import '@revolist/revogrid-pro/styles.css';
import '@revolist/pivot/styles.css';
import './style.css';

defineCustomElements();

export function mountScaleDemo(app: HTMLElement) {
app.innerHTML = `
  <section class="scale-demo" aria-label="Pivot at scale">
    <header class="scale-header">
      <p class="eyebrow">Pivot at scale · synthetic USD transactions</p>
      <h1>Explore how workload size affects a Pivot report</h1>
      <p>Choose a workload, inspect measured stages, then change the row hierarchy. Results describe this browser and device only.</p>
    </header>
    <div class="scale-controls">
      <nav class="scale-workloads" role="tablist" aria-label="Client workload">
        <button type="button" role="tab" aria-selected="true" tabindex="0" data-count="10000">10K rows</button>
        <button type="button" role="tab" aria-selected="false" tabindex="-1" data-count="100000">100K rows</button>
        <button type="button" role="tab" aria-selected="false" tabindex="-1" data-count="1000000" title="Opt in: generation and Pivot processing may use substantial memory">1M rows · opt in</button>
      </nav>
      <p id="status" class="scale-status" role="status">Preparing 10K rows…</p>
      <div class="scale-actions">
        <button type="button" data-action="interaction">Switch row hierarchy</button>
      </div>
    </div>
    <div id="grid-host" class="grid-host"></div>
    <section class="scale-performance" aria-label="Browser performance metrics">
      <div class="scale-performance-heading">
        <strong>Performance</strong>
        <span class="scale-performance-context">Measured live in this browser</span>
      </div>
      <div class="scale-performance-metric">
        <div class="scale-performance-label">Data generation <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About data generation" aria-describedby="scale-generation-tooltip">?</button><span id="scale-generation-tooltip" class="scale-metric-tooltip" role="tooltip">Time spent generating the selected synthetic rows in this browser.</span></span></div>
        <strong id="generation">—</strong>
      </div>
      <div class="scale-performance-metric">
        <div class="scale-performance-label">Pivot apply <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About Pivot apply" aria-describedby="scale-aggregation-tooltip">?</button><span id="scale-aggregation-tooltip" class="scale-metric-tooltip" role="tooltip">Time from source or config assignment to the public model-change event, including queueing. This is not a pure aggregation benchmark.</span></span></div>
        <strong id="aggregation">—</strong>
      </div>
      <div class="scale-performance-metric">
        <div class="scale-performance-label">Paint estimate <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About paint estimate" aria-describedby="scale-render-tooltip">?</button><span id="scale-render-tooltip" class="scale-metric-tooltip" role="tooltip">Time from the model-change event through the next two animation frames. This is not a browser render profile.</span></span></div>
        <strong id="render">—</strong>
      </div>
      <div class="scale-performance-metric">
        <div class="scale-performance-label">Layout interaction <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About layout interaction" aria-describedby="scale-interaction-tooltip">?</button><span id="scale-interaction-tooltip" class="scale-metric-tooltip" role="tooltip">Measured after switching the row hierarchy. Shows Pivot apply / paint estimate in milliseconds; available for client workloads.</span></span></div>
        <strong id="interaction">—</strong>
      </div>
      <div class="scale-performance-metric">
        <div class="scale-performance-label">Workload <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About workload" aria-describedby="scale-workload-tooltip">?</button><span id="scale-workload-tooltip" class="scale-metric-tooltip" role="tooltip">Selected source row count in this browser.</span></span></div>
        <strong id="workload">—</strong>
      </div>
    </section>
  </section>`;

const status = app.querySelector<HTMLElement>('#status')!;
const gridHost = app.querySelector<HTMLElement>('#grid-host')!;
const output = (id: string, value: string) => { app.querySelector<HTMLElement>(`#${id}`)!.textContent = value; };
const formatMs = (value: number) => `${value.toFixed(1)} ms`;
const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);
let grid: HTMLRevoGridElement | undefined;
let currentCount = 0;
let generation = 0;
let layout = false;
let runToken = 0;

const workloadTabs = Array.from(app.querySelectorAll<HTMLButtonElement>('.scale-workloads button'));
function setActiveWorkload(count: number | null) {
  workloadTabs.forEach((tab, index) => {
    const selected = Number(tab.dataset.count) === count;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected || (count === null && index === 0) ? 0 : -1;
  });
}

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function makeGrid(config: PivotConfig): HTMLRevoGridElement {
  grid?.remove();
  const next = createGrid(config);
  grid = next;
  return next;
}

function createGrid(config: PivotConfig): HTMLRevoGridElement {
  const next = document.createElement('revo-grid');
  next.className = 'scale-grid';
  next.plugins = [PivotPlugin];
  next.pivot = config;
  next.readonly = true;
  next.resize = true;
  next.hideAttribution = true;
  gridHost.append(next);
  return next;
}

function waitForModel(next: HTMLRevoGridElement): Promise<number> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      next.removeEventListener(PIVOT_MODEL_CHANGED_EVENT, onModel);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Pivot model event timed out after 60 seconds'));
    }, 60_000);
    function onModel(event: Event) {
      if ((event as CustomEvent<PivotModelChangedEventDetail>).detail?.engine !== 'client') return;
      cleanup();
      resolve(performance.now());
    }
    next.addEventListener(PIVOT_MODEL_CHANGED_EVENT, onModel);
  });
}

async function runClient(count: number) {
  const token = ++runToken;
  layout = false;
  setActiveWorkload(count);
  status.textContent = `Generating ${formatCount(count)} rows…`;
  output('workload', `${formatCount(count)} client rows`);
  output('generation', '…');
  output('aggregation', '…');
  output('render', '…');
  output('interaction', '—');
  for (const button of app!.querySelectorAll<HTMLButtonElement>('button')) button.disabled = true;
  try {
    const generationStart = performance.now();
    const rows = await generateScaleRowsAsync(count);
    if (token !== runToken) return;
    generation = performance.now() - generationStart;
    output('generation', formatMs(generation));
    status.textContent = 'Applying Pivot configuration…';
    await nextPaint();
    const next = makeGrid(createScalePivotConfig());
    const changed = waitForModel(next);
    const applyStart = performance.now();
    next.source = rows;
    const modelTime = await changed;
    output('aggregation', formatMs(modelTime - applyStart));
    await nextPaint();
    output('render', formatMs(performance.now() - modelTime));
    currentCount = count;
    status.textContent = `${formatCount(count)} rows ready`;
  } catch (error) {
    setActiveWorkload(currentCount || null);
    status.textContent = `Could not finish workload: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    for (const button of app!.querySelectorAll<HTMLButtonElement>('button')) button.disabled = false;
  }
}

async function switchLayout() {
  if (!grid || !currentCount) {
    status.textContent = 'Load a client workload before measuring a layout interaction.';
    return;
  }
  const config = createScalePivotConfig();
  layout = !layout;
  config.rows = layout ? ['category', 'region'] : ['region', 'segment'];
  output('interaction', '…');
  try {
    const changed = waitForModel(grid);
    const start = performance.now();
    grid.pivot = config;
    const modelTime = await changed;
    await nextPaint();
    output('interaction', `${(modelTime - start).toFixed(1)} / ${(performance.now() - modelTime).toFixed(1)} ms`);
    status.textContent = `Rows: ${config.rows.join(' → ')}.`;
  } catch (error) {
    status.textContent = `Layout change failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

workloadTabs.forEach((button) => {
  button.addEventListener('click', () => void runClient(Number(button.dataset.count)));
  button.addEventListener('keydown', (event) => {
    const index = workloadTabs.indexOf(button);
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % workloadTabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + workloadTabs.length) % workloadTabs.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? workloadTabs.length - 1
      : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    workloadTabs[nextIndex].focus();
    workloadTabs[nextIndex].click();
  });
});
app.querySelector<HTMLButtonElement>('[data-action="interaction"]')!.addEventListener('click', () => void switchLayout());

void runClient(10_000);

  return () => { ++runToken; grid?.remove(); app.replaceChildren(); };
}

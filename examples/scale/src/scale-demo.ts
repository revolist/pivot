import questionIcon from '@fortawesome/fontawesome-free/svgs/solid/question.svg?raw';
import { applyControlPresentation } from '@revolist/ui';
import { IconButton, SegmentedSwitch } from '@revolist/ui/preact';
import { h, render } from 'preact';
import '@revolist/ui/styles.css';
import { currentTheme, observeCurrentTheme } from '../../../src/shared/theme';
/** Client workload UI and measurements. Data generation and Pivot configuration are separate so you can replace either without rewriting the view. */
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
import '../../../src/shared/pivot-report-tabs.css';
import './style.css';

defineCustomElements();

const metrics = [
  { id: "generation", label: "Data generation", helpLabel: "About data generation", description: "Time spent generating the selected synthetic rows in this browser." },
  { id: "aggregation", label: "Pivot apply", helpLabel: "About Pivot apply", description: "Time from source or config assignment to the public model-change event, including queueing. This is not a pure aggregation benchmark." },
  { id: "render", label: "Paint estimate", helpLabel: "About paint estimate", description: "Time from the model-change event through the next two animation frames. This is not a browser render profile." },
  { id: "interaction", label: "Layout interaction", helpLabel: "About layout interaction", description: "Measured after switching the row hierarchy. Shows Pivot apply / paint estimate in milliseconds; available for client workloads." },
  { id: "workload", label: "Workload", helpLabel: "About workload", description: "Selected source row count in this browser." },
];

export function mountScaleDemo(app: HTMLElement) {
app.innerHTML = `
  <section class="scale-demo scale-client-demo" aria-label="Pivot at scale">
    <header class="scale-header">
      <p class="eyebrow">Pivot at scale · synthetic USD transactions</p>
      <h1>Explore how workload size affects a Pivot report</h1>
      <p>Choose a workload, inspect measured stages, then change the row hierarchy. Results describe this browser and device only.</p>
    </header>
    <div class="scale-controls">
      <div id="scale-workloads"></div>
      <p id="status" class="scale-status" role="status">Preparing 10K rows…</p>
      <div class="scale-actions">
        <button type="button" data-action="fields" aria-pressed="false">Show fields</button>
        <button type="button" data-action="interaction">Switch row hierarchy</button>
      </div>
    </div>
    <div id="grid-host" class="grid-host"></div>
    <p class="scale-swipe-hint">Swipe the report sideways to see the remaining periods and grand total.</p>
    <section class="scale-performance" aria-label="Browser performance metrics">
      <div class="scale-performance-heading">
        <strong>Performance</strong>
        <span class="scale-performance-context">Measured live in this browser</span>
      </div>
      ${metrics.map(({ id, label }) => `
        <div class="scale-performance-metric">
          <div class="scale-performance-label">${label} <span data-metric-help="${id}"></span></div>
          <strong id="${id}">—</strong>
        </div>`).join('')}
    </section>
  </section>`;
applyControlPresentation(app);
const metricHelpHosts = metrics.map(({ id, helpLabel, description }) => {
  const host = app.querySelector<HTMLElement>(`[data-metric-help="${id}"]`)!;
  render(h(IconButton, { label: helpLabel, title: description, icon: questionIcon }), host);
  return host;
});

const status = app.querySelector<HTMLElement>('#status')!;
const gridHost = app.querySelector<HTMLElement>('#grid-host')!;
const clientDemo = app.querySelector<HTMLElement>('.scale-client-demo')!;
const fieldsButton = app.querySelector<HTMLButtonElement>('[data-action="fields"]')!;
const output = (id: string, value: string) => { app.querySelector<HTMLElement>(`#${id}`)!.textContent = value; };
const formatMs = (value: number) => `${value.toFixed(1)} ms`;
const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);
let grid: HTMLRevoGridElement | undefined;
let currentCount = 0;
let generation = 0;
let layout = false;
let runToken = 0;

  // Keep the host controls and existing grids in sync; new grids read the current preference.
  const stopTheme = observeCurrentTheme(isDark => {
    app.querySelector('.scale-client-demo')!.classList.toggle('is-dark', isDark);
    if (grid) grid.theme = isDark ? 'darkCompact' : 'compact';
  });

const workloadHost = app.querySelector<HTMLElement>('#scale-workloads')!;
const workloadOptions = [
  { value: 10_000, label: '10K rows' },
  { value: 100_000, label: '100K rows' },
  { value: 1_000_000, label: '1M rows · opt in', title: 'Opt in: generation and Pivot processing may use substantial memory' },
];
function renderWorkloads(count: number, disabled: boolean) {
  render(h(SegmentedSwitch<number>, {
    className: 'scale-workloads pivot-report-tabs',
    ariaLabel: 'Client workload',
    options: workloadOptions,
    value: count,
    disabled,
    onChange: value => void runClient(value),
  }), workloadHost);
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
  next.theme = currentTheme().isDark() ? 'darkCompact' : 'compact';
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
  renderWorkloads(count, true);
  status.textContent = `Generating ${formatCount(count)} rows…`;
  output('workload', `${formatCount(count)} client rows`);
  output('generation', '…');
  output('aggregation', '…');
  output('render', '…');
  output('interaction', '—');
  for (const button of app.querySelectorAll<HTMLButtonElement>('.scale-actions button')) button.disabled = true;
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
    status.textContent = `Could not finish workload: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    if (token === runToken) renderWorkloads(currentCount, false);
    for (const button of app.querySelectorAll<HTMLButtonElement>('.scale-actions button')) button.disabled = false;
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

app.querySelector<HTMLButtonElement>('[data-action="interaction"]')!.addEventListener('click', () => void switchLayout());
fieldsButton.addEventListener('click', () => {
  const visible = clientDemo.classList.toggle('fields-visible');
  fieldsButton.classList.add('rv-choice-chip'); fieldsButton.setAttribute('aria-pressed', String(visible));
  fieldsButton.textContent = visible ? 'Hide fields' : 'Show fields';
});

void runClient(10_000);

  return () => {
    stopTheme();
    ++runToken;
    render(null, workloadHost);
    for (const host of metricHelpHosts) render(null, host);
    grid?.remove();
    app.replaceChildren();
  };
}

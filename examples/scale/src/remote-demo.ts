import { defineCustomElements } from '@revolist/revogrid/loader';
import {
  HttpPivotRemoteStore,
  PIVOT_MODEL_CHANGED_EVENT,
  PivotPlugin,
  type PivotModelChangedEventDetail,
} from '@revolist/pivot';
import { createScalePivotConfig, FIELDS_VERSION, VIEW_ID } from './pivot-config';
import '@revolist/revogrid-pro/styles.css';
import '@revolist/pivot/styles.css';
import './style.css';

defineCustomElements();

const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const formatMs = (value: number) => `${value.toFixed(1)} ms`;

function waitForRemoteModel(grid: HTMLRevoGridElement, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      grid.removeEventListener(PIVOT_MODEL_CHANGED_EVENT, onModel);
      signal.removeEventListener('abort', onAbort);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Pivot model event timed out after 60 seconds'));
    }, 60_000);
    function onModel(event: Event) {
      if ((event as CustomEvent<PivotModelChangedEventDetail>).detail?.engine !== 'server') return;
      cleanup();
      resolve(performance.now());
    }
    function onAbort() {
      cleanup();
      reject(signal.reason instanceof Error ? signal.reason : new Error('Pivot load failed'));
    }
    grid.addEventListener(PIVOT_MODEL_CHANGED_EVENT, onModel);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

export function mountRemoteScaleDemo(app: HTMLElement): () => void {
  app.innerHTML = `
    <section class="scale-demo scale-remote-demo" aria-label="Pivot remote adapter">
      <header class="scale-header">
        <h1>Pivot remote adapter</h1>
        <p>Load a 100K-row analytical window from the Node reference backend.</p>
      </header>
      <div class="scale-controls">
        <p id="status" class="scale-status" role="status">Checking the Node backend…</p>
        <div class="scale-actions">
          <button type="button" data-action="reload">Reload remote window</button>
          <span class="scale-metric-help scale-remote-help"><button type="button" class="scale-metric-help-trigger" aria-label="About remote adapter" aria-describedby="scale-remote-tooltip">?</button><span id="scale-remote-tooltip" class="scale-metric-tooltip" role="tooltip">The Node reference backend at /api/pivot/load processes 100K rows in server memory and sends analytical windows to the grid. This is an integration example, not a database-scale claim.</span></span>
        </div>
      </div>
      <div id="grid-host" class="grid-host"></div>
      <section class="scale-performance" aria-label="Remote performance metrics">
        <div class="scale-performance-heading"><strong>Performance</strong><span class="scale-performance-context">Measured live in this browser</span></div>
        <div class="scale-performance-metric"><div class="scale-performance-label">Remote apply <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About remote apply" aria-describedby="scale-remote-apply-tooltip">?</button><span id="scale-remote-apply-tooltip" class="scale-metric-tooltip" role="tooltip">Time from requesting the analytical window to the public Pivot model-change event. Includes network, server processing, and browser queueing.</span></span></div><strong id="remote-apply">—</strong></div>
        <div class="scale-performance-metric"><div class="scale-performance-label">Paint estimate <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About paint estimate" aria-describedby="scale-remote-paint-tooltip">?</button><span id="scale-remote-paint-tooltip" class="scale-metric-tooltip" role="tooltip">Time from the model-change event through the next two animation frames. This is not a browser render profile.</span></span></div><strong id="remote-paint">—</strong></div>
        <div class="scale-performance-metric"><div class="scale-performance-label">Workload <span class="scale-metric-help"><button type="button" class="scale-metric-help-trigger" aria-label="About workload" aria-describedby="scale-remote-workload-tooltip">?</button><span id="scale-remote-workload-tooltip" class="scale-metric-tooltip" role="tooltip">The server owns 100K synthetic source rows and sends only analytical windows to the grid.</span></span></div><strong>100K server rows</strong></div>
      </section>
    </section>`;

  const status = app.querySelector<HTMLElement>('#status')!;
  const host = app.querySelector<HTMLElement>('#grid-host')!;
  const reload = app.querySelector<HTMLButtonElement>('[data-action="reload"]')!;
  let grid: HTMLRevoGridElement | undefined;
  let pending: HTMLRevoGridElement | undefined;
  let runToken = 0;

  async function loadRemote() {
    const token = ++runToken;
    reload.disabled = true;
    status.textContent = 'Checking the Node backend…';
    try {
      const health = await fetch('/api/health');
      if (!health.ok) throw new Error(`Backend health returned ${health.status}`);
      if (!health.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The health endpoint returned a page instead of the Pivot backend');
      }
      const info = await health.json();
      if (info?.status !== 'ok' || info?.rows !== 100_000) {
        throw new Error('The Pivot backend health response is invalid');
      }
      if (token !== runToken) return;
      status.textContent = 'Loading a 100K-row analytical window from the backend…';
      const config = createScalePivotConfig();
      config.hasConfigurator = false;
      const loadAbort = new AbortController();
      config.engine = {
        mode: 'server',
        remoteStore: new HttpPivotRemoteStore({
          baseUrl: '',
          fetchImpl: (input, init) => fetch(input, init),
          hooks: { requestFailed: ({ error }) => loadAbort.abort(error) },
        }),
        viewId: VIEW_ID,
        fieldsVersion: FIELDS_VERSION,
        rowAxis: { offset: 0, limit: 30 },
        columnAxis: { offset: 0, limit: 8 },
      };
      pending = document.createElement('revo-grid');
      pending.className = 'scale-grid';
      pending.plugins = [PivotPlugin];
      pending.pivot = config;
      pending.readonly = true;
      pending.resize = true;
      pending.hideAttribution = true;
      host.append(pending);
      const changed = waitForRemoteModel(pending, loadAbort.signal);
      const start = performance.now();
      pending.source = [];
      const modelTime = await changed;
      if (token !== runToken) return;
      grid?.remove();
      grid = pending;
      pending = undefined;
      app.querySelector<HTMLElement>('#remote-apply')!.textContent = formatMs(modelTime - start);
      await nextPaint();
      app.querySelector<HTMLElement>('#remote-paint')!.textContent = formatMs(performance.now() - modelTime);
      status.textContent = 'Remote analytical window loaded from the Node backend.';
    } catch (error) {
      if (token === runToken) {
        status.textContent = `Remote backend unavailable: ${error instanceof Error ? error.message : String(error)}. Start the Node reference backend to use this demo.`;
      }
    } finally {
      pending?.remove();
      pending = undefined;
      if (token === runToken) reload.disabled = false;
    }
  }

  reload.addEventListener('click', () => void loadRemote());
  void loadRemote();
  return () => { ++runToken; pending?.remove(); grid?.remove(); app.replaceChildren(); };
}

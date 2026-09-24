import { createApp } from 'vue';
import ChartsDashboard from './charts-dashboard.vue';

/** Mount the linked Pivot report and charts in any host element. */
export function mountChartsDemo(host: HTMLElement): () => void {
  const app = createApp(ChartsDashboard);
  app.mount(host);
  return () => app.unmount();
}

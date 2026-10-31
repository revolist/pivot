import { createApp } from 'vue';
import ImportPivot from './ImportPivot.vue';
import '@revolist/revogrid-pro/styles.css';
import '@revolist/pivot/styles.css';

/** One import/review/report lifecycle, shared by the four framework hosts. */
export function mountImportDemo(host: HTMLElement): () => void {
  const app = createApp(ImportPivot);
  app.mount(host);
  return () => app.unmount();
}

import { createApp } from 'vue';
import Demo from './OperationsPivot.vue';
import '@revolist/revogrid-pro/styles.css';
import '@revolist/pivot/styles.css';

/** Mounts the same operations workspace in standalone and embedded examples. */
export function mountOperationsDemo(host: HTMLElement): () => void {
  const app = createApp(Demo);
  app.mount(host);
  return () => app.unmount();
}

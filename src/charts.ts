import { mountChartsDemo } from './charts-mount';
export function load(parentSelector: string): () => void {
  const parent = document.querySelector<HTMLElement>(parentSelector);
  if (!parent) throw new Error(`Missing demo parent: ${parentSelector}`);
  const host = document.createElement('div'); parent.append(host);
  const cleanup = mountChartsDemo(host);
  return () => { cleanup(); host.remove(); };
}

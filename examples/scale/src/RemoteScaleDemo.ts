import { mountRemoteScaleDemo } from './remote-demo';

export function load(parentSelector: string): () => void {
  const parent = document.querySelector<HTMLElement>(parentSelector);
  if (!parent) throw new Error(`Missing demo parent: ${parentSelector}`);
  const host = document.createElement('div');
  host.className = 'pivot-scale-embed';
  parent.append(host);
  const cleanup = mountRemoteScaleDemo(host);
  return () => { cleanup(); host.remove(); };
}

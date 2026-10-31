import '../demo-host.css';
import '@revolist/pivot/styles.css';
import { mountChartsDemo } from './charts-mount';

const host = document.querySelector<HTMLElement>('#app');
if (!host) throw new Error('Missing dashboard host');
mountChartsDemo(host);

import { mountImportDemo } from './import-demo';
import './standalone.css';
const host = document.querySelector<HTMLElement>('#app');
if (!host) throw new Error('Missing import demo root');
mountImportDemo(host);

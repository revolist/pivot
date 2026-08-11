import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Demo from './pivot.react';

export function bootstrap(): void {
  createRoot(document.querySelector('#app')!).render(createElement(Demo));
}

import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { PivotShowcaseGridComponent } from './pivot.angular';

export async function bootstrap(): Promise<void> {
  document.querySelector('#app')!.innerHTML = '<pivot-showcase-grid></pivot-showcase-grid>';
  await bootstrapApplication(PivotShowcaseGridComponent);
}

import { Component, ViewEncapsulation } from '@angular/core';
import { PivotShowcaseGridComponent } from './pivot.angular';
@Component({ selector: 'pivot-financial-demo', standalone: true, imports: [PivotShowcaseGridComponent], encapsulation: ViewEncapsulation.None, template: '<pivot-showcase-grid [initialPreset]="\'profit\'"></pivot-showcase-grid>' })
export class FinancialDemoAngular {}

import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { mountChartsDemo } from './charts-mount';
@Component({ selector: 'pivot-charts-demo', standalone: true, encapsulation: ViewEncapsulation.None, template: '<div #host class="pivot-charts-embed"></div>' })
export class ChartsDemoAngular implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLElement>;
  private cleanup?: () => void;
  ngAfterViewInit() { this.cleanup = mountChartsDemo(this.host.nativeElement); }
  ngOnDestroy() { this.cleanup?.(); }
}

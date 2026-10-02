import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { mountRemoteScaleDemo } from './remote-demo';

@Component({ selector: 'pivot-scale-remote-demo', standalone: true, encapsulation: ViewEncapsulation.None, template: '<div #host class="pivot-scale-embed"></div>' })
export class RemoteScaleDemoAngular implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLElement>;
  private cleanup?: () => void;
  ngAfterViewInit() { this.cleanup = mountRemoteScaleDemo(this.host.nativeElement); }
  ngOnDestroy() { this.cleanup?.(); }
}

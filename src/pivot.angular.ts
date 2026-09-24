import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  Input,
  NO_ERRORS_SCHEMA,
  OnDestroy,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgIf } from '@angular/common';
import { RevoGrid, type DataType } from '@revolist/angular-datagrid';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import {
  activeFinancialFilters,
  hasSavedPivotReport,
  handleReportAction,
  listSavedPivotReports,
  loadSavedPivotReport,
  persistPivotState,
  restoreActivePreset,
  restorePivotConfig,
} from './financial.analytics';
import { exportFinancialCsv, exportFinancialXlsx, mountFinancialChart, printFinancialPivot } from './financial.actions';
import {
  FINANCIAL_COLUMNS,
  FINANCIAL_COLUMN_TYPES,
  FINANCIAL_MULTI_ROW_HEADER,
  FINANCIAL_PIVOT_CHARTS,
  FINANCIAL_PIVOT_CHARTS_UI,
  FINANCIAL_SHOWCASE_PLUGINS,
  applyFinancialPivotOptions,
  createFinancialPreset,
  resolveFinancialRows,
  type FinancialPresetId,
} from './financial.pivot';
import {
  defineFinancialPivotHeaderElement,
  type FinancialPivotAction,
  type FinancialPivotHeaderState,
} from './financial-pivot-header/financial-pivot-header';

defineFinancialPivotHeaderElement();

const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1439px)').matches;

@Component({
  selector: 'pivot-showcase-grid',
  standalone: true,
  imports: [RevoGrid, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./financial-pivot-header/financial-pivot-header.scss'],
  schemas: [NO_ERRORS_SCHEMA],
  template: `
    <div
      class="financial-pivot-showcase grow flex flex-col gap-2 h-full p-2 box-border"
      [style.position]="expanded() ? 'fixed' : null"
      [style.inset]="expanded() ? '8px' : null"
      [style.z-index]="expanded() ? 1000 : null"
      [style.background]="expanded() ? 'var(--financial-pivot-expanded-background)' : null"
    >
      <financial-pivot-header
        [state]="headerState"
        (financial-pivot-preset-select)="selectPreset($any($event).detail)"
        (financial-pivot-configurator-toggle)="configuratorVisible.set(!configuratorVisible())"
        (financial-pivot-expanded-toggle)="expanded.set(!expanded())"
        (financial-pivot-action)="onAction($any($event).detail)"
      ></financial-pivot-header>
      <div *ngIf="actionError()" role="alert" class="financial-pivot-header__question">{{ actionError() }}</div>
      <div #chartContainer class="financial-pivot-chart" aria-label="Pivot chart" [hidden]="!chartVisible()"></div>

      <div class="grow min-h-0 overflow-auto">
        <div
          class="pivot-grid-container h-full overflow-hidden"
        >
          <revo-grid
            #gridElement
            class="overflow-hidden skip-style h-full min-h-0 cell-border"
            [hideAttribution]="true"
            [range]="true"
            [resize]="true"
            [filter]="true"
            [multiRowHeader]="multiRowHeader"
            [colSize]="128"
            [source]="sourceRows()"
            [columns]="FINANCIAL_COLUMNS"
            [pivot]="pivot()"
            [pivotCharts]="pivotCharts"
            [pivotChartsUi]="pivotChartsUi"
            [theme]="theme()"
            [plugins]="plugins"
            [columnTypes]="columnTypes"
            [readonly]="true"
            (pivot-config-update)="configUpdate($event)"
          ></revo-grid>
        </div>
      </div>
    </div>
  `,
})
export class PivotShowcaseGridComponent implements OnDestroy {
  private initialPresetValue: FinancialPresetId = 'sales';
  @Input() set initialPreset(value: FinancialPresetId) {
    if (value && value !== this.initialPresetValue) {
      this.initialPresetValue = value;
      this.selectPreset(value);
    }
  }
  private benchmarkSource: DataType[] = resolveFinancialRows();
  readonly sourceRows = signal<DataType[]>(this.benchmarkSource);

  @Input() set rows(value: DataType[]) {
    this.benchmarkSource = resolveFinancialRows(value);
    this.sourceRows.set(this.benchmarkSource);
  }

  @ViewChild('gridElement', { read: ElementRef })
  gridElement?: ElementRef<HTMLRevoGridElement & { pivot?: PivotConfig }>;

  readonly FINANCIAL_COLUMNS = FINANCIAL_COLUMNS;
  readonly columnTypes = FINANCIAL_COLUMN_TYPES;
  readonly multiRowHeader = FINANCIAL_MULTI_ROW_HEADER;
  readonly pivotCharts = FINANCIAL_PIVOT_CHARTS;
  readonly pivotChartsUi = FINANCIAL_PIVOT_CHARTS_UI;
  readonly plugins = FINANCIAL_SHOWCASE_PLUGINS;
  readonly isDark = signal(currentTheme().isDark());
  readonly theme = computed(() => this.isDark() ? 'darkCompact' : 'compact');
  private readonly disconnectTheme = observeCurrentTheme((value) => this.isDark.set(value));

  readonly activePreset = signal<FinancialPresetId>(restoreActivePreset());
  readonly pivotSignal = signal<PivotConfig>(restorePivotConfig(this.activePreset()));
  readonly configuratorVisible = signal(!isSmallScreen());
  readonly expanded = signal(false);

  readonly chartVisible = signal(false);
  readonly savedAvailable = signal(hasSavedPivotReport());
  readonly reportsRevision = signal(0);
  readonly actionError = signal('');
  private chart?: PivotChartRef;

  @ViewChild('chartContainer', { read: ElementRef }) chartContainer?: ElementRef<HTMLElement>;

  get headerState(): FinancialPivotHeaderState {
    this.reportsRevision();
    return {
      activePreset: this.activePreset(),
      configuratorVisible: this.configuratorVisible(),
      expanded: this.expanded(),
      chartVisible: this.chartVisible(),
      savedAvailable: this.savedAvailable(),
      savedReports: listSavedPivotReports(),
      activeFilters: activeFinancialFilters(this.pivotSignal()),
    };
  }

  readonly pivot = computed(() => applyFinancialPivotOptions(
    this.pivotSignal(),
    this.sourceRows(),
    this.configuratorVisible(),
  ));

  configUpdate(event: CustomEvent<PivotConfig>) {
    this.pivotSignal.set(event.detail || createFinancialPreset());
  }

  selectPreset(id: FinancialPresetId) {
    this.replacePivot(createFinancialPreset(id), id);
  }

  async onAction(action: FinancialPivotAction) {
    this.actionError.set('');
    try {
      if (action === 'export-json' || typeof action === 'object') {
        const result = handleReportAction(action, this.pivotSignal(), this.activePreset());
        if (result.restored) this.replacePivot(result.restored.config, result.restored.preset);
        this.actionError.set(result.error ?? '');
        this.reportsRevision.update((value) => value + 1);
        return;
      }
      if (action === 'reset') this.selectPreset(this.initialPresetValue);
      if (action === 'save') {
        const saved = persistPivotState(this.pivotSignal(), this.activePreset());
        this.savedAvailable.set(saved);
        if (!saved) this.actionError.set('This browser could not save the report.');
      }
      if (action === 'restore') {
        const saved = loadSavedPivotReport();
        if (saved) this.replacePivot(saved.config, saved.preset);
        else this.actionError.set('The saved report could not be restored.');
      }
      if (action === 'export' && this.gridElement) await exportFinancialCsv(this.gridElement.nativeElement);
      if (action === 'export-xlsx' && this.gridElement) await exportFinancialXlsx(this.gridElement.nativeElement);
      if (action === 'print' && this.gridElement) await printFinancialPivot(this.gridElement.nativeElement);
      if (action === 'chart') {
        this.chartVisible.set(!this.chartVisible());
        if (this.chartVisible() && !this.chart && this.gridElement && this.chartContainer) {
          this.chart = await mountFinancialChart(this.gridElement.nativeElement, this.chartContainer.nativeElement);
        }
      }
    } catch { this.actionError.set(`Could not complete ${action}.`); }
  }

  private replacePivot(config: PivotConfig, preset: FinancialPresetId) {
    if (this.gridElement) this.gridElement.nativeElement.pivot = undefined;
    window.setTimeout(() => {
      this.pivotSignal.set(config);
      this.activePreset.set(preset);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.disconnectTheme();
  }
}

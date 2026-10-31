import {
  ChangeDetectionStrategy,
  Component,
  computed,
  AfterViewInit,
  ElementRef,
  Input,
  NO_ERRORS_SCHEMA,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgIf } from '@angular/common';
import { RevoGrid, type DataType } from '@revolist/angular-datagrid';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import { loadContosoData } from './contoso-data';
import {
  hasSavedPivotReport,
  handleReportAction,
  listSavedPivotReports,
  loadSavedPivotReport,
  persistPivotState,
  restoreActivePreset,
  restorePivotConfig,
} from './financial.analytics';
import { exportFinancialCsv, exportFinancialXlsx, financialActionError, mountFinancialChart, printFinancialPivot } from './financial.actions';
import { createFinancialFieldsDrawer, type FinancialFieldsDrawer } from './financial-fields-drawer';
import {
  FINANCIAL_COLUMNS,
  FINANCIAL_COLUMN_TYPES,
  FINANCIAL_MULTI_ROW_HEADER,
  FINANCIAL_PIVOT_CHARTS,
  FINANCIAL_PIVOT_CHARTS_UI,
  FINANCIAL_SHOWCASE_PLUGINS,
  applyFinancialPivotOptions,
  createFinancialPreset,
  financialPivotColumnSize,
  resolveFinancialRows,
  type FinancialPresetId,
} from './financial.pivot';
import {
  defineFinancialPivotHeaderElement,
  type FinancialPivotAction,
  type FinancialPivotHeaderState,
} from './financial-pivot-header/financial-pivot-header';

defineFinancialPivotHeaderElement();

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
      [class.financial-pivot-showcase--chart]="chartVisible()"
      [attr.data-expanded]="expanded()"
    >
      <financial-pivot-header
        [state]="headerState"
        (financial-pivot-preset-select)="selectPreset($any($event).detail)"
        (financial-pivot-configurator-toggle)="toggleFields()"
        (financial-pivot-expanded-toggle)="expanded.set(!expanded())"
        (financial-pivot-action)="onAction($any($event).detail)"
      ></financial-pivot-header>
      <div #summaryMount></div>
      <div *ngIf="loading()" role="status" class="financial-pivot-header__question">Loading Contoso retail data…</div>
      <div *ngIf="loadError()" role="alert" class="financial-pivot-header__question">{{ loadError() }}</div>
      <div *ngIf="actionError()" role="alert" class="financial-pivot-header__question">{{ actionError() }}</div>
      <div #chartContainer class="financial-pivot-chart" aria-label="Pivot chart" [hidden]="!chartVisible()"></div>

      <div class="financial-pivot-grid-view grow min-h-0 overflow-auto" [attr.aria-hidden]="chartVisible() ? 'true' : null">
        <div
          #gridHost class="pivot-grid-container h-full overflow-hidden"
        >
          <revo-grid
            #gridElement
            class="overflow-hidden skip-style h-full min-h-0 cell-border"
            [hideAttribution]="true"
            [range]="true"
            [resize]="true"
            [filter]="true"
            [multiRowHeader]="multiRowHeader"
            [colSize]="columnSize()"
            [source]="sourceRows()"
            [columns]="FINANCIAL_COLUMNS"
            [pivot]="pivot()"
            [pivotSummaryPanel]="{ mountTo: summaryMount }"
            [pivotCharts]="pivotCharts"
            [pivotChartsUi]="pivotChartsUi()"
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
export class PivotShowcaseGridComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() chartTitle?: string;
  private initialPresetValue: FinancialPresetId = 'sales';
  @Input() set initialPreset(value: FinancialPresetId) {
    if (value && value !== this.initialPresetValue) {
      this.initialPresetValue = value;
      this.selectPreset(value);
    }
  }
  readonly sourceRows = signal<DataType[]>(resolveFinancialRows());
  private suppliedRows = false;
  private disposed = false;

  @Input() set rows(value: DataType[]) {
    this.suppliedRows = true;
    this.sourceRows.set(resolveFinancialRows(value));
  }

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly actionError = signal('');

  ngOnInit(): void {
    if (this.suppliedRows) { this.loading.set(false); return; }
    void loadContosoData().then((dataset) => {
      if (this.disposed) return;
      this.sourceRows.set(dataset.rows);
      this.loading.set(false);
    }).catch((error) => {
      if (this.disposed) return;
      this.loadError.set(`Could not load the Contoso dataset: ${error instanceof Error ? error.message : String(error)}`);
      this.loading.set(false);
    });
  }

  @ViewChild('gridElement', { read: ElementRef })
  gridElement?: ElementRef<HTMLRevoGridElement & { pivot?: PivotConfig }>;
  @ViewChild('gridHost', { read: ElementRef }) gridHost?: ElementRef<HTMLElement>;
  private gridResizeObserver?: ResizeObserver;
  private fitColumns() {
    if (this.gridHost) {
      this.hostWidth.set(this.gridHost.nativeElement.clientWidth);
      this.columnSize.set(financialPivotColumnSize(this.gridHost.nativeElement, this.pivotSignal()));
    }
  }

  readonly FINANCIAL_COLUMNS = FINANCIAL_COLUMNS;
  readonly columnSize = signal(128);
  readonly hostWidth = signal(0);
  readonly columnTypes = FINANCIAL_COLUMN_TYPES;
  readonly multiRowHeader = FINANCIAL_MULTI_ROW_HEADER;
  readonly pivotCharts = FINANCIAL_PIVOT_CHARTS;
  readonly chartSettingsMount = signal<HTMLElement | undefined>(undefined);
  readonly pivotChartsUi = computed(() => ({ ...FINANCIAL_PIVOT_CHARTS_UI, settingsMountTo: this.chartSettingsMount() }));
  readonly plugins = FINANCIAL_SHOWCASE_PLUGINS;
  readonly isDark = signal(currentTheme().isDark());
  readonly theme = computed(() => this.isDark() ? 'darkCompact' : 'compact');
  private readonly disconnectTheme = observeCurrentTheme((value) => this.isDark.set(value));

  readonly activePreset = signal<FinancialPresetId>(restoreActivePreset());
  readonly pivotSignal = signal<PivotConfig>(restorePivotConfig(this.activePreset()));
  readonly configuratorVisible = signal(false);
  readonly configuratorMount = signal<HTMLElement | undefined>(undefined);
  private fieldsDrawer?: FinancialFieldsDrawer;
  readonly expanded = signal(false);

  readonly chartVisible = signal(false);
  readonly chartFieldsVisible = signal(false);
  readonly savedAvailable = signal(hasSavedPivotReport());
  readonly reportsRevision = signal(0);
  private chart?: PivotChartRef;

  @ViewChild('chartContainer', { read: ElementRef }) chartContainer?: ElementRef<HTMLElement>;

  get headerState(): FinancialPivotHeaderState {
    this.reportsRevision();
    return {
      activePreset: this.activePreset(),
      configuratorVisible: this.chartVisible() ? this.chartFieldsVisible() : this.configuratorVisible(),
      expanded: this.expanded(),
      chartVisible: this.chartVisible(),
      savedAvailable: this.savedAvailable(),
      savedReports: listSavedPivotReports(),
    };
  }

  readonly pivot = computed(() => applyFinancialPivotOptions(
    this.pivotSignal(),
    this.sourceRows(),
    this.configuratorVisible(),
    this.configuratorMount(),
    this.hostWidth(),
  ));

  ngAfterViewInit(): void {
    this.fieldsDrawer = createFinancialFieldsDrawer(() => {
      this.configuratorVisible.set(false);
      this.chartFieldsVisible.set(false);
    });
    this.configuratorMount.set(this.fieldsDrawer.mountTo);
    this.chartSettingsMount.set(this.fieldsDrawer.chartMountTo);
    if (this.gridHost) {
      this.gridResizeObserver = new ResizeObserver(() => this.fitColumns());
      this.gridResizeObserver.observe(this.gridHost.nativeElement);
      this.fitColumns();
    }
  }

  toggleFields() {
    if (this.chartVisible() && this.gridElement) {
      if (this.chartFieldsVisible()) this.fieldsDrawer?.hide();
      else {
        this.chartFieldsVisible.set(true);
        this.fieldsDrawer?.show(document.activeElement as HTMLElement, 'chart');
      }
      return;
    }
    if (this.configuratorVisible()) this.fieldsDrawer?.hide();
    else {
      this.fieldsDrawer?.show(document.activeElement as HTMLElement);
      this.configuratorVisible.set(true);
    }
  }

  configUpdate(event: CustomEvent<PivotConfig>) {
    this.pivotSignal.set(event.detail || createFinancialPreset());
    this.fitColumns();
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
        this.reportsRevision.update((value) => value + 1);
        this.actionError.set(result.error ?? '');
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
        this.fieldsDrawer?.hide();
        this.chartVisible.set(!this.chartVisible());
        if (this.chartVisible() && !this.chart && this.gridElement && this.chartContainer) {
          this.chart = await mountFinancialChart(this.gridElement.nativeElement, this.chartContainer.nativeElement, this.chartTitle, this.fieldsDrawer?.chartMountTo);
        }
      }
    } catch (error) {
      if (action === 'chart') this.chartVisible.set(false);
      this.actionError.set(financialActionError(error));
    }
  }

  private replacePivot(config: PivotConfig, preset: FinancialPresetId) {
    if (this.gridElement) this.gridElement.nativeElement.pivot = undefined;
    window.setTimeout(() => {
      this.pivotSignal.set(config);
      this.activePreset.set(preset);
      this.fitColumns();
    });
  }

  ngOnDestroy(): void {
    this.fieldsDrawer?.destroy();
    this.gridResizeObserver?.disconnect();
    this.disposed = true;
    this.chart?.destroy();
    this.disconnectTheme();
  }
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DetailedHTMLProps,
  type HTMLAttributes,
} from 'react';
import { RevoGrid, type DataType } from '@revolist/react-datagrid';
import type { PivotConfig, PivotChartRef } from '@revolist/pivot';
import './financial-pivot-header/financial-pivot-header.scss';
import { currentTheme, observeCurrentTheme } from './shared/theme';
import { loadContosoData } from './contoso-data';
import {
  hasSavedPivotReport,
  handleReportAction,
  listSavedPivotReports,
  loadSavedPivotReport,
  persistPivotState,
  restorePivotConfig,
} from './financial.analytics';
import { exportFinancialCsv, exportFinancialXlsx, financialActionError, financialChartSettingsUi, setInlineChartSettingsVisible, usesChartSettingsDrawer, mountFinancialChart, printFinancialPivot } from './financial.actions';
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
  FINANCIAL_PIVOT_CONFIGURATOR_EVENT,
  FINANCIAL_PIVOT_EXPANDED_EVENT,
  FINANCIAL_PIVOT_ACTION_EVENT,
  FINANCIAL_PIVOT_PRESET_EVENT,
  defineFinancialPivotHeaderElement,
  type FinancialPivotHeaderElement,
  type FinancialPivotHeaderState,
  type FinancialPivotAction,
} from './financial-pivot-header/financial-pivot-header';

defineFinancialPivotHeaderElement();

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'financial-pivot-header': DetailedHTMLProps<
        HTMLAttributes<FinancialPivotHeaderElement>,
        FinancialPivotHeaderElement
      >;
    }
  }
}

interface PivotProps {
  rows?: DataType[];
  initialPreset?: FinancialPresetId;
  chartTitle?: string;
}

function PivotShowcase({ rows, initialPreset = 'sales', chartTitle }: PivotProps) {
  const [isDark, setIsDark] = useState(() => currentTheme().isDark());
  const initialData = useMemo(() => resolveFinancialRows(rows), [rows]);
  const [data, setData] = useState<DataType[]>(initialData);
  const [loading, setLoading] = useState(!rows);
  const [loadError, setLoadError] = useState('');
  const [activePreset, setActivePreset] = useState<FinancialPresetId>(initialPreset);
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>(() => restorePivotConfig(activePreset));
  const [configuratorVisible, setConfiguratorVisible] = useState(false);
  const [configuratorMount, setConfiguratorMount] = useState<HTMLElement>();
  const [chartSettingsMount, setChartSettingsMount] = useState<HTMLElement>();
  const fieldsDrawer = useRef<FinancialFieldsDrawer>();
  const [expanded, setExpanded] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);
  const [chartFieldsVisible, setChartFieldsVisible] = useState(false);
  const chartUi = useMemo(() => financialChartSettingsUi(FINANCIAL_PIVOT_CHARTS_UI, chartSettingsMount, chartFieldsVisible), [chartSettingsMount, chartFieldsVisible]);
  const [savedAvailable, setSavedAvailable] = useState(hasSavedPivotReport);
  const [reportsRevision, setReportsRevision] = useState(0);
  const [actionError, setActionError] = useState('');
  const [columnSize, setColumnSize] = useState(128);
  const [hostWidth, setHostWidth] = useState(0);
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<PivotChartRef>();

  const pivot = useMemo(
    () => applyFinancialPivotOptions(pivotConfig, data, configuratorVisible, configuratorMount, hostWidth),
    [pivotConfig, data, configuratorVisible, configuratorMount, hostWidth],
  );
  const plugins = useMemo(() => FINANCIAL_SHOWCASE_PLUGINS, []);
  const columns = useMemo(() => FINANCIAL_COLUMNS, []);
  const columnTypes = useMemo(() => FINANCIAL_COLUMN_TYPES, []);
  const gridRef = useRef<HTMLRevoGridElement>(null);
  const gridHostRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<FinancialPivotHeaderElement>(null);
  const summaryMountRef = useRef<HTMLDivElement>(null);

  useEffect(() => observeCurrentTheme(setIsDark), []);
  useEffect(() => {
    const host = gridHostRef.current;
    if (!host) return;
    const fit = () => {
      setHostWidth(host.clientWidth);
      setColumnSize(financialPivotColumnSize(host, pivotConfig));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    fit();
    return () => observer.disconnect();
  }, [loading, pivotConfig]);
  useEffect(() => {
    const drawer = createFinancialFieldsDrawer(() => {
      setConfiguratorVisible(false);
      setChartFieldsVisible(false);
    });
    fieldsDrawer.current = drawer;
    setConfiguratorMount(drawer.mountTo);
    setChartSettingsMount(drawer.chartMountTo);
    return () => { drawer.destroy(); fieldsDrawer.current = undefined; };
  }, []);

  useEffect(() => {
    if (rows) { setData(initialData); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    loadContosoData().then((dataset) => {
      if (cancelled) return;
      setData(dataset.rows);
      setLoading(false);
    }).catch((error) => {
      if (cancelled) return;
      setLoadError(`Could not load the Contoso dataset: ${error instanceof Error ? error.message : String(error)}`);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [initialData, rows]);

  useEffect(() => () => chartRef.current?.destroy(), []);

  useEffect(() => {
    if (!chartVisible || chartRef.current || !chartContainer.current || !gridRef.current) return;
    let cancelled = false;
    mountFinancialChart(gridRef.current, chartContainer.current, chartTitle, fieldsDrawer.current?.chartMountTo).then((chart) => {
      if (cancelled) chart.destroy();
      else chartRef.current = chart;
    }).catch((error) => {
      if (cancelled) return;
      setChartVisible(false);
      setActionError(financialActionError(error));
    });
    return () => { cancelled = true; };
  }, [chartVisible, chartTitle]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const handler = (event: Event) => {
      const nextConfig = (event as CustomEvent<PivotConfig>).detail || createFinancialPreset();
      setPivotConfig(nextConfig);
    };
    grid.addEventListener('pivot-config-update', handler);
    return () => grid.removeEventListener('pivot-config-update', handler);
  }, []);

  const selectPreset = useCallback((id: FinancialPresetId) => {
    if (gridRef.current) gridRef.current.pivot = undefined;
    window.setTimeout(() => {
      setPivotConfig(createFinancialPreset(id));
      setActivePreset(id);
    });
  }, []);

  const headerState = useMemo<FinancialPivotHeaderState>(() => ({
    activePreset,
    configuratorVisible: chartVisible ? chartFieldsVisible : configuratorVisible,
    expanded,
    chartVisible,
    savedAvailable,
    savedReports: listSavedPivotReports(),
  }), [activePreset, configuratorVisible, chartFieldsVisible, expanded, chartVisible, savedAvailable, pivotConfig, reportsRevision]);

  useEffect(() => {
    if (headerRef.current) headerRef.current.state = headerState;
  }, [headerState]);

  useEffect(() => {
    if (gridRef.current && summaryMountRef.current) {
      gridRef.current.pivotSummaryPanel = { mountTo: summaryMountRef.current };
    }
  }, [loading, loadError]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onPreset = (event: Event) => {
      selectPreset((event as CustomEvent<FinancialPresetId>).detail);
    };
    const onConfigurator = () => {
      if (chartVisible && gridRef.current) {
        if (!usesChartSettingsDrawer()) {
          setInlineChartSettingsVisible(gridRef.current, !chartFieldsVisible);
          setChartFieldsVisible(!chartFieldsVisible);
          return;
        }
        if (chartFieldsVisible) fieldsDrawer.current?.hide();
        else {
          setChartFieldsVisible(true);
          fieldsDrawer.current?.show(document.activeElement as HTMLElement, 'chart');
        }
        return;
      }
      if (configuratorVisible) fieldsDrawer.current?.hide();
      else {
        fieldsDrawer.current?.show(document.activeElement as HTMLElement);
        setConfiguratorVisible(true);
      }
    };
    const onExpanded = () => setExpanded((value) => !value);
    const onAction = async (event: Event) => {
      const action = (event as CustomEvent<FinancialPivotAction>).detail;
      setActionError('');
      try {
        if (action === 'export-json' || typeof action === 'object') {
          const result = handleReportAction(action, pivotConfig, activePreset);
          if (result.restored) {
            if (gridRef.current) gridRef.current.pivot = undefined;
            window.setTimeout(() => { setPivotConfig(result.restored!.config); setActivePreset(result.restored!.preset); });
          }
          setSavedAvailable(hasSavedPivotReport());
          setReportsRevision((value) => value + 1);
          setActionError(result.error ?? '');
          return;
        }
        if (action === 'reset') selectPreset(initialPreset);
        if (action === 'save') {
          const saved = persistPivotState(pivotConfig, activePreset);
          setSavedAvailable(saved);
          if (!saved) setActionError('This browser could not save the report.');
        }
        if (action === 'restore') {
          const saved = loadSavedPivotReport();
          if (saved) {
            if (gridRef.current) gridRef.current.pivot = undefined;
            window.setTimeout(() => { setPivotConfig(saved.config); setActivePreset(saved.preset); });
          } else setActionError('The saved report could not be restored.');
        }
        if (action === 'export' && gridRef.current) await exportFinancialCsv(gridRef.current);
        if (action === 'export-xlsx' && gridRef.current) await exportFinancialXlsx(gridRef.current);
        if (action === 'print' && gridRef.current) await printFinancialPivot(gridRef.current);
        if (action === 'chart') {
          fieldsDrawer.current?.hide();
          setChartVisible((value) => !value);
        }
      } catch {
        setActionError('Could not complete this report action. Please try again.');
      }
    };
    header.addEventListener(FINANCIAL_PIVOT_PRESET_EVENT, onPreset);
    header.addEventListener(FINANCIAL_PIVOT_CONFIGURATOR_EVENT, onConfigurator);
    header.addEventListener(FINANCIAL_PIVOT_EXPANDED_EVENT, onExpanded);
    header.addEventListener(FINANCIAL_PIVOT_ACTION_EVENT, onAction);
    return () => {
      header.removeEventListener(FINANCIAL_PIVOT_PRESET_EVENT, onPreset);
      header.removeEventListener(FINANCIAL_PIVOT_CONFIGURATOR_EVENT, onConfigurator);
      header.removeEventListener(FINANCIAL_PIVOT_EXPANDED_EVENT, onExpanded);
      header.removeEventListener(FINANCIAL_PIVOT_ACTION_EVENT, onAction);
    };
  }, [selectPreset, pivotConfig, activePreset, configuratorVisible, chartVisible, chartFieldsVisible]);

  return (
    <div
      className={`financial-pivot-showcase grow flex flex-col gap-2 h-full p-2 box-border${chartVisible ? ' financial-pivot-showcase--chart' : ''}`}
      data-expanded={expanded}
    >
      <financial-pivot-header ref={headerRef} />
      <div ref={summaryMountRef} />
      {actionError && <div role="alert" className="financial-pivot-header__question">{actionError}</div>}
      {loading && <div role="status" className="financial-pivot-header__question">Loading Contoso retail data…</div>}
      {loadError && <div role="alert" className="financial-pivot-header__question">{loadError}</div>}
      <div ref={chartContainer} className="financial-pivot-chart" aria-label="Pivot chart" hidden={!chartVisible} />

      <div className="financial-pivot-grid-view grow min-h-0 overflow-auto" aria-hidden={chartVisible}>
        <div ref={gridHostRef} className="pivot-grid-container h-full overflow-hidden">
          <RevoGrid
            ref={gridRef}
            className="overflow-hidden skip-style h-full min-h-0 cell-border"
            hideAttribution
            range
            resize
            filter
            multiRowHeader={FINANCIAL_MULTI_ROW_HEADER}
            colSize={columnSize}
            source={data}
            columns={columns}
            pivot={pivot}
            pivotCharts={FINANCIAL_PIVOT_CHARTS}
            pivotChartsUi={chartUi}
            theme={isDark ? 'darkCompact' : 'compact'}
            plugins={plugins}
            columnTypes={columnTypes}
            readonly
          />
        </div>
      </div>
    </div>
  );
}

export default PivotShowcase;

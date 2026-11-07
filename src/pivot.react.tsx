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
  restorePivotConfig,
} from './financial.analytics';
import { exportFinancialCsv, exportFinancialXlsx, financialActionError, mountFinancialChart, printFinancialPivot } from './financial.actions';
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
  const setConfiguratorMountRef = useCallback((element: HTMLDivElement | null) => setConfiguratorMount(element ?? undefined), []);
  const chartSettingsMount = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);
  const [actionError, setActionError] = useState('');
  const [columnSize, setColumnSize] = useState(128);
  const [hostWidth, setHostWidth] = useState(0);
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<PivotChartRef>();

  const pivot = useMemo(
    () => applyFinancialPivotOptions(pivotConfig, data, configuratorVisible && !chartVisible, configuratorMount, hostWidth),
    [pivotConfig, data, configuratorVisible, chartVisible, configuratorMount, hostWidth],
  );
  const plugins = useMemo(() => FINANCIAL_SHOWCASE_PLUGINS, []);
  const columns = useMemo(() => FINANCIAL_COLUMNS, []);
  const columnTypes = useMemo(() => FINANCIAL_COLUMN_TYPES, []);
  const gridRef = useRef<HTMLRevoGridElement>(null);
  const gridHostRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<FinancialPivotHeaderElement>(null);

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
    if (!chartVisible || chartRef.current || !chartContainer.current || !chartSettingsMount.current || !gridRef.current) return;
    let cancelled = false;
    mountFinancialChart(gridRef.current, chartContainer.current, chartSettingsMount.current, chartTitle).then((chart) => {
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
    configuratorVisible,
    expanded,
    chartVisible,
  }), [activePreset, configuratorVisible, expanded, chartVisible]);

  useEffect(() => {
    if (headerRef.current) headerRef.current.state = headerState;
  }, [headerState]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onPreset = (event: Event) => {
      selectPreset((event as CustomEvent<FinancialPresetId>).detail);
    };
    const onConfigurator = () => setConfiguratorVisible((visible) => !visible);
    const onExpanded = () => setExpanded((value) => !value);
    const onAction = async (event: Event) => {
      const action = (event as CustomEvent<FinancialPivotAction>).detail;
      setActionError('');
      try {
        if (action === 'export' && gridRef.current) await exportFinancialCsv(gridRef.current);
        if (action === 'export-xlsx' && gridRef.current) await exportFinancialXlsx(gridRef.current);
        if (action === 'print' && gridRef.current) await printFinancialPivot(gridRef.current);
        if (action === 'chart') setChartVisible((value) => !value);
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
  }, [selectPreset]);

  return (
    <div
      className={`financial-pivot-showcase grow flex flex-col gap-2 h-full p-2 box-border${chartVisible ? ' financial-pivot-showcase--chart' : ''}`}
      data-expanded={expanded}
      onKeyDown={(event) => { if (event.key === 'Escape') setConfiguratorVisible(false); }}
    >
      <div className="financial-pivot-main">
        <financial-pivot-header ref={headerRef} />
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
              pivotChartsUi={FINANCIAL_PIVOT_CHARTS_UI}
              theme={isDark ? 'darkCompact' : 'compact'}
              plugins={plugins}
              columnTypes={columnTypes}
              readonly
            />
          </div>
        </div>
      </div>
      <aside className="financial-pivot-sidebar" hidden={!configuratorVisible} aria-label={chartVisible ? 'Chart fields' : 'Pivot fields'}>
        <div ref={setConfiguratorMountRef} className="financial-pivot-sidebar__mount" hidden={chartVisible} />
        <div ref={chartSettingsMount} className="financial-pivot-sidebar__mount" hidden={!chartVisible} />
      </aside>
    </div>
  );
}

export default PivotShowcase;

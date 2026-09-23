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
import {
  activeFinancialFilters,
  hasSavedPivotReport,
  handleReportAction,
  listSavedPivotReports,
  loadSavedPivotReport,
  persistPivotState,
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
}

const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1439px)').matches;

function PivotShowcase({ rows, initialPreset = 'sales' }: PivotProps) {
  const [isDark, setIsDark] = useState(() => currentTheme().isDark());
  const initialData = useMemo(() => resolveFinancialRows(rows), [rows]);
  const [data, setData] = useState<DataType[]>(initialData);
  const [activePreset, setActivePreset] = useState<FinancialPresetId>(initialPreset);
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>(() => restorePivotConfig(activePreset));
  const [configuratorVisible, setConfiguratorVisible] = useState(() => !isSmallScreen());
  const [expanded, setExpanded] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);
  const [savedAvailable, setSavedAvailable] = useState(hasSavedPivotReport);
  const [reportsRevision, setReportsRevision] = useState(0);
  const [actionError, setActionError] = useState('');
  const chartContainer = useRef<HTMLDivElement>(null);
  const chartRef = useRef<PivotChartRef>();

  const pivot = useMemo(
    () => applyFinancialPivotOptions(pivotConfig, data, configuratorVisible),
    [pivotConfig, data, configuratorVisible],
  );
  const plugins = useMemo(() => FINANCIAL_SHOWCASE_PLUGINS, []);
  const columns = useMemo(() => FINANCIAL_COLUMNS, []);
  const columnTypes = useMemo(() => FINANCIAL_COLUMN_TYPES, []);
  const gridRef = useRef<HTMLRevoGridElement>(null);
  const headerRef = useRef<FinancialPivotHeaderElement>(null);

  useEffect(() => observeCurrentTheme(setIsDark), []);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => () => chartRef.current?.destroy(), []);

  useEffect(() => {
    if (!chartVisible || chartRef.current || !chartContainer.current || !gridRef.current) return;
    let cancelled = false;
    mountFinancialChart(gridRef.current, chartContainer.current).then((chart) => {
      if (cancelled) chart.destroy();
      else chartRef.current = chart;
    }).catch(() => setActionError('Could not open the chart.'));
    return () => { cancelled = true; };
  }, [chartVisible]);

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
    savedAvailable,
    savedReports: listSavedPivotReports(),
    activeFilters: activeFinancialFilters(pivotConfig),
  }), [activePreset, configuratorVisible, expanded, chartVisible, savedAvailable, pivotConfig, reportsRevision]);

  useEffect(() => {
    if (headerRef.current) headerRef.current.state = headerState;
  }, [headerState]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onPreset = (event: Event) => {
      selectPreset((event as CustomEvent<FinancialPresetId>).detail);
    };
    const onConfigurator = () => setConfiguratorVisible((value) => !value);
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
          setActionError(result.error ?? '');
          setSavedAvailable(hasSavedPivotReport());
          setReportsRevision((value) => value + 1);
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
        if (action === 'chart') setChartVisible((value) => !value);
      } catch { setActionError(`Could not complete ${action}.`); }
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
  }, [selectPreset, pivotConfig, activePreset]);

  return (
    <div
      className="financial-pivot-showcase grow flex flex-col gap-2 h-full p-2 box-border"
      style={expanded ? { position: 'fixed', inset: 8, zIndex: 1000, background: 'var(--financial-pivot-expanded-background)' } : undefined}
    >
      <financial-pivot-header ref={headerRef} />
      {actionError && <div role="alert" className="financial-pivot-header__question">{actionError}</div>}
      <div ref={chartContainer} className="financial-pivot-chart" aria-label="Pivot chart" hidden={!chartVisible} />

      <div className="grow min-h-0 overflow-auto">
        <div className="pivot-grid-container h-full overflow-hidden">
          <RevoGrid
            ref={gridRef}
            className="overflow-hidden skip-style h-full min-h-0 cell-border"
            hideAttribution
            range
            resize
            filter
            multiRowHeader={FINANCIAL_MULTI_ROW_HEADER}
            colSize={180}
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
  );
}

export default PivotShowcase;

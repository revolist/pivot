import { FINANCIAL_ANALYSIS_PRESET_IDS, FINANCIAL_PRESETS, type FinancialPresetId } from '../financial.pivot';

export const FINANCIAL_PIVOT_HEADER_TAG = 'financial-pivot-header';
export const FINANCIAL_PIVOT_PRESET_EVENT = 'financial-pivot-preset-select';
export const FINANCIAL_PIVOT_CONFIGURATOR_EVENT = 'financial-pivot-configurator-toggle';
export const FINANCIAL_PIVOT_EXPANDED_EVENT = 'financial-pivot-expanded-toggle';
export const FINANCIAL_PIVOT_ACTION_EVENT = 'financial-pivot-action';
export type FinancialPivotAction = 'chart' | 'export' | 'save' | 'restore' | 'reset' | 'export-json' | 'import-json' | 'export-xlsx' | 'print'
  | { kind: 'save-named' | 'restore-named' | 'delete-named'; name: string }
  | { kind: 'import-json'; json: string };

export interface FinancialPivotHeaderState {
  activePreset: FinancialPresetId | null;
  configuratorVisible: boolean;
  expanded: boolean;
  chartVisible?: boolean;
  savedAvailable?: boolean;
  savedReports?: string[];
  activeFilters?: string[];
}

export type FinancialPivotHeaderElement = HTMLElement & { state: FinancialPivotHeaderState };

const DEFAULT_STATE: FinancialPivotHeaderState = {
  activePreset: 'sales', configuratorVisible: true, expanded: false,
};

class FinancialPivotHeader extends HTMLElement {
  private currentState = DEFAULT_STATE;
  get state() { return this.currentState; }
  set state(value: FinancialPivotHeaderState) {
    this.currentState = value;
    this.render();
  }
  connectedCallback() { this.render(); }
  disconnectedCallback() { this.replaceChildren(); }

  private render() {
    const focusedAction = (this.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.action : undefined);
    const state = this.currentState;
    const root = element('div', 'financial-pivot-header');
    const toolbar = element('div', 'financial-pivot-header__toolbar');
    const report = element('div', 'financial-pivot-header__report');
    const presetSwitch = element('div', 'rv-segmented-switch financial-pivot-header__preset-switch');
    presetSwitch.setAttribute('role', 'tablist');
    presetSwitch.setAttribute('aria-label', 'Financial report presets');
    const analysisMode = state.activePreset && FINANCIAL_ANALYSIS_PRESET_IDS.includes(state.activePreset);
    for (const preset of FINANCIAL_PRESETS.filter((candidate) =>
      FINANCIAL_ANALYSIS_PRESET_IDS.includes(candidate.id) === !!analysisMode)) {
      const active = state.activePreset === preset.id;
      const button = actionButton(preset.label, () => {
        if (!active) this.emit(FINANCIAL_PIVOT_PRESET_EVENT, preset.id);
      });
      button.className = `rv-segmented-switch-item${active ? ' on' : ''}`;
      button.dataset.value = preset.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(active));
      button.firstElementChild?.classList.add('rv-segmented-switch-label');
      presetSwitch.append(button);
    }
    report.append(presetSwitch);
    const current = FINANCIAL_PRESETS.find((preset) => preset.id === state.activePreset);
    report.append(element('p', 'financial-pivot-header__question', current?.description ?? 'Explore the report.'));
    const actions = element('div', 'financial-pivot-header__actions');
    actions.append(
      actionButton('Fields', () => this.emit(FINANCIAL_PIVOT_CONFIGURATOR_EVENT), 'fields', state.configuratorVisible),
      actionButton('Chart', () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'chart'), 'chart', state.chartVisible),
      actionButton('Export CSV', () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'export'), 'export'),
    );
    const reportMenu = element('details', 'financial-pivot-header__menu');
    const summary = element('summary', 'financial-pivot-header__button', 'Report');
    summary.dataset.action = 'report';
    reportMenu.append(summary);
    const menu = element('div', 'financial-pivot-header__menu-items');
    menu.append(
      actionButton('Save this report', () => { this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'save'); reportMenu.open = false; }, 'save'),
      actionButton('Restore saved report', () => { this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'restore'); reportMenu.open = false; }, 'restore'),
    );
    (menu.lastElementChild as HTMLButtonElement).disabled = !state.savedAvailable;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Report name';
    nameInput.maxLength = 80;
    nameInput.setAttribute('aria-label', 'Report name');
    menu.append(nameInput, actionButton('Save named report', () => {
      const name = nameInput.value.trim();
      if (name) { this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'save-named', name }); reportMenu.open = false; }
      else nameInput.focus();
    }, 'save-named'));
    for (const name of state.savedReports ?? []) {
      const row = element('div', 'financial-pivot-header__saved-row');
      row.append(actionButton(`Open ${name}`, () => { this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'restore-named', name }); reportMenu.open = false; }, `open-${name}`));
      row.append(actionButton(`Delete ${name}`, () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'delete-named', name }), `delete-${name}`));
      menu.append(row);
    }
    menu.append(
      actionButton('Download report JSON', () => { this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'export-json'); reportMenu.open = false; }, 'export-json'),
      actionButton('Export XLSX (visible result)', () => { this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'export-xlsx'); reportMenu.open = false; }, 'export-xlsx'),
      actionButton('Print / Save PDF (visible result)', () => { this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'print'); reportMenu.open = false; }, 'print'),
      actionButton('Import report JSON', () => {
        const picker = document.createElement('input');
        picker.type = 'file'; picker.accept = '.json,application/json';
        picker.addEventListener('change', async () => {
          const file = picker.files?.[0];
          if (file) this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'import-json', json: await file.text() });
        });
        picker.click(); reportMenu.open = false;
      }, 'import-json'),
    );
    reportMenu.append(menu);
    actions.append(reportMenu,
      actionButton('Reset', () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'reset'), 'reset'),
      actionButton(state.expanded ? 'Exit expanded workspace' : 'Expand workspace',
        () => this.emit(FINANCIAL_PIVOT_EXPANDED_EVENT), 'expanded', state.expanded),
    );
    toolbar.append(report, actions);
    root.append(toolbar);
    const filters = element('div', 'financial-pivot-header__filters');
    filters.setAttribute('aria-label', 'Active filters');
    filters.append(element('span', 'financial-pivot-header__filters-label', 'Active filters'));
    for (const filter of state.activeFilters ?? []) {
      filters.append(element('span', 'financial-pivot-header__filter', filter));
    }
    if (!state.activeFilters?.length) filters.append(element('span', '', 'None'));
    root.append(filters);
    this.replaceChildren(root);
    if (focusedAction) this.querySelector<HTMLElement>(`[data-action="${focusedAction}"]`)?.focus();
  }

  private emit(name: string, detail?: FinancialPresetId | FinancialPivotAction) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }
}

export function defineFinancialPivotHeaderElement() {
  if (!customElements.get(FINANCIAL_PIVOT_HEADER_TAG)) {
    customElements.define(FINANCIAL_PIVOT_HEADER_TAG, FinancialPivotHeader);
  }
}

export function createFinancialPivotHeader(state: FinancialPivotHeaderState) {
  defineFinancialPivotHeaderElement();
  const header = document.createElement(FINANCIAL_PIVOT_HEADER_TAG) as FinancialPivotHeaderElement;
  header.state = state;
  return header;
}

function actionButton(label: string, onClick: () => void, action?: string, pressed?: boolean) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'financial-pivot-header__button';
  if (action) button.dataset.action = action;
  if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed));
  button.append(element('span', '', label));
  button.addEventListener('click', onClick);
  return button;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

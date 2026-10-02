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
}

export type FinancialPivotHeaderElement = HTMLElement & {
  state: FinancialPivotHeaderState;
};

const DEFAULT_STATE: FinancialPivotHeaderState = {
  activePreset: 'sales', configuratorVisible: true, expanded: false,
};

class FinancialPivotHeader extends HTMLElement {
  private currentState = DEFAULT_STATE;
  private readonly closeReportOnOutsideClick = (event: PointerEvent) => {
    const report = this.querySelector<HTMLDetailsElement>('.financial-pivot-header__menu');
    if (report?.open && !report.contains(event.target as Node)) report.open = false;
  };
  private readonly closeReportOnEscape = (event: KeyboardEvent) => {
    const report = this.querySelector<HTMLDetailsElement>('.financial-pivot-header__menu');
    if (event.key !== 'Escape' || !report?.open) return;
    report.open = false;
    report.querySelector<HTMLElement>('summary')?.focus();
  };
  get state() { return this.currentState; }
  set state(value: FinancialPivotHeaderState) {
    this.currentState = value;
    this.render();
  }
  connectedCallback() {
    document.addEventListener('pointerdown', this.closeReportOnOutsideClick);
    document.addEventListener('keydown', this.closeReportOnEscape);
    this.render();
  }
  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.closeReportOnOutsideClick);
    document.removeEventListener('keydown', this.closeReportOnEscape);
    this.replaceChildren();
  }

  private render() {
    const focusedElement = this.contains(document.activeElement)
      ? document.activeElement as HTMLElement : null;
    const focusedAction = focusedElement?.dataset.action;
    const focusedPreset = focusedElement?.dataset.value;
    const focusedReportName = focusedElement?.getAttribute('aria-label') === 'Report name';
    const reportMenuWasOpen = this.querySelector<HTMLDetailsElement>('.financial-pivot-header__menu')?.open;
    const state = this.currentState;
    const root = element('div', 'financial-pivot-header');
    const toolbar = element('div', 'financial-pivot-header__toolbar');
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
      button.tabIndex = active ? 0 : -1;
      button.firstElementChild?.classList.add('rv-segmented-switch-label');
      presetSwitch.append(button);
    }
    presetSwitch.addEventListener('keydown', (event) => {
      if (!(event.target instanceof HTMLButtonElement)) return;
      const tabs = [...presetSwitch.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      const index = tabs.indexOf(event.target);
      if (index < 0) return;
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : -1;
      if (next < 0) return;
      event.preventDefault();
      tabs[next]?.focus();
      tabs[next]?.click();
    });
    const actions = element('div', 'financial-pivot-header__actions');
    const exploreActions = element('div', 'financial-pivot-header__action-group');
    exploreActions.setAttribute('role', 'group');
    exploreActions.setAttribute('aria-label', 'Explore report');
    exploreActions.append(
      actionButton('Fields', () => this.emit(FINANCIAL_PIVOT_CONFIGURATOR_EVENT), 'fields', state.configuratorVisible),
      actionButton('Chart', () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'chart'), 'chart', state.chartVisible),
      actionButton('Export CSV', () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'export'), 'export'),
    );
    const manageActions = element('div', 'financial-pivot-header__action-group financial-pivot-header__action-group--manage');
    manageActions.setAttribute('role', 'group');
    manageActions.setAttribute('aria-label', 'Manage report');
    const reportMenu = element('details', 'financial-pivot-header__menu');
    reportMenu.open = !!reportMenuWasOpen;
    const summary = element('summary', 'financial-pivot-header__button', 'Report');
    summary.dataset.action = 'report';
    summary.setAttribute('aria-label', 'Report actions');
    reportMenu.append(summary);
    const menu = element('div', 'financial-pivot-header__menu-items');
    menu.append(
      element('strong', 'financial-pivot-header__menu-title', 'Manage report'),
      element('p', 'financial-pivot-header__menu-intro', 'Save your layout here or share it as a file.'),
      element('span', 'financial-pivot-header__menu-section', 'Saved layouts'),
    );
    const menuAction = (label: string, description: string, onClick: () => void, action: string) => {
      const button = actionButton(label, onClick, action);
      button.classList.add('financial-pivot-header__menu-action');
      button.append(element('small', '', description));
      return button;
    };
    menu.append(
      menuAction('Save this report', 'Remember the current layout in this browser.', () => { reportMenu.open = false; this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'save'); }, 'save'),
      menuAction('Restore saved report', 'Return to the last saved layout.', () => { reportMenu.open = false; this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'restore'); }, 'restore'),
    );
    (menu.lastElementChild as HTMLButtonElement).disabled = !state.savedAvailable;
    const nameLabel = element('label', 'financial-pivot-header__name-label', 'Save a named layout');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Report name';
    nameInput.maxLength = 80;
    nameInput.setAttribute('aria-label', 'Report name');
    nameLabel.append(nameInput);
    menu.append(nameLabel, menuAction('Save named report', 'Keep another layout alongside your quick save.', () => {
      const name = nameInput.value.trim();
      if (name) { reportMenu.open = false; this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'save-named', name }); }
      else { nameInput.setCustomValidity('Enter a report name first.'); nameInput.reportValidity(); nameInput.focus(); }
    }, 'save-named'));
    nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
    if (!(state.savedReports ?? []).length) menu.append(element('p', 'financial-pivot-header__menu-intro', 'No named reports saved yet.'));
    for (const name of state.savedReports ?? []) {
      const row = element('div', 'financial-pivot-header__saved-row');
      row.append(menuAction(`Open ${name}`, 'Load this layout', () => { reportMenu.open = false; this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'restore-named', name }); }, `open-${name}`));
      row.append(actionButton(`Delete ${name}`, () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'delete-named', name }), `delete-${name}`));
      menu.append(row);
    }
    menu.append(element('span', 'financial-pivot-header__menu-section', 'Share and export'));
    menu.append(
      menuAction('Download report JSON', 'Share the report layout as a file.', () => { reportMenu.open = false; this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'export-json'); }, 'export-json'),
      menuAction('Export XLSX (visible result)', 'Download the current grid values.', () => { reportMenu.open = false; this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'export-xlsx'); }, 'export-xlsx'),
      menuAction('Print / Save PDF (visible result)', 'Open browser printing for the current grid.', () => { reportMenu.open = false; this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'print'); }, 'print'),
      menuAction('Import report JSON', 'Choose a previously downloaded report file.', () => {
        const picker = document.createElement('input');
        picker.type = 'file'; picker.accept = '.json,application/json';
        picker.addEventListener('change', async () => {
          const file = picker.files?.[0];
          if (file) this.emit(FINANCIAL_PIVOT_ACTION_EVENT, { kind: 'import-json', json: await file.text() });
        });
        reportMenu.open = false;
        picker.click();
      }, 'import-json'),
    );
    reportMenu.append(menu);
    const expandLabel = state.expanded ? 'Exit expanded workspace' : 'Expand workspace';
    const expandButton = actionButton(expandLabel,
      () => this.emit(FINANCIAL_PIVOT_EXPANDED_EVENT), 'expanded', state.expanded);
    expandButton.classList.add('financial-pivot-header__button--expand');
    expandButton.setAttribute('aria-label', expandLabel);
    expandButton.title = expandLabel;
    expandButton.firstElementChild!.textContent = state.expanded ? '↙' : '↗';
    expandButton.firstElementChild!.setAttribute('aria-hidden', 'true');
    manageActions.append(reportMenu,
      actionButton('Reset', () => this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'reset'), 'reset'),
      expandButton,
    );
    actions.append(exploreActions, manageActions);
    toolbar.append(presetSwitch, actions);
    const surface = element('div', 'financial-pivot-header__surface');
    surface.append(toolbar);
    root.append(surface);
    this.replaceChildren(root);
    if (focusedPreset) this.querySelector<HTMLElement>(`[data-value="${focusedPreset}"]`)?.focus();
    else if (focusedReportName) nameInput.focus();
    else if (focusedAction) this.querySelector<HTMLElement>(`[data-action="${focusedAction}"]`)?.focus();
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

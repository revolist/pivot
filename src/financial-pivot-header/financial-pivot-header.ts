import { controlAttributes, createControl } from '@revolist/ui';
import '@revolist/ui/styles.css';
import '../shared/pivot-report-tabs.css';
import { TooltipController } from '@revolist/ui/surfaces';
import { FINANCIAL_ANALYSIS_PRESET_IDS, FINANCIAL_PRESETS, type FinancialPresetId } from '../financial.pivot';

export const FINANCIAL_PIVOT_HEADER_TAG = 'financial-pivot-header';
export const FINANCIAL_PIVOT_PRESET_EVENT = 'financial-pivot-preset-select';
export const FINANCIAL_PIVOT_CONFIGURATOR_EVENT = 'financial-pivot-configurator-toggle';
export const FINANCIAL_PIVOT_EXPANDED_EVENT = 'financial-pivot-expanded-toggle';
export const FINANCIAL_PIVOT_ACTION_EVENT = 'financial-pivot-action';
export type FinancialPivotAction = 'chart' | 'export' | 'export-xlsx' | 'print';

export interface FinancialPivotHeaderState {
  activePreset: FinancialPresetId | null;
  configuratorVisible: boolean;
  expanded: boolean;
  chartVisible?: boolean;
}

export type FinancialPivotHeaderElement = HTMLElement & {
  state: FinancialPivotHeaderState;
};

const CONFIGURATOR_ICON = `<svg class="financial-pivot-header__cog" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill="currentColor" d="M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"/></svg>`;

const DEFAULT_STATE: FinancialPivotHeaderState = {
  activePreset: 'sales', configuratorVisible: true, expanded: false,
};

class FinancialPivotHeader extends HTMLElement {
  private currentState = DEFAULT_STATE;
  private readonly exportTooltip = new TooltipController();
  private readonly positionExportMenu = () => {
    const report = this.querySelector<HTMLDetailsElement>('.financial-pivot-header__menu');
    const menu = report?.querySelector<HTMLElement>('.financial-pivot-header__menu-items');
    if (!report?.open || !menu) return;
    // Toolbar actions wrap independently; position this overlay from its actual anchor.
    const anchor = report.getBoundingClientRect();
    const margin = 12;
    const below = Math.max(0, window.innerHeight - anchor.bottom - margin);
    const above = Math.max(0, anchor.top - margin);
    const useBelow = below >= Math.min(300, menu.scrollHeight) || below >= above;
    const height = Math.min(640, useBelow ? below : above);
    const left = Math.max(margin, Math.min(anchor.right - menu.offsetWidth,
      window.innerWidth - menu.offsetWidth - margin));
    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
    menu.style.maxHeight = `${height}px`;
    const top = useBelow ? anchor.bottom : anchor.top - Math.min(menu.scrollHeight + 2, height);
    menu.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
  };
  private readonly onExportToggle = () => {
    const open = this.querySelector<HTMLDetailsElement>('.financial-pivot-header__menu')?.open;
    // Closed menus do no work while the grid or page scrolls.
    document.removeEventListener('scroll', this.positionExportOnScroll, true);
    window.removeEventListener('resize', this.positionExportMenu);
    if (open) {
      document.addEventListener('scroll', this.positionExportOnScroll, true);
      window.addEventListener('resize', this.positionExportMenu);
      this.positionExportMenu();
    }
  };
  private readonly positionExportOnScroll = (event: Event) => {
    // Scrolling the menu itself does not move its anchor.
    if (event.target instanceof Element && event.target.closest('.financial-pivot-header__menu-items')) return;
    this.positionExportMenu();
  };
  private readonly closeExportOnOutsideClick = (event: PointerEvent) => {
    const report = this.querySelector<HTMLDetailsElement>('.financial-pivot-header__menu');
    if (report?.open && !report.contains(event.target as Node)) report.open = false;
  };
  private readonly closeExportOnEscape = (event: KeyboardEvent) => {
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
    document.addEventListener('pointerdown', this.closeExportOnOutsideClick);
    document.addEventListener('keydown', this.closeExportOnEscape);
    this.render();
  }
  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.closeExportOnOutsideClick);
    document.removeEventListener('keydown', this.closeExportOnEscape);
    document.removeEventListener('scroll', this.positionExportOnScroll, true);
    window.removeEventListener('resize', this.positionExportMenu);
    this.exportTooltip.destroy();
    this.replaceChildren();
  }

  private render() {
    const focusedElement = this.contains(document.activeElement)
      ? document.activeElement as HTMLElement : null;
    const focusedAction = focusedElement?.dataset.action;
    const focusedPreset = focusedElement?.dataset.value;
    const exportMenuWasOpen = this.querySelector<HTMLDetailsElement>('.financial-pivot-header__menu')?.open;
    const state = this.currentState;
    const root = element('div', 'financial-pivot-header');
    const toolbar = element('div', 'financial-pivot-header__toolbar');
    const presetSwitch = element('div', 'financial-pivot-header__preset-switch rv-segmented-switch pivot-report-tabs');
    presetSwitch.setAttribute('role', 'tablist');
    presetSwitch.setAttribute('aria-label', 'Financial report presets');
    const analysisMode = state.activePreset && FINANCIAL_ANALYSIS_PRESET_IDS.includes(state.activePreset);
    for (const preset of FINANCIAL_PRESETS.filter((candidate) =>
      FINANCIAL_ANALYSIS_PRESET_IDS.includes(candidate.id) === !!analysisMode)) {
      const active = state.activePreset === preset.id;
      const button = actionButton(preset.label, () => {
        if (!active) this.emit(FINANCIAL_PIVOT_PRESET_EVENT, preset.id);
      });
      button.className = controlAttributes('button', { class: `financial-pivot-header__preset-tab${active ? ' is-active' : ''}` }).class;
      button.dataset.value = preset.id;
      button.setAttribute('role', 'tab');
      button.classList.add('rv-segmented-switch-item'); button.setAttribute('aria-selected', String(active)); button.classList.toggle('on', button.getAttribute('aria-selected') === 'true');
      button.tabIndex = active ? 0 : -1;
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
    const viewSwitch = element('div', 'financial-pivot-header__view-switch');
    viewSwitch.setAttribute('role', 'group');
    viewSwitch.setAttribute('aria-label', 'Report view');
    for (const [label, chartVisible, path] of [
      ['Pivot', false, 'M3 3h14v14H3z M3 8h14 M8 3v14 M3 12h14'],
      ['Chart', true, 'M3 3v14h14 M7 13V9 M11 13V5 M15 13V7'],
    ] as const) {
      const selected = !!state.chartVisible === chartVisible;
      const button = actionButton(label, () => {
        if (!selected) this.emit(FINANCIAL_PIVOT_ACTION_EVENT, 'chart');
      }, chartVisible ? 'chart' : 'pivot', selected);
      button.classList.add('financial-pivot-header__view-button');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 20 20');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', path);
      icon.append(shape);
      button.prepend(icon);
      viewSwitch.append(button);
    }
    const exploreActions = element('div', 'financial-pivot-header__action-group');
    exploreActions.setAttribute('role', 'group');
    exploreActions.setAttribute('aria-label', 'Explore report');
    const exportMenu = element('details', 'financial-pivot-header__menu');
    exportMenu.open = !!exportMenuWasOpen;
    const summary = createControl(document, 'summary', { class: 'rv-btn rv-btn-ghost financial-pivot-header__button' });
    summary.dataset.action = 'export';
    setIconAction(summary, 'Export', 'M10 3v10m-4-4 4 4 4-4M3 13v4h14v-4');
    const menu = element('div', 'financial-pivot-header__menu-items');
    for (const [label, action] of [
      ['Export CSV', 'export'],
      ['Export XLSX', 'export-xlsx'],
      ['Print / Save PDF', 'print'],
    ] as const) {
      const button = actionButton(label, () => {
        exportMenu.open = false;
        summary.focus();
        this.emit(FINANCIAL_PIVOT_ACTION_EVENT, action);
      }, action === 'export' ? 'export-csv' : action);
      button.classList.add('rv-btn-ghost', 'financial-pivot-header__menu-action');
      menu.append(button);
    }
    exportMenu.append(summary, menu);
    exportMenu.addEventListener('toggle', this.onExportToggle);
    const configurator = actionButton('Configurator', () => this.emit(FINANCIAL_PIVOT_CONFIGURATOR_EVENT), 'fields', state.configuratorVisible);
    configurator.insertAdjacentHTML('afterbegin', CONFIGURATOR_ICON);
    exploreActions.append(configurator, exportMenu);
    const expandLabel = state.expanded ? 'Exit expanded workspace' : 'Expand workspace';
    const expandButton = actionButton(expandLabel,
      () => this.emit(FINANCIAL_PIVOT_EXPANDED_EVENT), 'expanded', state.expanded);
    expandButton.classList.add('financial-pivot-header__button--expand', 'rv-btn-ghost');
    expandButton.setAttribute('aria-label', expandLabel);
    expandButton.title = expandLabel;
    expandButton.firstElementChild!.textContent = state.expanded ? '↙' : '↗';
    expandButton.firstElementChild!.setAttribute('aria-hidden', 'true');
    actions.append(viewSwitch, exploreActions, expandButton);
    toolbar.append(presetSwitch, actions);
    const surface = element('div', 'financial-pivot-header__surface');
    surface.append(toolbar);
    root.append(surface);
    this.exportTooltip.bind(summary, 'Export');
    this.replaceChildren(root);
    this.onExportToggle();
    if (focusedPreset) this.querySelector<HTMLElement>(`[data-value="${focusedPreset}"]`)?.focus();
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
  const button = createControl(document, 'button', { type: 'button' });
  button.type = 'button';
  button.className = controlAttributes('button', { class: 'financial-pivot-header__button' }).class;
  if (action) button.dataset.action = action;
  if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed));
  button.append(element('span', '', label));
  button.addEventListener('click', onClick);
  return button;
}

function setIconAction(control: HTMLElement, label: string, path: string) {
  control.classList.add('financial-pivot-header__button--icon');
  control.setAttribute('aria-label', label);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 20 20');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  icon.append(shape);
  control.replaceChildren(icon);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

import { currentTheme, observeCurrentTheme } from './shared/theme';

/** Application-owned overlay for the Pivot configurator's public `mountTo` target. */
export function createFinancialFieldsDrawer(onClose: () => void) {
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'financial-pivot-fields-backdrop';
  backdrop.setAttribute('aria-label', 'Close pivot fields');
  backdrop.hidden = true;

  const dialog = document.createElement('aside');
  dialog.className = 'financial-pivot-fields-drawer';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Pivot fields');
  dialog.hidden = true;
  dialog.inert = true;

  const heading = document.createElement('div');
  heading.className = 'financial-pivot-fields-drawer__header';
  const title = document.createElement('h2');
  title.textContent = 'Pivot fields';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'financial-pivot-fields-drawer__close';
  closeButton.setAttribute('aria-label', 'Close fields');
  closeButton.textContent = '×';
  heading.append(title, closeButton);

  const hint = document.createElement('p');
  hint.className = 'financial-pivot-fields-drawer__hint';
  hint.textContent = 'Drag fields between Rows, Columns, Values, and Filters to change the report.';
  const mountTo = document.createElement('div');
  mountTo.className = 'financial-pivot-fields-drawer__mount';
  dialog.append(heading, hint, mountTo);
  document.body.append(backdrop, dialog);

  const syncTheme = (dark = currentTheme().isDark()) => {
    const theme = dark ? 'darkCompact' : 'compact';
    mountTo.querySelectorAll<HTMLRevoGridElement>('revo-grid').forEach((grid) => {
      if (grid.theme !== theme) grid.theme = theme;
    });
  };
  const themeObserver = new MutationObserver(() => syncTheme());
  themeObserver.observe(mountTo, { childList: true, subtree: true });
  const disconnectTheme = observeCurrentTheme(syncTheme);

  let returnFocus: HTMLElement | null = null;
  const hide = () => {
    if (dialog.hidden) return;
    dialog.hidden = true;
    dialog.inert = true;
    backdrop.hidden = true;
    const trigger = returnFocus;
    returnFocus = null;
    onClose();
    // Framework hosts may replace the pressed Fields button when onClose renders.
    requestAnimationFrame(() => {
      const action = trigger?.dataset.action;
      const currentTrigger = trigger?.isConnected
        ? trigger
        : [...document.querySelectorAll<HTMLElement>('financial-pivot-header [data-action]')]
          .find((element) => element.dataset.action === action);
      currentTrigger?.focus();
    });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (dialog.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    } else if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  };
  backdrop.addEventListener('click', hide);
  closeButton.addEventListener('click', hide);
  document.addEventListener('keydown', onKeyDown);

  return {
    mountTo,
    show(trigger?: HTMLElement | null) {
      returnFocus = trigger ?? document.activeElement as HTMLElement;
      backdrop.hidden = false;
      dialog.hidden = false;
      dialog.inert = false;
      closeButton.focus();
      queueMicrotask(() => syncTheme());
    },
    hide,
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      themeObserver.disconnect();
      disconnectTheme();
      backdrop.remove();
      dialog.remove();
    },
  };
}

export type FinancialFieldsDrawer = ReturnType<typeof createFinancialFieldsDrawer>;

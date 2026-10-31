import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createFinancialFieldsDrawer, type FinancialFieldsDrawer } from '../../src/financial-fields-drawer';

let drawer: FinancialFieldsDrawer | undefined;
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal('requestAnimationFrame', vi.fn());
});
afterEach(() => {
  drawer?.destroy();
  drawer = undefined;
  vi.unstubAllGlobals();
});

it('creates an accessible close button using published Pro exports', () => {
  let closes = 0;
  drawer = createFinancialFieldsDrawer(() => { closes += 1; });
  drawer.show();
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const close = dialog.querySelector<HTMLButtonElement>('button[aria-label="Close fields"]')!;
  expect(close).not.toBeNull();
  expect(close.type).toBe('button');
  expect(close.classList.contains('rv-dialog__close')).toBe(true);
  expect(document.activeElement).toBe(close);
  close.click();
  expect(dialog.hidden).toBe(true);
  expect(closes).toBe(1);
});

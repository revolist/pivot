import { expect, it, vi } from 'vitest';
import { financialChartSettingsUi, usesChartSettingsDrawer } from '../../src/financial.actions';

it('uses inline settings before Pivot 4 and drawer settings from Pivot 4', () => {
  expect(usesChartSettingsDrawer('3.1.2')).toBe(false);
  expect(usesChartSettingsDrawer('4.0.0')).toBe(true);
  expect(usesChartSettingsDrawer('4.0.0-beta.1')).toBe(true);
  expect(usesChartSettingsDrawer('5.0.0')).toBe(true);
  expect(usesChartSettingsDrawer(undefined)).toBe(false);
});

it.each(['3.1.2', '4.0.0'])('preserves controls and toggles the supported settings host in %s', (version) => {
  vi.stubEnv('REVOGRID_PIVOT_VERSION', version);
  try {
    const mount = document.createElement('div');
    const ui = { contextMenu: true, controls: { 'query.reset': 'hidden' as const } };
    const shown = financialChartSettingsUi(ui, mount, true);
    const hidden = financialChartSettingsUi(ui, mount, false);
    expect(shown.controls?.['query.reset']).toBe('hidden');
    expect(shown.contextMenu).toBe(true);
    expect(shown.controls?.settings).toBe('enabled');
    if (version.startsWith('3')) {
      expect(shown).not.toHaveProperty('settingsMountTo');
      expect(hidden.controls?.settings).toBe('hidden');
    } else {
      expect(shown).toHaveProperty('settingsMountTo', mount);
      expect(hidden.controls?.settings).toBe('enabled');
    }
  } finally {
    vi.unstubAllEnvs();
  }
});

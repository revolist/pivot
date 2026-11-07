import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { repairTrialFilterIdentity, trialFilterIdentityPlugin } from './trial-filter-identity.mjs';

const core = 'data:text/javascript,' + encodeURIComponent('export class BasePlugin {} export class FilterPlugin {}');
const fixture = `import { BasePlugin as broken, FilterPlugin as CoreFilter } from ${JSON.stringify(core)};
export const AdvanceFilterPlugin = class e extends CoreFilter {
  getQuickFilter() {}
  getRowFilter() { return {}; }
  hasActiveFilters() { return !!this.active; }
  supportsChunkedFiltering() { return this.getRowFilter === broken.prototype.getRowFilter; }
  inactiveEvaluator() {
    if (this.getRowFilter !== broken.prototype.getRowFilter
      || this.hasActiveFilters !== broken.prototype.hasActiveFilters
      || broken.prototype.hasActiveFilters.call(this)) return undefined;
    return this.getRowFilter;
  }
  numericProjection() {
    if (this.getRowFilter !== broken.prototype.getRowFilter
      || this.hasActiveFilters !== broken.prototype.hasActiveFilters) return undefined;
    return this.getRowFilter;
  }
};`;

test('repairs the generated class binding without relaxing evaluator checks', async () => {
  const result = repairTrialFilterIdentity(fixture);
  assert.equal(result.replacements, 6);
  const { AdvanceFilterPlugin } = await import('data:text/javascript,' + encodeURIComponent(result.code));
  const plugin = new AdvanceFilterPlugin();
  assert.equal(plugin.inactiveEvaluator(), plugin.getRowFilter);
  assert.equal(plugin.supportsChunkedFiltering(), true);
  plugin.active = true;
  assert.equal(plugin.inactiveEvaluator(), undefined);
  plugin.active = false;
  plugin.getRowFilter = () => ({ custom: true });
  assert.equal(plugin.inactiveEvaluator(), undefined);
});

test('leaves corrected bundles unchanged and refuses an unexpected broken shape', () => {
  const fixed = fixture.replaceAll('broken.prototype', 'e.prototype');
  assert.deepEqual(repairTrialFilterIdentity(fixed), { code: fixed, replacements: 0 });
  assert.throws(() => repairTrialFilterIdentity(fixture.replace('  numericProjection()', '  unused()').replace('this.hasActiveFilters !== broken.prototype.hasActiveFilters) return undefined;', 'false) return undefined;')), /Unexpected/);
});

for (const [name, file] of [['Pro', '@revolist/revogrid-pro'], ['Pivot', '@revolist/pivot']]) {
  test(`applies the legacy identity repair only to the affected ${name} trial version`, () => {
    const manifest = JSON.parse(readFileSync(new URL('../node_modules/' + file + '/package.json', import.meta.url), 'utf8'));
    const filename = name === 'Pro' ? 'rv-pro-trial.js' : 'pivot-trial.js';
    const url = new URL('../node_modules/' + file + '/dist/' + filename, import.meta.url);
    const code = readFileSync(url, 'utf8');
    const transformed = trialFilterIdentityPlugin().transform(code, url.pathname + '?v=development');
    if (manifest.version === '2.10.0') {
      assert.equal(repairTrialFilterIdentity(code).replacements, 6);
      assert.equal(repairTrialFilterIdentity(transformed.code).replacements, 0);
    } else {
      assert.equal(transformed, undefined);
    }
  });
}

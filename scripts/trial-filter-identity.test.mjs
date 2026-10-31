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

for (const [name,file] of [['Pro','@revolist/revogrid-pro/dist/rv-pro-trial.js'],['Pivot','@revolist/pivot/dist/pivot-trial.js']]) {
  test(`repairs the exact installed ${name} 2.10.0 trial artifact`, () => {
    const code=readFileSync(new URL('../node_modules/'+file,import.meta.url),'utf8');
    const result=repairTrialFilterIdentity(code);
    assert.equal(result.replacements,6);
    assert.equal(repairTrialFilterIdentity(result.code).replacements,0);
  });
}


test('repairs Vite development module URLs with a cache query', () => {
  const url = new URL('../node_modules/@revolist/revogrid-pro/dist/rv-pro-trial.js', import.meta.url);
  const code = readFileSync(url, 'utf8');
  assert.ok(trialFilterIdentityPlugin().transform(code, url.pathname + '?v=development').code);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createScalePivotConfig } from '../src/pivot-config.ts';

test('collapsed Scale groups render their requested subtotals', () => {
  const config = createScalePivotConfig();
  assert.equal(config.collapsed, true);
  assert.equal(config.totals.subtotals, true);
  assert.equal(config.groupAggregations, true);
});

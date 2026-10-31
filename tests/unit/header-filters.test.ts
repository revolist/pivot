import { describe, expect, it } from 'vitest';
import { FilterHeaderPlugin } from '@revolist/revogrid-pro';
import {
  createFinancialShowcasePlugins,
  FINANCIAL_HEADER_FILTERS_ENABLED,
  FINANCIAL_SHOWCASE_PLUGINS,
} from '../../src/financial.pivot';

describe('financial Pivot header filters', () => {
  it('keeps inline header inputs off by default and available by opt-in', () => {
    expect(FINANCIAL_HEADER_FILTERS_ENABLED).toBe(false);
    expect(FINANCIAL_SHOWCASE_PLUGINS).not.toContain(FilterHeaderPlugin);
    expect(createFinancialShowcasePlugins(true)).toContain(FilterHeaderPlugin);
  });
});

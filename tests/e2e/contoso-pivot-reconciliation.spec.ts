import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

type Sale = {
  Country: string;
  Category: string;
  Subcategory: string;
  Product: string;
  Year: number;
  Quarter: string;
  Month: string;
  Revenue: number;
  Cost: number;
  'Gross Profit': number;
  Quantity: number;
};

const asset = new URL('../../src/assets/contoso-retail-v2.json.gz', import.meta.url);
const rows = JSON.parse(gunzipSync(readFileSync(asset)).toString('utf8')).rows as Sale[];
const cents = (value: number) => Math.round(value * 100);
const sum = (source: Sale[], field: 'Revenue' | 'Cost' | 'Gross Profit' | 'Quantity') =>
  source.reduce((total, row) => total + (field === 'Quantity' ? row.Quantity : cents(row[field])), 0);
const usd = (actual: number | undefined, expectedCents: number) =>
  expect(cents(actual ?? Number.NaN)).toBe(expectedCents);

async function report(page: Page, route: string, preset: string) {
  await page.goto(route);
  await page.getByRole('tab', { name: preset, exact: true }).click();
  await expect(page.getByRole('tab', { name: preset, exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.waitForFunction((label) => {
    const grid = document.querySelector('revo-grid') as HTMLRevoGridElement | null;
    return grid?.source?.length && grid.source.every(row => row.__pivotGenerated)
      && grid.pinnedBottomSource?.length
      && document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === label;
  }, preset);
  return page.locator('revo-grid').first().evaluate((grid: HTMLRevoGridElement) => ({
    source: grid.source as (Sale & Record<string, number | string>)[],
    totals: grid.pinnedBottomSource as Record<string, number | string>[],
  }));
}

test('Contoso sales: country/category leaves and quarter totals reconcile to source lines', async ({ page }) => {
  const { source, totals } = await report(page, '/', 'Sales Overview');
  const active = rows.filter((row) => row.Year === 2025);
  usd(Number(totals[0]['__pivot_grand_total__|Revenue']), sum(active, 'Revenue'));
  for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
    usd(Number(totals[0][`${quarter}|__pivot_collapse__|Revenue`]),
      sum(active.filter((row) => row.Quarter === quarter), 'Revenue'));
  }
  for (const item of source.filter((row) => String(row.__rowKey).startsWith('leaf:'))) {
    usd(Number(item['__pivot_grand_total__|Revenue']), sum(active.filter((row) =>
      row.Country === item.Country && row.Category === item.Category), 'Revenue'));
  }
});

test('Contoso profitability: all three measures reconcile by category and subcategory', async ({ page }) => {
  const { source, totals } = await report(page, '/', 'Profitability');
  const active = rows.filter((row) => row.Year === 2025);
  const measures = [
    ['Revenue (USD)', 'Revenue'], ['Cost (USD)', 'Cost'], ['Gross Profit (USD)', 'Gross Profit'],
  ] as const;
  for (const [label, field] of measures) {
    const total = totals.find((item) => item.__pivot_value__ === label);
    expect(total).toBeDefined();
    usd(Number(total?.__pivot_grand_total__), sum(active, field));
    for (const item of source.filter((row) => String(row.__rowKey).startsWith('leaf:') && row.__pivot_value__ === label)) {
      usd(Number(item.__pivot_grand_total__), sum(active.filter((row) =>
        row.Category === item.Category && row.Subcategory === item.Subcategory), field));
    }
  }
});

test('Contoso product: revenue and quantity reconcile for every product leaf', async ({ page }) => {
  const { source, totals } = await report(page, '/', 'Product Performance');
  const active = rows.filter((row) => row.Year === 2025);
  usd(Number(totals[0]['__pivot_grand_total__|Revenue']), sum(active, 'Revenue'));
  expect(Number(totals[0]['__pivot_grand_total__|Quantity'])).toBe(sum(active, 'Quantity'));
  for (const item of source.filter((row) => String(row.__rowKey).startsWith('leaf:'))) {
    const matching = active.filter((row) => row.Category === item.Category &&
      row.Subcategory === item.Subcategory && row.Product === item.Product);
    usd(Number(item['__pivot_grand_total__|Revenue']), sum(matching, 'Revenue'));
    expect(Number(item['__pivot_grand_total__|Quantity'])).toBe(sum(matching, 'Quantity'));
  }
});

test('Contoso profit: both years and grand totals reconcile', async ({ page }) => {
  const { source, totals } = await report(page, '/financial.html', 'Profit');
  for (const field of ['Revenue', 'Gross Profit'] as const) {
    usd(Number(totals[0][`__pivot_grand_total__|${field}`]), sum(rows, field));
    for (const year of [2024, 2025]) {
      usd(Number(totals[0][`${year}|__pivot_collapse__|${field}`]),
        sum(rows.filter((row) => row.Year === year), field));
    }
    for (const item of source.filter((row) => String(row.__rowKey).startsWith('leaf:'))) {
      usd(Number(item[`__pivot_grand_total__|${field}`]),
        sum(rows.filter((row) => row.Category === item.Category), field));
    }
  }
});

test('Contoso contribution: category shares use the full profit denominator', async ({ page }) => {
  const { source, totals } = await report(page, '/financial.html', 'Contribution');
  const totalProfit = sum(rows, 'Gross Profit');
  usd(Number(totals[0]['|profit']), totalProfit);
  expect(Number(totals[0]['|profit-contribution'])).toBeCloseTo(1, 12);
  for (const item of source.filter((row) => String(row.__rowKey).startsWith('leaf:'))) {
    const categoryProfit = sum(rows.filter((row) => row.Category === item.Category), 'Gross Profit');
    usd(Number(item['|profit']), categoryProfit);
    expect(Number(item['|profit-contribution'])).toBeCloseTo(categoryProfit / totalProfit, 10);
  }
});

test('Contoso running total: every country/month is cumulative', async ({ page }) => {
  const { source, totals } = await report(page, '/financial.html', 'Running total');
  const active = rows.filter((row) => row.Year === 2025);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  for (const item of [...source.filter((row) => String(row.__rowKey).startsWith('leaf:')), ...totals]) {
    let running = 0;
    for (const month of months) {
      running += sum(active.filter((row) => row.Month === month &&
        (item.Country === 'Grand Total' || row.Country === item.Country)), 'Revenue');
      usd(Number(item[`${month}|Revenue`]), running);
    }
  }
});

test('Contoso year over year: the first year is blank and the second is percent change', async ({ page }) => {
  const { source, totals } = await report(page, '/financial.html', 'Year over year');
  for (const item of [...source.filter((row) => String(row.__rowKey).startsWith('leaf:')), ...totals]) {
    const matching = item.Product === 'Grand Total' ? rows : rows.filter((row) => row.Product === item.Product);
    // A product sold in only one year has no comparable two-year result.
    if (![2024, 2025].every((year) => matching.some((row) => row.Year === year))) continue;
    const previous = sum(matching.filter((row) => row.Year === 2024), 'Revenue');
    const current = sum(matching.filter((row) => row.Year === 2025), 'Revenue');
    usd(Number(item['2024|sales']), previous);
    usd(Number(item['2025|sales']), current);
    expect(item['2024|sales-yoy']).toBeNull();
    const expected = previous ? (current - previous) / previous : null;
    if (expected === null) expect(item['2025|sales-yoy']).toBeNull();
    else expect(Number(item['2025|sales-yoy'])).toBeCloseTo(expected, 10);
  }
});

test('Contoso ranking: product profit and descending rank reconcile', async ({ page }) => {
  const { source, totals } = await report(page, '/financial.html', 'Ranking');
  const active = rows.filter((row) => row.Year === 2025);
  usd(Number(totals[0]['|profit']), sum(active, 'Gross Profit'));
  const profits = source.filter((row) => String(row.__rowKey).startsWith('leaf:'))
    .map((item) => sum(active.filter((row) => row.Product === item.Product), 'Gross Profit'))
    .sort((left, right) => right - left);
  for (const item of source.filter((row) => String(row.__rowKey).startsWith('leaf:'))) {
    const profit = sum(active.filter((row) => row.Product === item.Product), 'Gross Profit');
    usd(Number(item['|profit']), profit);
    expect(Number(item['|profit-rank'])).toBe(profits.filter((value) => value > profit).length + 1);
  }
});

test('Contoso average, minimum and maximum revenue follow the active source filter', async ({ page }) => {
  await page.goto('/');
  const grid = page.locator('revo-grid').first();
  await expect(grid).toBeVisible();
  const active = rows.filter((row) => row.Year === 2024 && row.Country === 'Australia');
  for (const aggregator of ['avg', 'min', 'max'] as const) {
    await grid.evaluate((element: HTMLRevoGridElement, selected) => {
      element.pivot = {
        ...element.pivot,
        rows: ['Category'], columns: [],
        values: [{ prop: 'Revenue', aggregator: selected }],
        filterSelections: { Year: [2024], Country: ['Australia'] },
        columnCollapse: { enabled: false },
      };
    }, aggregator);
    await expect.poll(() => grid.evaluate((element: HTMLRevoGridElement) =>
      element.pivot?.values[0]?.aggregator)).toBe(aggregator);
    const actual = await grid.evaluate((element: HTMLRevoGridElement) => ({
      source: element.source as (Sale & Record<string, number | string>)[],
      total: Number(element.pinnedBottomSource?.[0]?.['|Revenue']),
    }));
    const expected = (items: Sale[]) => {
      const values = items.map((row) => row.Revenue);
      return aggregator === 'avg' ? values.reduce((total, value) => total + value, 0) / values.length
        : aggregator === 'min' ? Math.min(...values) : Math.max(...values);
    };
    expect(actual.total).toBeCloseTo(expected(active), 8);
    for (const item of actual.source.filter((row) => String(row.__rowKey).startsWith('leaf:'))) {
      const matching = active.filter((row) => row.Category === item.Category);
      expect(Number(item['|Revenue'])).toBeCloseTo(expected(matching), 8);
    }
  }
});

test('Contoso calculated profit equals revenue minus cost by category and year', async ({ page }) => {
  await page.goto('/financial.html');
  const grid = page.locator('revo-grid').first();
  await expect(grid).toBeVisible();
  await grid.evaluate((element: HTMLRevoGridElement) => {
    element.pivot = {
      ...element.pivot,
      rows: ['Category'], columns: ['Year'],
      values: [
        { id: 'revenue', prop: 'Revenue', aggregator: 'sum' },
        { id: 'cost', prop: 'Cost', aggregator: 'sum' },
        { id: 'profit-formula', prop: 'Revenue', aggregator: 'sum', calculation: {
          type: 'formula', expression: {
            type: 'binary', operator: '-',
            left: { type: 'measure', id: 'revenue' },
            right: { type: 'measure', id: 'cost' },
          },
        } },
      ],
      filterSelections: { Year: [2024, 2025] },
    };
  });
  await expect.poll(() => grid.evaluate((element: HTMLRevoGridElement) =>
    element.pinnedBottomSource?.[0]?.['__pivot_grand_total__|profit-formula'])).toBeDefined();
  const actual = await grid.evaluate((element: HTMLRevoGridElement) => ({
    source: element.source as (Sale & Record<string, number | string>)[],
    total: element.pinnedBottomSource?.[0] as Record<string, number>,
  }));
  usd(actual.total['__pivot_grand_total__|profit-formula'],
    sum(rows, 'Revenue') - sum(rows, 'Cost'));
  for (const item of actual.source.filter((row) => String(row.__rowKey).startsWith('leaf:'))) {
    const matching = rows.filter((row) => row.Category === item.Category);
    usd(Number(item['__pivot_grand_total__|profit-formula']),
      sum(matching, 'Revenue') - sum(matching, 'Cost'));
    for (const year of [2024, 2025]) {
      const yearly = matching.filter((row) => row.Year === year);
      usd(Number(item[`${year}|__pivot_collapse__|profit-formula`]),
        sum(yearly, 'Revenue') - sum(yearly, 'Cost'));
    }
  }
});

test('Contoso category year-over-year changes match source revenue', async ({ page }) => {
  await report(page, '/financial.html', 'Year over year');
  const grid = page.locator('revo-grid').first();
  await grid.evaluate((element: HTMLRevoGridElement) => {
    element.pivot = { ...element.pivot, rows: ['Category'] };
  });
  await expect.poll(() => grid.evaluate((element: HTMLRevoGridElement) =>
    element.source?.length)).toBe(8);
  const actual = await grid.evaluate((element: HTMLRevoGridElement) => ({
    source: element.source as (Sale & Record<string, number | string | null>)[],
    total: element.pinnedBottomSource?.[0] as Record<string, number | null>,
  }));
  for (const item of [...actual.source, actual.total]) {
    const matching = item.Category === 'Grand Total'
      ? rows : rows.filter((row) => row.Category === item.Category);
    const previous = sum(matching.filter((row) => row.Year === 2024), 'Revenue');
    const current = sum(matching.filter((row) => row.Year === 2025), 'Revenue');
    expect(item['2024|sales-yoy']).toBeNull();
    expect(Number(item['2025|sales-yoy']))
      .toBeCloseTo((current - previous) / previous, 10);
  }
});

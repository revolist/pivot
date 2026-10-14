import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const feature = JSON.parse(readFileSync(new URL('../../feature.json', import.meta.url), 'utf8')) as { title: string };

test(`${feature.title} starts with a clear sales report and restores only on request`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const grid = page.locator('revo-grid').first();
  await expect(grid).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('tablist', { name: 'Financial report presets' })).toBeVisible();
  const expand = page.getByRole('button', { name: 'Expand workspace' });
  await expect(expand).toHaveAttribute('title', 'Expand workspace');
  await expect(expand).toHaveText('↗');
  await expect(page.getByLabel('Active filters')).toContainText('Year: 2025');
  await expect(page.locator('.financial-pivot-header__title')).toHaveCount(0);
  await expect(page.locator('.pivot-summary-panel')).toHaveCount(1);
  await expect(page.locator('.pivot-summary-panel__definition')).toContainText('Country › Category');
  await expect(page.locator('.pivot-summary-panel__definition')).toContainText('Quarter › Month');
  await expect(page.locator('.pivot-summary-panel__definition')).toContainText('Revenue (USD)');
  await expect(page.locator('.financial-pivot-header__dataset-note')).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first().locator('input')).toHaveCount(0);
  for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
    await expect(page.getByRole('columnheader', { name: new RegExp(quarter) }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: 'Expand Q1' }).click();
  await expect(page.locator('revogr-header .rgHeaderCell', { hasText: 'January' }).first()).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Grand Total' }).first()).toBeVisible();

  const fields = page.getByRole('button', { name: 'Fields', exact: true });
  await expect(fields).toHaveAttribute('aria-pressed', 'false');
  await fields.click();
  await expect(fields).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog', { name: 'Pivot fields' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pivot fields' }).getByRole('searchbox', { name: 'Search fields' })).toBeVisible();
  const fieldGrid = page.getByRole('dialog', { name: 'Pivot fields' }).locator('revo-grid').first();
  await expect(fieldGrid).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pivot fields' }).locator('.pivot-dimension-group-name').first()).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await expect(fieldGrid).toHaveAttribute('theme', 'compact');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await expect(fieldGrid).toHaveAttribute('theme', 'darkCompact');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await page.keyboard.press('Escape');
  await expect(fields).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('dialog', { name: 'Pivot fields' })).toBeHidden();
  await expect(fields).toBeFocused();

  await page.locator('summary', { hasText: 'Report' }).click();
  await page.getByRole('button', { name: 'Save this report' }).click();
  await page.getByRole('tab', { name: 'Profitability' }).click();
  await expect(page.getByLabel('Active filters')).toContainText('Year: 2025');
  await expect(page.locator('.pivot-summary-panel')).toContainText('Gross Profit');
  await page.locator('summary', { hasText: 'Report' }).click();
  await page.getByRole('button', { name: 'Restore saved report' }).click();
  await expect(page.getByRole('tab', { name: 'Sales Overview' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pivot-summary-panel')).toContainText('Country › Category');
  await page.getByRole('tab', { name: 'Product Performance' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('tab', { name: 'Sales Overview' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pivot-summary-panel')).toContainText('Revenue (USD)');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sales Overview' })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`workspace expansion fits the viewport and restores the report at ${viewport.width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto('/');
    const workspace = page.locator('.financial-pivot-showcase');
    await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Expand workspace' }).click();
    await expect(workspace).toHaveAttribute('data-expanded', 'true');
    const bounds = await workspace.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(8);
    expect(bounds!.y).toBe(8);
    expect(bounds!.width).toBe(viewport.width - 16);
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height - 16);
    expect(await page.locator('body').evaluate(body => getComputedStyle(body).overflow)).toBe('hidden');
    await page.getByRole('tab', { name: 'Product Performance' }).click();
    await page.getByRole('button', { name: 'Fields', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Pivot fields' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Collapse workspace' }).click();
    await expect(workspace).toHaveAttribute('data-expanded', 'false');
    expect(await workspace.evaluate(element => getComputedStyle(element).position)).not.toBe('fixed');
    expect(await page.locator('body').evaluate(body => getComputedStyle(body).overflow)).not.toBe('hidden');
    await expect(page.getByRole('tab', { name: 'Product Performance' })).toHaveAttribute('aria-selected', 'true');
    expect(errors).toEqual([]);
  });
}

test('summary follows the grid Pivot config and hides when it is cleared', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('.pivot-summary-panel');
  await expect(summary).toContainText('Year: 2025');
  await page.locator('revo-grid').first().evaluate((grid: HTMLRevoGridElement) => {
    grid.pivot = { ...grid.pivot, filterSelections: { Year: [2024] } };
  });
  await expect(summary).toContainText('Year: 2024');
  await expect(summary).not.toContainText('Year: 2025');
  await page.locator('revo-grid').first().evaluate((grid: HTMLRevoGridElement) => {
    grid.pivot = undefined;
  });
  await expect(summary).toBeHidden();
});

for (const { width, height, showFields } of [
  { width: 1280, height: 800, showFields: false },
  { width: 1440, height: 900, showFields: false },
]) {
  test(`main report fits the sales content at ${width}px with fields ${showFields ? 'shown' : 'hidden'}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    // The sales-site navigation occupies about 300px; reproduce the space
    // available to the embedded demo rather than the full standalone page.
    await page.addStyleTag({ content: '#app { width: calc(100vw - 300px); margin-left: 300px; padding: 0; }' });
    const grid = page.locator('revo-grid').first();
    await expect(grid).toBeVisible({ timeout: 20_000 });
    const fields = page.getByRole('button', { name: 'Fields', exact: true });
    if (await fields.getAttribute('aria-pressed') !== String(showFields)) await fields.click();
    await expect(fields).toHaveAttribute('aria-pressed', String(showFields));
    const lastHeader = page.getByRole('columnheader', { name: 'Grand Total' }).first();
    await expect(lastHeader).toBeVisible();
    const definitionBox = await page.locator('.pivot-summary-panel__definition').boundingBox();
    const filtersBox = await page.getByLabel('Active filters').boundingBox();
    expect(definitionBox).not.toBeNull();
    expect(filtersBox).not.toBeNull();
    const panelBox = await page.locator('.pivot-summary-panel').boundingBox();
    expect(panelBox).not.toBeNull();
    expect(definitionBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
    expect(filtersBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
    const headerBox = await lastHeader.boundingBox();
    const gridBox = await page.locator('.pivot-grid-container').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(gridBox).not.toBeNull();
    expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(gridBox!.x + gridBox!.width + 1);
    expect(gridBox!.x + gridBox!.width - (headerBox!.x + headerBox!.width)).toBeLessThan(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('mobile report actions and tabs remain keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('tablist', { name: 'Financial report presets' })).toBeVisible();
  await expect(page.locator('.pivot-summary-panel')).toHaveCount(1);
  await expect(page.locator('.pivot-summary-panel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const tabs = page.getByRole('tablist', { name: 'Financial report presets' });
  expect(await tabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Sales Overview' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Product Performance' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Product Performance' })).toBeInViewport();
  const fields = page.getByRole('button', { name: 'Fields', exact: true });
  await fields.click();
  await expect(page.getByRole('dialog', { name: 'Pivot fields' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fields).toBeFocused();
});

test('alternative reports give the Rows header the main report width', async ({ page }) => {
  await page.goto('/');
  const rowHeader = page.getByRole('columnheader', { name: /Rows/ }).first();
  await expect(rowHeader).toBeVisible({ timeout: 20_000 });
  for (const preset of ['Profitability', 'Product Performance']) {
    await page.getByRole('tab', { name: preset }).click();
    await expect(page.getByRole('tab', { name: preset })).toHaveAttribute('aria-selected', 'true');
    await expect(rowHeader).toBeVisible();
    expect((await rowHeader.boundingBox())?.width).toBeGreaterThanOrEqual(275);
  }
});

test('chart and visible CSV export are usable from the toolbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Chart', exact: true }).click();
  const chartType = page.getByRole('button', { name: 'Grouped column', exact: true });
  if (await chartType.isVisible()) await chartType.click();
  await expect(page.getByRole('button', { name: 'Chart', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Pivot chart', { exact: true })).toBeVisible();
  const grid = page.locator('.pivot-grid-container');
  await expect(grid).toBeHidden();
  await expect(page.getByRole('alert')).toBeEmpty();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pivot-visible-report.csv');
  const csv = readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('Revenue');
  expect(csv).toContain('Grand Total');
  // The 2025 source-line revenue sums to USD 7,776,899.28.
  const totalRow = csv.split(/\r?\n/).find(line => line.includes('Grand Total') && !line.includes('Revenue'))!;
  const total = Number(totalRow.split(',').at(-1)?.replace(/"/g, ''));
  expect(total).toBeCloseTo(7776899.28, 2);
  await page.getByRole('button', { name: 'Pivot', exact: true }).click();
  await expect(grid).toBeVisible();
});

test('visible XLSX retains the source-backed USD grand total', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first()).toBeVisible();
  await page.locator('summary', { hasText: 'Report' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export XLSX (visible result)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pivot-visible-report.xlsx');
  const entries = unzipSync(readFileSync(await download.path()));
  const worksheet = strFromU8(entries['xl/worksheets/sheet1.xml']);
  expect(worksheet).toContain('Grand Total');
  const values = [...worksheet.matchAll(/<v>([^<]+)<\/v>/g)].map(match => Number(match[1]));
  expect(values.some(value => Math.abs(value - 7776899.28) < 0.005)).toBe(true);
});

test('drill-through returns only the selected month, country and category sales lines', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Expand Q1' }).click();
  await expect(page.getByText('January', { exact: true })).toBeVisible();
  const audio = page.getByRole('row').filter({ hasText: 'Audio' }).first();
  await audio.getByRole('gridcell', { name: '$691.13' }).first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Drill Through…' }).click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText('3291034:0');
  await expect(details).toContainText('3299003:3');
  await expect(details).toContainText('3318025:4');
  await expect(details).toContainText('3 of 3 rows');
});

test('print view retains the visible USD grand total', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first()).toBeVisible();
  await page.locator('summary', { hasText: 'Report' }).click();
  await page.getByRole('button', { name: 'Print / Save PDF (visible result)' }).click();
  const frame = page.locator('iframe[title="Visible pivot result for printing"]');
  await expect(frame).toHaveAttribute('srcdoc', /\$7,776,899\.28/);
});

test('Product Performance PDF shows grouped row labels instead of empty rows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Product Performance' }).click();
  await expect(page.getByRole('columnheader', { name: 'Grand Total' }).first()).toBeVisible();
  await page.locator('summary', { hasText: 'Report' }).click();
  await page.getByRole('button', { name: 'Print / Save PDF (visible result)' }).click();
  const printTable = page.frameLocator('iframe[title="Visible pivot result for printing"]');
  const rows = printTable.locator('tbody tr');
  await expect(rows.first()).toContainText('Audio');
  await expect(rows.first().locator('td').first()).not.toBeEmpty();
  for (const row of await printTable.locator('tbody tr').allTextContents()) {
    expect(row.trim()).not.toBe('');
  }
  await expect(printTable.locator('tbody tr.total')).toContainText('Grand Total');
  await expect(printTable.locator('tbody tr.total')).toContainText('$7,776,899.28');
  expect(await printTable.locator('tbody').innerText()).not.toMatch(/\.\d{3,}/);
});

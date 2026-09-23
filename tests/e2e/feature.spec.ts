import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const feature = JSON.parse(readFileSync(new URL('../../feature.json', import.meta.url), 'utf8')) as { title: string };

test(`${feature.title} starts with a clear sales report and restores only on request`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const grid = page.locator('revo-grid').first();
  await expect(grid).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('tablist', { name: 'Financial report presets' })).toBeVisible();
  await expect(page.getByLabel('Active filters')).toContainText('Year: 2025');
  await expect(page.getByText('How did sales compare across countries and quarters in 2025?')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Sales (sum)' }).first()).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Grand Total' }).first()).toBeVisible();

  const fields = page.getByRole('button', { name: 'Fields' });
  await expect(fields).toHaveAttribute('aria-pressed', 'true');
  await fields.click();
  await expect(fields).toHaveAttribute('aria-pressed', 'false');
  await fields.click();
  await expect(fields).toHaveAttribute('aria-pressed', 'true');

  await page.locator('summary', { hasText: 'Report' }).click();
  await page.getByRole('button', { name: 'Save this report' }).click();
  await page.getByRole('tab', { name: 'Profitability' }).click();
  await expect(page.getByLabel('Active filters')).toContainText('Year: 2025');
  await page.locator('summary', { hasText: 'Report' }).click();
  await page.getByRole('button', { name: 'Restore saved report' }).click();
  await expect(page.getByRole('tab', { name: 'Sales Overview' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Product Performance' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('tab', { name: 'Sales Overview' })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sales Overview' })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('main report fits the sales content width at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('revo-grid').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Fields' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('chart and visible CSV export are usable from the toolbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('columnheader', { name: 'Sales (sum)' }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Chart' }).click();
  await expect(page.getByRole('button', { name: 'Chart' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Pivot chart', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toBeEmpty();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pivot-visible-report.csv');
  const csv = readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('Sales');
  expect(csv).toContain('Grand Total');
});

import { expect, test } from '@playwright/test';

test('linked charts and Pivot follow the dashboard controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/charts.html');

  await expect(page.getByRole('heading', { name: 'Explore revenue from report to chart' })).toBeVisible();
  await expect(page.locator('.dashboard-grid > revo-grid')).toBeVisible();
  await expect(page.getByTestId('quarter-chart').locator('svg')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('comparison-chart').locator('svg')).toBeVisible();
  await expect(page.getByTestId('quarter-chart').locator('svg')).toContainText('Canada');
  await expect(page.getByText('10,000 source lines', { exact: false })).toBeVisible();
  const firstChart = await page.getByTestId('quarter-chart').locator('svg').innerHTML();

  await page.getByRole('combobox', { name: 'Segment' }).selectOption('Enterprise');
  await expect(page.getByText(/source lines · 2025 · Enterprise/)).toBeVisible();
  await expect.poll(async () => page.getByTestId('quarter-chart').locator('svg').innerHTML())
    .not.toBe(firstChart);
  const filteredChart = await page.getByTestId('quarter-chart').locator('svg').innerHTML();
  await page.getByRole('radio', { name: 'Products' }).check();
  await expect(page.getByRole('heading', { name: 'Quarterly revenue by product' })).toBeVisible();
  await expect(page.getByText('Revenue (USD) · Product × Quarter')).toBeVisible();
  await expect.poll(async () => page.getByTestId('quarter-chart').locator('svg').innerHTML())
    .not.toBe(filteredChart);
  await expect(page.getByTestId('quarter-chart').locator('svg')).toContainText('Apex Suite');

  await page.getByRole('combobox', { name: 'Year' }).selectOption('2024');
  await expect(page.getByText(/source lines · 2024 · Enterprise/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset report' }).click();
  await expect(page.getByText('10,000 source lines', { exact: false })).toBeVisible();
  await expect(page.getByTestId('quarter-chart').locator('svg')).toContainText('Canada');
  expect(errors).toEqual([]);
});

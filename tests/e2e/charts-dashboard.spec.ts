import { expect, test } from '@playwright/test';

test.afterEach(async ({ page }, result) => {
  if (result.status === result.expectedStatus) return;
  const startup = await page.evaluate(async () => {
    const grid = document.querySelector('.dashboard-grid > revo-grid') as HTMLRevoGridElement | null;
    const plugins = grid ? await grid.getPlugins() : [];
    return {
      stage: document.querySelector('.pivot-dashboard')?.getAttribute('data-chart-stage'),
      pluginCount: plugins.length,
      chartCandidates: plugins.filter((plugin) =>
        typeof (plugin as any).createChart === 'function'
        && typeof (plugin as any).getChartData === 'function').length,
      error: document.querySelector('.chart-error')?.textContent,
    };
  }).catch((error) => ({ inspectionError: String(error) }));
  console.error('Pivot chart startup diagnostics:', startup);
});

test('linked charts and Pivot follow the dashboard controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/charts.html');

  await expect(page.getByRole('heading', { name: 'Explore revenue from report to chart' })).toBeVisible();
  await expect(page.locator('.dashboard-grid > revo-grid')).toBeVisible();
  await expect(page.getByTestId('quarter-chart').locator('svg')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('comparison-chart').locator('svg')).toBeVisible();
  await expect(page.locator('.pivot-dashboard')).toHaveAttribute('data-chart-stage', 'ready');
  await expect(page.getByTestId('quarter-chart').locator('svg')).toContainText('Canada');
  await expect(page.getByText(/filtered lines · 2025 · all brands/)).toBeVisible();
  const donut = page.getByTestId('share-chart');
  await expect(donut.locator('[data-pivot-chart-part-to-whole-mark="donut"]')).toHaveCount(4);
  for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) await expect(donut.locator('svg')).toContainText(quarter);
  const donutValues = () => donut.locator('[data-pivot-chart-part-to-whole-mark="donut"]')
    .evaluateAll(marks => marks.map(mark => mark.getAttribute('aria-label')));
  const firstDonut = await donutValues();
  expect(firstDonut).toEqual([
    'Q1, Revenue (USD): $2,050,089.81',
    'Q2, Revenue (USD): $1,627,041.00',
    'Q3, Revenue (USD): $1,908,962.93',
    'Q4, Revenue (USD): $2,190,805.54',
  ]);
  const firstChart = await page.getByTestId('quarter-chart').locator('svg').innerHTML();

  await page.getByRole('combobox', { name: 'Brand' }).selectOption('Contoso');
  await expect(page.getByText(/filtered lines · 2025 · Contoso/)).toBeVisible();
  await expect.poll(async () => page.getByTestId('quarter-chart').locator('svg').innerHTML())
    .not.toBe(firstChart);
  await expect.poll(donutValues).not.toEqual(firstDonut);
  await expect(donut.locator('[data-pivot-chart-part-to-whole-mark="donut"]')).toHaveCount(4);
  const filteredChart = await page.getByTestId('quarter-chart').locator('svg').innerHTML();
  await page.getByRole('radio', { name: 'Categories' }).check();
  await expect(page.getByRole('heading', { name: 'Quarterly revenue by category' })).toBeVisible();
  await expect(page.locator('.pivot-dashboard .pivot-summary-panel')).toHaveCount(0);
  await expect.poll(async () => page.getByTestId('quarter-chart').locator('svg').innerHTML())
    .not.toBe(filteredChart);
  await expect(page.getByTestId('quarter-chart').locator('svg')).toContainText('Computers');

  await page.getByRole('combobox', { name: 'Year' }).selectOption('2024');
  await expect(page.getByText(/filtered lines · 2024 · Contoso/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset report' }).click();
  await expect(page.getByText(/filtered lines · 2025 · all brands/)).toBeVisible();
  await expect(page.getByTestId('quarter-chart').locator('svg')).toContainText('Canada');
  await expect.poll(donutValues).toEqual(firstDonut);
  expect(errors).toEqual([]);
});

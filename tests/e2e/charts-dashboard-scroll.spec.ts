import { expect, test } from '@playwright/test';

for (const width of [1920, 960, 390]) {
  test(`dashboard fits chart cards without nested vertical scrolling at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(process.env.PIVOT_CHARTS_DEMO_URL ?? '/charts.html');
    const dashboard = page.locator('.pivot-dashboard');
    await expect(dashboard).toHaveAttribute('data-chart-stage', 'ready', { timeout: 30000 });
    const comparison = page.getByTestId('comparison-chart');
    await expect(comparison.locator('[data-pivot-chart-category-scroll]')).toHaveCount(0);
    for (const viewport of await dashboard.locator('.dashboard-chart-viewport').all()) {
      expect(await viewport.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      expect(await viewport.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
    }
    await expect(dashboard.locator('.dashboard-chart-scroll-hint')).toHaveCount(0);
    await expect(comparison.locator('[data-pivot-chart-category-label]')).toHaveCount(8);
    await page.getByRole('radio', { name: 'Categories', exact: true }).check();
    await expect(page.getByRole('heading', { name: 'Category comparison', exact: true })).toBeVisible();
    await expect(comparison.locator('[data-pivot-chart-category-scroll]')).toHaveCount(0);
    await expect(comparison.locator('[data-pivot-chart-category-label]')).toHaveCount(8);
    await comparison.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true });
    // A changed report cardinality must resize the linked chart, not retain the initial height.
    await page.evaluate(() => {
      const grid = document.querySelector<HTMLRevoGridElement>('.dashboard-grid > revo-grid')!;
      grid.pivot = { ...grid.pivot, rows: ['Year'] };
    });
    await expect(comparison.locator('[data-pivot-chart-category-label]')).toHaveCount(1);
    await expect(comparison.locator('..')).toHaveCSS('height', '300px');
  });
}

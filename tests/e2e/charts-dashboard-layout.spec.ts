import { expect, test } from '@playwright/test';

test('dashboard controls align and default Pivot columns fill the report', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/charts.html');
  await expect(page.locator('.dashboard-grid > revo-grid')).toBeVisible();
  await expect(page.locator('.dashboard-grid .rgHeaderCell').filter({ hasText: /Q1/ }).first()).toBeVisible();

  const geometry = await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      const bounds = element?.getBoundingClientRect();
      return bounds && { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
    };
    const headerCells = [...document.querySelectorAll<HTMLElement>('.dashboard-grid .rgHeaderCell')]
      .map(element => ({ text: element.textContent?.trim() ?? '', box: element.getBoundingClientRect().toJSON() }));
    const country = headerCells.find(({ text }) => text.includes('Country'))!;
    const quarter = headerCells.find(({ text }) => text === 'Q1')!;
    const total = headerCells.find(({ text }) => text === 'Grand Total')!;
    return { controls: {
      yearLabel: box('.dashboard-controls > label:first-child'),
      yearSelect: box('.dashboard-controls select[aria-label="Year"]'),
      compare: box('.dashboard-compare-options'),
      compareLabel: box('.dashboard-compare-label'),
    }, grid: { host: box('.dashboard-grid'), country: country.box, quarter: quarter.box, total: total.box } };
  });
  expect(geometry.controls.compareLabel).toBeTruthy();
  expect(Math.abs(geometry.controls.compareLabel!.y - geometry.controls.yearLabel!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.controls.compare!.y - geometry.controls.yearSelect!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.controls.compare!.height - geometry.controls.yearSelect!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.grid.total.y - geometry.grid.quarter.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.grid.total.height - geometry.grid.quarter.height)).toBeLessThanOrEqual(1);
  expect(geometry.grid.country.width).toBeGreaterThanOrEqual(200);
  await expect(page.locator('.dashboard-grid .rgCell').filter({ hasText: 'United Kingdom' }).first()).toBeVisible();
  expect(geometry.grid.host!.right - geometry.grid.total.right).toBeLessThanOrEqual(8);
  await page.getByRole('radio', { name: 'Categories' }).check();
  await expect(page.locator('.dashboard-grid .rgHeaderCell').filter({ hasText: 'Grand Total' }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('.dashboard-grid')!;
    const total = [...document.querySelectorAll<HTMLElement>('.dashboard-grid .rgHeaderCell')]
      .find((element) => element.textContent?.trim() === 'Grand Total')!;
    return host.getBoundingClientRect().right - total.getBoundingClientRect().right;
  })).toBeLessThanOrEqual(8);
});

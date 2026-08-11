import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const feature = JSON.parse(
  readFileSync(new URL('../../feature.json', import.meta.url), 'utf8'),
) as { title: string };

test(`${feature.title} mounts without browser errors`, async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.locator('revo-grid').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('tablist', { name: 'Financial report presets' })).toBeVisible();
  const configurator = page.getByRole('button', { name: /Configure|Hide fields/ });
  await expect(configurator).toBeVisible();
  const initialLabel = await configurator.textContent();
  await configurator.click();
  await expect(configurator).not.toHaveText(initialLabel ?? '');
  const screenshot = await page.locator('body').screenshot({ animations: 'disabled' });
  expect(screenshot.byteLength).toBeGreaterThan(10_000);
  expect(errors).toEqual([]);
});

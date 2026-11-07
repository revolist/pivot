import { expect, test } from '@playwright/test';

test('published-package Fields sidebar closes and restores focus', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('financial-pivot-header');
  await expect(header).toBeVisible({ timeout: 30000 });
  const trigger = header.getByRole('button', { name: 'Configurator', exact: true });
  await trigger.click();
  const drawer = page.getByRole('complementary', { name: 'Pivot fields', exact: true });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

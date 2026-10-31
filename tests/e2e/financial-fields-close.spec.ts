import { expect, test } from '@playwright/test';

test('published-package Fields drawer closes and restores focus', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('financial-pivot-header');
  await expect(header).toBeVisible({ timeout: 30000 });
  const trigger = header.getByRole('button', { name: 'Config', exact: true });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Pivot fields', exact: true });
  await expect(drawer).toBeVisible();
  const close = drawer.getByRole('button', { name: 'Close fields', exact: true });
  await expect(close).toBeFocused();
  await close.click();
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

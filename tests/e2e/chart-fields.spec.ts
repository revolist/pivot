import { expect, test } from '@playwright/test';
import { resolvePivotVersion } from '../../scripts/pivot-version.mjs';

const drawerSupported = Number.parseInt(resolvePivotVersion(import.meta.url), 10) >= 4;

test('Fields toggles the chart inspector inside the Fields drawer', async ({ page }) => {
  test.skip(!drawerSupported, 'External settings mounting requires Pivot 4+.');
  await page.goto('/');
  const header = page.locator('financial-pivot-header');
  await expect(header).toBeVisible({ timeout: 30000 });
  await header.getByRole('button', { name: 'Chart', exact: true }).click();
  const settings = page.locator('.rv-pivot-chart-dialog__settings');
  await expect(page.locator('[data-pivot-chart-container]').first()).toBeVisible();
  await expect(settings).toBeHidden();
  await header.getByRole('button', { name: 'Config', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Chart settings' });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('.rv-pivot-chart-dialog__settings')).toBeVisible();
  await expect(drawer.locator('.rv-pivot-chart-settings-host')).toHaveCSS('font-size', '13px');
  await expect(drawer.getByRole('tab')).toHaveText(['Chart', 'Layout', 'Display']);
  const activeTab = drawer.getByRole('tab', { name: 'Chart', exact: true });
  const switchStyle = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const switchElement = element.closest<HTMLElement>('[role="tablist"]')!;
    const switchCss = getComputedStyle(switchElement);
    const drawerBox = element.closest('[role="dialog"]')!.getBoundingClientRect();
    return {
      font: style.font, color: style.color, background: style.backgroundColor,
      radius: style.borderRadius, padding: style.padding, height: element.getBoundingClientRect().height,
      switchRadius: switchCss.borderRadius, switchPadding: switchCss.padding,
      switchHeight: switchElement.getBoundingClientRect().height,
      inset: switchElement.getBoundingClientRect().left - drawerBox.left,
    };
  };
  const chartSwitchStyle = await activeTab.evaluate(switchStyle);
  const chartInactiveStyle = await drawer.getByRole('tab', { name: 'Display', exact: true }).evaluate(switchStyle);
  await expect(activeTab).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await drawer.screenshot({ path: '.artifacts/chart-fields-drawer.png' });
  await drawer.getByRole('tab', { name: 'Layout', exact: true }).click();
  await expect(drawer.getByRole('group', { name: 'Values', exact: true })).toBeVisible();
  await expect(drawer.locator('[data-pivot-chart-control="query.reset"]')).toHaveCount(0);
  await drawer.locator('details[data-pivot-chart-section="filters"] > summary').click();
  await expect(drawer.locator('[data-pivot-chart-control="query.reset"]')).toHaveCount(0);
  await expect(drawer.getByRole('group', { name: 'Rows', exact: true })).toBeVisible();
  await expect(drawer.getByRole('group', { name: 'Columns', exact: true })).toBeVisible();
  await drawer.getByRole('tab', { name: 'Display', exact: true }).click();
  await drawer.getByLabel('Title', { exact: true }).fill('Drawer chart title');
  await expect(page.locator('.financial-pivot-chart .rv-pivot-chart-dialog__settings')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close fields', exact: true }).click();
  await expect(settings).toBeHidden();
  await header.getByRole('button', { name: 'Config', exact: true }).click();
  await expect(drawer.getByLabel('Title', { exact: true })).toHaveValue('Drawer chart title');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await header.getByRole('button', { name: 'Pivot', exact: true }).click();
  await header.getByRole('button', { name: 'Config', exact: true }).click();
  const pivotDrawer = page.getByRole('dialog', { name: 'Pivot fields' });
  await expect(pivotDrawer).toBeVisible();
  const pivotSwitchStyle = await pivotDrawer.getByRole('tab', { name: 'Layout', exact: true }).evaluate(switchStyle);
  expect(chartSwitchStyle).toEqual(pivotSwitchStyle);
  expect(chartInactiveStyle).toEqual(await pivotDrawer.getByRole('tab', { name: 'Display', exact: true }).evaluate(switchStyle));
});

test('Config toggles inline chart settings on Pivot 3 without opening an empty drawer', async ({ page }) => {
  test.skip(drawerSupported, 'Pivot 4+ mounts settings in the drawer.');
  await page.goto('/');
  const header = page.locator('financial-pivot-header');
  await expect(header).toBeVisible({ timeout: 30000 });
  await header.getByRole('button', { name: 'Chart', exact: true }).click();
  await expect(page.locator('[data-pivot-chart-container]').first()).toBeVisible();
  const config = header.getByRole('button', { name: 'Config', exact: true });
  await config.click();
  const settings = page.locator('.financial-pivot-chart .rv-pivot-chart-dialog__settings');
  await expect(settings).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Chart settings', exact: true })).toBeHidden();
  await settings.getByRole('tab', { name: /^(Customize|Display)$/ }).click();
  const title = settings.getByLabel('Title', { exact: true });
  await title.fill('Inline chart settings');
  await config.click();
  await expect(settings).toBeHidden();
  await config.click();
  await expect(settings).toBeVisible();
  await settings.getByRole('tab', { name: /^(Customize|Display)$/ }).click();
  await expect(settings.getByLabel('Title', { exact: true })).toHaveValue('Inline chart settings');
  await header.getByRole('button', { name: 'Pivot', exact: true }).click();
  await config.click();
  await page.getByRole('button', { name: 'Close fields', exact: true }).click();
  await header.getByRole('button', { name: 'Chart', exact: true }).click();
  await expect(settings).toBeHidden();
  await config.click();
  await expect(settings).toBeVisible();
});

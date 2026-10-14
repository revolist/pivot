import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { workbookFixture } from './workbook';
import { parseCsv } from '../src/csv';

const csv = 'Order ID,Region,Revenue\n001,EU,10.25\n002,US,-2.5\n003,EU,\n004,US,20\n005,EU,5\n006,US,7\n007,EU,8\n008,US,9\n009,EU,10\n010,US,1000';
const expectedTotal = [10.25,-2.5,0,20,5,7,8,9,10,1000].reduce((a,b) => a+b,0);
async function upload(page: import('@playwright/test').Page, name: string, buffer: Buffer) {
  await page.goto('/');
  await page.getByLabel('Choose Excel or CSV file').setInputFiles({name,mimeType:name.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
  await expect(page.getByRole('heading',{name:'Review your data'})).toBeVisible();
}
async function assertExport(page: import('@playwright/test').Page, expected = expectedTotal) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export CSV'}).click();
  const download = await downloading;
  const path = await download.path();
  const rows = parseCsv(await readFile(path!,'utf8'));
  const total = rows.find(row => row.some(cell => /grand total/i.test(cell))) ?? (rows.length === 2 ? rows[1] : undefined);
  expect(total, JSON.stringify(rows)).toBeTruthy();
  expect(Number(total!.at(-1)!.replace(/,/g,''))).toBeCloseTo(expected,6);
  return rows;
}

test('CSV upload preserves IDs, includes rows beyond preview, edits layout, charts and exports exact totals', async ({page}) => {
  await upload(page,'sales.csv',Buffer.from(csv));
  await expect(page.getByLabel('Type for Order ID')).toHaveValue('text');
  await expect(page.getByLabel('Type for Revenue')).toHaveValue('number');
  await expect(page.getByText('Your pivot will include all 10 selected rows.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Create pivot',exact:true}).click();
  await expect(page.getByText('All 10 selected rows included')).toBeVisible();
  await expect(page.locator('.import-result-grid')).toContainText('EU');
  await assertExport(page);
  await page.getByRole('tab',{name:'Source data'}).click();
  await expect(page.locator('.import-source-grid')).toContainText('001');
  await page.getByRole('tab',{name:'Pivot',exact:false}).click();
  await page.getByRole('checkbox',{name:'Select Record count',exact:true}).click();
  await expect(page.locator('.import-result-grid')).toContainText('Record count');
  await page.getByRole('tab',{name:'Chart'}).click();
  await expect(page.locator('.import-chart svg').first()).toBeVisible();
  await page.getByRole('tab',{name:'Pivot',exact:false}).click();
  await page.getByRole('button',{name:'Review data',exact:true}).click();
  await expect(page.getByLabel('Type for Order ID')).toHaveValue('text');
  await page.getByRole('button',{name:'Choose another file',exact:false}).click();
  await expect(page.getByRole('heading',{name:'Drop your file here'})).toBeVisible();
});

for (const date1904 of [false,true]) test(`real XLSX: sheet/header/date detection and cached formula totals (${date1904 ? '1904' : '1900'} dates)`, async ({page}) => {
  await upload(page,'workbook.xlsx',workbookFixture(date1904));
  await page.getByLabel('Worksheet',{exact:true}).selectOption({label:'Orders'});
  await expect(page.getByLabel('Header row',{exact:true})).toHaveValue('3');
  await expect(page.getByLabel('Type for Date',{exact:true})).toHaveValue('date');
  await expect(page.locator('.import-preview-table')).toContainText('2026-01-01');
  await page.getByRole('button',{name:'Create pivot',exact:true}).click();
  await expect(page.locator('.import-result-grid')).toContainText('EU');
  await assertExport(page);
});

test('mixed columns block invalid conversions; ranges and decimal overrides are applied', async ({page}) => {
  await upload(page,'mixed.csv',Buffer.from('Region;Amount\nEU;10,5\nUS;not-a-number\nEU;2,25'));
  await page.getByLabel('Decimal separator').selectOption(',');
  await page.getByLabel('Type for Amount').selectOption('number');
  await expect(page.getByRole('alert')).toContainText('Amount: 1 value');
  await expect(page.getByRole('button',{name:'Create pivot',exact:true})).toBeDisabled();
  await page.getByLabel('Type for Amount').selectOption('text');
  await expect(page.getByRole('button',{name:'Create pivot',exact:true})).toBeEnabled();
  await page.getByText('Data range',{exact:true}).click();
  await page.getByLabel('Last data row').fill('2');
  await page.getByLabel('Decimal separator').selectOption('.');
  await page.getByLabel('Decimal separator').selectOption(',');
  await expect(page.getByLabel('Last data row')).toHaveValue('2');
  await page.getByLabel('Type for Amount').selectOption('number');
  await page.getByRole('button',{name:'Create pivot',exact:true}).click();
  await assertExport(page,10.5);
});

test('sample and empty layout work on mobile with accessible field drawer and no page overflow', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Try sample sales data'}).click();
  await page.getByRole('button',{name:'Start empty',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Build your first report'})).toBeVisible();
  await page.getByRole('button',{name:'Fields',exact:true}).click();
  const dialog = page.getByRole('dialog',{name:'Build your pivot'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox',{name:'Select Revenue',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.import-result-grid')).toContainText('Revenue');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Replace file',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Drop your file here'})).toBeVisible();
});

test('unsupported, malformed and empty files show errors and allow a successful retry', async ({page}) => {
  await page.goto('/');
  const input = page.getByLabel('Choose Excel or CSV file');
  await input.setInputFiles({name:'old.xls',mimeType:'application/octet-stream',buffer:Buffer.from('x')});
  await expect(page.getByRole('alert')).toContainText('Choose an Excel');
  await input.setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('A,B\n"unfinished,1')});
  await expect(page.getByRole('alert')).toContainText('not closed');
  await input.setInputFiles({name:'empty.csv',mimeType:'text/csv',buffer:Buffer.from('')});
  await expect(page.getByRole('alert')).toContainText('No data found');
  await input.setInputFiles({name:'valid.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.getByRole('heading',{name:'Review your data'})).toBeVisible();
});

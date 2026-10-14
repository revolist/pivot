import { parseCsv } from './csv';
import { LIMITS, validateMatrix, type Matrix, type Workbook } from './import.types';

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    if (file.size > LIMITS.bytes) throw new Error('Choose a file smaller than 10 MB.');
    let sheets: Workbook['sheets'];
    if (/\.csv$/i.test(file.name)) {
      sheets = [{ name: 'Data', cells: parseCsv(await file.text()) }];
    } else if (/\.xlsx$/i.test(file.name)) {
      const { default: readWorkbook } = await import('read-excel-file/web-worker');
      const workbook = await readWorkbook(await file.arrayBuffer(), { trim: false });
      sheets = workbook.map(sheet => ({ name: sheet.sheet, cells: sheet.data as unknown as Matrix }));
    } else throw new Error('Choose an Excel (.xlsx) or CSV (.csv) file.');
    sheets.forEach(sheet => validateMatrix(sheet.cells));
    sheets = sheets.filter(sheet => sheet.cells.some(row => row.some(cell => cell !== null && cell !== '')));
    if (!sheets.length) throw new Error('No data found. Choose a workbook with a populated table.');
    self.postMessage({ workbook: { name: file.name, sheets } satisfies Workbook });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not read this file. Try saving it as XLSX or UTF-8 CSV.' });
  }
};

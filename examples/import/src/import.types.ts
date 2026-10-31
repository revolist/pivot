export type Cell = string | number | boolean | Date | null;
export type Matrix = Cell[][];
export type Workbook = { name: string; sheets: { name: string; cells: Matrix }[] };
export type FieldType = 'text' | 'number' | 'date';
export type Field = { key: string; name: string; type: FieldType; distinct: number; blanks: number; mixed: boolean; identifier: boolean };
export const LIMITS = { bytes: 10 * 1024 * 1024, rows: 100_000, columns: 200, cells: 1_000_000 };
export function validateMatrix(cells: Matrix) {
  if (cells.length > LIMITS.rows + 30) throw new Error('This sheet exceeds 100,000 rows. Choose a smaller file.');
  const width = cells.reduce((max, row) => Math.max(max, row.length), 0);
  if (width > LIMITS.columns || cells.length * width > LIMITS.cells) {
    throw new Error('This sheet is too large for this demo (200 columns / 1 million cells). Choose a smaller file.');
  }
}

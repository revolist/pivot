import { formatIsoDate, formatIsoDateTime, isValidIsoDate, isValidIsoDateTime, parseIsoDate } from '@revolist/revogrid-pro';
import type { PivotConfig, PivotConfigDimension } from '@revolist/pivot';
import { LIMITS, type Cell, type Field, type FieldType, type Matrix, type Workbook } from './import.types';

export function displayCell(cell: Cell | undefined): string {
  if (cell instanceof Date) {
    return cell.getUTCHours() || cell.getUTCMinutes() || cell.getUTCSeconds() || cell.getUTCMilliseconds() ? formatIsoDateTime(cell) : formatIsoDate(cell);
  }
  return cell == null ? '' : String(cell);
}
const empty = (cell: Cell | undefined) => cell == null || (typeof cell === 'string' && !cell.trim());
const idName = (name: string) => /(?:\b(?:id|code|zip|postal|phone|account|sku)\b|identifier)/i.test(name);

/** Accept unambiguous decimal syntax only; locale is an explicit review setting. */
export function numberValue(cell: Cell, decimal: '.' | ','): number | undefined {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : undefined;
  if (typeof cell !== 'string') return undefined;
  const value = cell.trim();
  const pattern = decimal === '.' ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i : /^[+-]?(?:\d+(?:,\d*)?|,\d+)(?:e[+-]?\d+)?$/i;
  if (!pattern.test(value)) return undefined;
  const parsed = Number(decimal === ',' ? value.replace(',', '.') : value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function isDate(cell: Cell) {
  if (cell instanceof Date) return !Number.isNaN(cell.getTime());
  return typeof cell === 'string' && (isValidIsoDateTime(cell) || (isValidIsoDate(cell) && formatIsoDate(parseIsoDate(cell)) === cell));
}

export function detectHeader(cells: Matrix): number {
  let best = 0, score = -Infinity;
  cells.slice(0, 20).forEach((row, index) => {
    const filled = row.filter(cell => !empty(cell));
    if (!filled.length) return;
    const next = cells[index + 1] ?? [];
    const strings = filled.filter(cell => typeof cell === 'string').length;
    const candidate = filled.length * 3 + strings + Math.min(next.filter(cell => !empty(cell)).length, filled.length) - index * 0.15;
    if (candidate > score) { best = index; score = candidate; }
  });
  return best + 1;
}

export function inspectTable(cells: Matrix, headerRow: number, firstRow: number, lastRow: number, decimal: '.' | ',') {
  if (![headerRow, firstRow, lastRow].every(Number.isInteger) || headerRow < 1 || headerRow >= cells.length || firstRow <= headerRow || lastRow < firstRow || lastRow > cells.length) {
    throw new Error('Choose a header row and a data range below it within this sheet.');
  }
  const source = cells.slice(firstRow - 1, lastRow).filter(row => row.some(cell => !empty(cell)));
  if (!source.length) throw new Error('This range has no data rows.');
  if (source.length > LIMITS.rows) throw new Error('Choose at most 100,000 data rows.');
  const width = source.reduce((max, row) => Math.max(max, row.length), cells[headerRow - 1].length);
  const usedNames = new Set<string>();
  const fields: Field[] = [];
  for (let index = 0; index < width; index++) {
    const rawName = displayCell(cells[headerRow - 1][index]).trim() || `Column ${index + 1}`;
    let name = rawName, suffix = 2;
    while (usedNames.has(name)) name = `${rawName} (${suffix++})`;
    usedNames.add(name);
    const populated = source.map(row => row[index]).filter(cell => !empty(cell)) as Cell[];
    const identifier = idName(name) || populated.some(cell => typeof cell === 'string' && /^0\d+$/.test(cell.trim()));
    const numeric = populated.filter(cell => numberValue(cell, decimal) !== undefined).length;
    const dated = populated.filter(isDate).length;
    const type: FieldType = !identifier && populated.length && numeric === populated.length ? 'number' : populated.length && dated === populated.length ? 'date' : 'text';
    fields.push({ key: `field_${index}`, name, type, identifier, distinct: new Set(populated.map(displayCell)).size, blanks: source.length - populated.length, mixed: (numeric > 0 && numeric < populated.length) || (dated > 0 && dated < populated.length) });
  }
  return { fields, source };
}

/** Convert separately from the immutable workbook; a bad override never drops data. */
export function prepareSource(source: Matrix, fields: Field[], decimal: '.' | ',') {
  const errors = new Map<string, number>();
  const rows = source.map(cells => {
    const row: Record<string, string | number | null> = { record_count: 1 };
    fields.forEach((field, index) => {
      const cell = cells[index];
      if (empty(cell)) { row[field.key] = null; return; }
      if (field.type === 'number') {
        const numeric = numberValue(cell, decimal);
        if (numeric === undefined) errors.set(field.name, (errors.get(field.name) ?? 0) + 1);
        row[field.key] = numeric ?? null;
      } else if (field.type === 'date') {
        if (!isDate(cell)) errors.set(field.name, (errors.get(field.name) ?? 0) + 1);
        row[field.key] = isDate(cell) ? displayCell(cell) : null;
      } else row[field.key] = displayCell(cell);
    });
    return row;
  });
  return { rows, errors: [...errors].map(([name, count]) => `${name}: ${count.toLocaleString()} value${count === 1 ? '' : 's'} cannot be read as the selected type. Choose Text or correct the data.`) };
}

// Null-safe aggregators keep missing amounts out of averages and counts.
const numbers = (values: unknown[]) => values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
export const importAggregators = {
  sum: (values: unknown[]) => { const valid = numbers(values); return valid.length ? valid.reduce((sum, value) => sum + value, 0) : undefined; },
  avg: (values: unknown[]) => { const valid = numbers(values); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined; },
  min: (values: unknown[]) => { const valid = numbers(values); return valid.length ? valid.reduce((a, b) => Math.min(a, b)) : undefined; },
  max: (values: unknown[]) => { const valid = numbers(values); return valid.length ? valid.reduce((a, b) => Math.max(a, b)) : undefined; },
  count: (values: unknown[]) => values.filter(value => value != null && value !== '').length,
};

export function suggestReport(fields: Field[]) {
  const category = fields.filter(field => field.type === 'text' && !field.identifier && field.distinct > 1 && field.distinct <= 100).sort((a, b) => Number(/region|category|department|country/i.test(b.name)) - Number(/region|category|department|country/i.test(a.name)) || a.distinct - b.distinct)[0];
  const measure = fields.find(field => field.type === 'number' && !field.identifier);
  return { category, measure, label: `${measure ? `Sum of ${measure.name}` : 'Record count'}${category ? ` by ${category.name}` : ''}` };
}

export function createImportPivot(fields: Field[], startEmpty = false, mountTo?: HTMLElement): PivotConfig {
  const suggestion = suggestReport(fields);
  const dimensions: PivotConfigDimension[] = fields.map(field => ({
    prop: field.key, name: field.name, size: 160, sortable: true,
    dataType: field.type === 'text' ? 'string' : field.type,
    selectionTarget: field.type === 'number' && !field.identifier ? 'values' : 'rows',
    aggregators: field.type === 'number' ? importAggregators : { count: importAggregators.count },
  }));
  dimensions.push({ prop: 'record_count', name: 'Record count', size: 160, aggregators: { sum: importAggregators.sum }, selectionTarget: 'values', dataType: 'number' });
  return {
    dimensions, rows: startEmpty || !suggestion.category ? [] : [suggestion.category.key], columns: [],
    values: startEmpty ? [] : [{ prop: suggestion.measure?.key ?? 'record_count', aggregator: 'sum', label: suggestion.measure?.name ?? 'Record count', format: { preset: 'number', options: { maximumFractionDigits: 2 } } }],
    filters: [], totals: { grandTotal: true, subtotals: true }, hasConfigurator: true, mountTo,
    fieldPanel: { visible: false }, collapsed: true, groupAggregations: true,
  };
}

export function sampleWorkbook(): Workbook {
  const cells: Matrix = [['Order ID', 'Region', 'Product', 'Channel', 'Revenue', 'Units', 'Order date']];
  const regions = ['Europe', 'North America', 'Asia Pacific', 'Latin America'];
  for (let i = 0; i < 240; i++) cells.push([`ORD-${String(i + 1).padStart(4, '0')}`, regions[i % 4], ['Laptop', 'Monitor', 'Keyboard'][i % 3], ['Online', 'Retail'][Math.floor(i / 4) % 2], 75 + (i % 19) * 42.5, 1 + i % 8, `2026-${String(1 + i % 12).padStart(2, '0')}-${String(1 + i % 27).padStart(2, '0')}`]);
  return { name: 'Sample sales.csv', sheets: [{ name: 'Orders', cells }] };
}

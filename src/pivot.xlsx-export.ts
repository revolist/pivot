/** A workbook of the current Pivot result; source rows are supplied by the caller. */
import { zipSync, strToU8 } from 'fflate';
import type { ColumnGrouping, ColumnRegular, DataType } from '@revolist/revogrid';
export interface PivotXlsxExportInput {
  columns: Array<ColumnGrouping | ColumnRegular>;
  source?: DataType[];
  pinnedBottomSource?: DataType[];
}

type PivotColumn = ColumnGrouping | ColumnRegular;
type Cell = { row: number; col: number; value: unknown; style: number };
type Merge = { firstRow: number; lastRow: number; firstCol: number; lastCol: number };

const escapeXml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[character]!);

function columnLabel(index: number): string {
  let value = index + 1;
  let label = '';
  while (value) { value--; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); }
  return label;
}

function group(column: PivotColumn): column is ColumnGrouping {
  return Array.isArray((column as ColumnGrouping).children);
}

function depth(column: PivotColumn): number {
  return group(column) ? 1 + Math.max(0, ...column.children.map(depth)) : 1;
}

function width(column: PivotColumn): number {
  return group(column) ? column.children.reduce((sum, child) => sum + width(child), 0) : 1;
}

function workbookModel(input: PivotXlsxExportInput) {
  const cells: Cell[] = [];
  const merges: Merge[] = [];
  const leaves: ColumnRegular[] = [];
  const headerDepth = Math.max(0, ...input.columns.map(depth));
  const visit = (column: PivotColumn, row: number, col: number): number => {
    const span = width(column);
    if (!span) return col;
    cells.push({ row, col, value: column.name ?? '', style: 1 });
    if (group(column)) {
      if (span > 1) merges.push({ firstRow: row, lastRow: row, firstCol: col, lastCol: col + span - 1 });
      let cursor = col;
      for (const child of column.children) cursor = visit(child, row + 1, cursor);
    } else {
      leaves.push(column);
      if (row < headerDepth - 1) merges.push({ firstRow: row, lastRow: headerDepth - 1, firstCol: col, lastCol: col });
    }
    return col + span;
  };
  input.columns.reduce((col, column) => visit(column, 0, col), 0);
  const source = input.source ?? [];
  const allRows = [...source, ...(input.pinnedBottomSource ?? [])];
  allRows.forEach((data, index) => leaves.forEach((column, col) => {
    const value = data[column.prop];
    cells.push({ row: headerDepth + index, col, value,
      style: index >= source.length ? 3 : typeof value === 'number' && Number.isFinite(value) ? 2 : 0 });
  }));
  return { cells, merges, rows: headerDepth + allRows.length, cols: leaves.length, headerDepth };
}

function worksheet(input: PivotXlsxExportInput) {
  const model = workbookModel(input);
  const rows = new Map<number, Cell[]>();
  model.cells.forEach((cell) => rows.set(cell.row, [...(rows.get(cell.row) ?? []), cell]));
  const sheetData = Array.from({ length: model.rows }, (_, index) => {
    const cells = rows.get(index) ?? [];
    const xml = cells.map((cell) => {
      const ref = `${columnLabel(cell.col)}${index + 1}`;
      if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
        return `<c r="${ref}" s="${cell.style}" t="n"><v>${cell.value}</v></c>`;
      }
      const text = typeof cell.value === 'object' && cell.value !== null ? JSON.stringify(cell.value) : cell.value;
      return `<c r="${ref}" s="${cell.style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
    }).join('');
    return `<row r="${index + 1}">${xml}</row>`;
  }).join('');
  const mergeXml = model.merges.length
    ? `<mergeCells count="${model.merges.length}">${model.merges.map((merge) =>
      `<mergeCell ref="${columnLabel(merge.firstCol)}${merge.firstRow + 1}:${columnLabel(merge.lastCol)}${merge.lastRow + 1}"/>`).join('')}</mergeCells>` : '';
  const last = `${columnLabel(Math.max(0, model.cols - 1))}${Math.max(1, model.rows)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="${model.headerDepth}" topLeftCell="A${model.headerDepth + 1}" state="frozen"/></sheetView></sheetViews><sheetData>${sheetData}</sheetData>${mergeXml}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.25" footer="0.25"/></worksheet>`;
}

/** Exports grouped headers, typed numeric cells, visible rows and pinned totals as real XLSX bytes. */
export function exportVisiblePivotToXlsx(input: PivotXlsxExportInput): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Visible Pivot Result" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F1F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="1" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>'),
    'xl/worksheets/sheet1.xml': strToU8(worksheet(input)),
  };
  return zipSync(entries, { level: 6 });
}

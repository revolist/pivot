import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/csv';
import { createImportPivot, detectHeader, importAggregators, inspectTable, prepareSource, sampleWorkbook, suggestReport } from '../src/import.model';
import { LIMITS, validateMatrix, type Matrix } from '../src/import.types';

describe('file parsing and table detection', () => {
  it('reads BOM, quoted delimiters/newlines, escaped quotes, semicolon and tabs', () => {
    expect(parseCsv('\uFEFFName,Value\r\n"North, East",1\r\n"line\n""two""",2')).toEqual([['Name','Value'],['North, East','1'],['line\n"two"','2']]);
    expect(parseCsv('"Multi\nline";Amount\nA;2')).toEqual([['Multi\nline','Amount'],['A','2']]);
    expect(parseCsv('Name;Amount\nA;1,25')).toEqual([['Name','Amount'],['A','1,25']]);
    expect(parseCsv('Name\tAmount\nA\t2')).toEqual([['Name','Amount'],['A','2']]);
    expect(() => parseCsv('Name,Amount\n"broken,1')).toThrow('not closed');
    expect(() => parseCsv('Name,Amount\n"x"oops,1')).toThrow('Unexpected text');
  });
  it('detects a header after a title and keeps fields that first appear after preview rows', () => {
    const matrix: Matrix = [['Sales report'],[],['Region','Amount'],['Europe',1], ...Array.from({ length: 110 }, () => ['Asia',2]), ['US',3,'extra']];
    expect(detectHeader(matrix)).toBe(3);
    expect(detectHeader([['Name','Name'],['A','B']])).toBe(1);
    const inspected = inspectTable(matrix, 3, 4, matrix.length, '.');
    expect(inspected.fields.map(field => field.name)).toEqual(['Region','Amount','Column 3']);
    expect(inspected.source).toHaveLength(112);
  });
  it('creates unique names/keys without treating headers as object properties', () => {
    const { fields, source } = inspectTable([['Revenue','Revenue','__proto__',null], [1,2,'safe',3]],1,2,2,'.');
    expect(fields.map(field => field.name)).toEqual(['Revenue','Revenue (2)','__proto__','Column 4']);
    expect(prepareSource(source,fields,'.').rows[0]).toEqual({record_count:1,field_0:1,field_1:2,field_2:'safe',field_3:3});
  });
  it('rejects invalid ranges and oversized sheets instead of truncating them', () => {
    expect(() => inspectTable([['A'],[1]],1,1,2,'.')).toThrow('data range');
    expect(() => validateMatrix([Array(LIMITS.columns + 1).fill('x')])).toThrow('too large');
  });
});

describe('safe normalization and report mapping', () => {
  it('preserves leading-zero and numeric ID columns, blanks, negative amounts and decimals', () => {
    const matrix: Matrix = [['Order ID','Postal code','Amount'], ['123','00123','-10.25'],['124','00456',null],['125','00789','20.5']];
    const {fields,source} = inspectTable(matrix,1,2,4,'.');
    expect(fields.map(field => field.type)).toEqual(['text','text','number']);
    const result = prepareSource(source,fields,'.');
    expect(result.errors).toEqual([]);
    expect(result.rows.map(row => row.field_2)).toEqual([-10.25,null,20.5]);
    expect(result.rows[0].field_1).toBe('00123');
    expect(importAggregators.sum(result.rows.map(row => row.field_2))).toBe(10.25);
    expect(importAggregators.avg(result.rows.map(row => row.field_2))).toBe(5.125);
    expect(importAggregators.sum([null,undefined])).toBeUndefined();
  });
  it('keeps mixed data and ambiguous dates as text, blocking lossy overrides', () => {
    const {fields,source} = inspectTable([['Value','Date'],['12','01/02/2026'],['N/A','02/03/2026']],1,2,3,'.');
    expect(fields.map(field => field.type)).toEqual(['text','text']);
    expect(fields[0].mixed).toBe(true);
    fields[0].type = 'number'; fields[1].type = 'date';
    expect(prepareSource(source,fields,'.').errors).toHaveLength(2);
  });
  it('recognizes real Excel dates and valid ISO dates, retaining comma decimals', () => {
    const {fields,source} = inspectTable([['Date','Amount'],[new Date('2026-03-02T00:00:00Z'),'12,5'],['2026-04-05','-2,25']],1,2,3,',');
    expect(fields.map(field => field.type)).toEqual(['date','number']);
    expect(prepareSource(source,fields,',').rows[0].field_0).toBe('2026-03-02');
    expect(prepareSource(source,fields,',').rows[1].field_1).toBe(-2.25);
    expect(prepareSource([[new Date('2026-03-02T15:30:00Z'), '1']], fields, '.').rows[0].field_0).toBe('2026-03-02T15:30:00.000Z');
    const invalid = inspectTable([['Date'],['2026-02-30']],1,2,2,'.');
    expect(invalid.fields[0].type).toBe('text');
  });
  it.each([
    ['2024-02-29', 'date'],
    ['2026-02-29', 'text'],
    ['2026-13-01', 'text'],
    ['2026-03-29T01:30:00.123Z', 'date'],
    ['2026-03-29T01:30:00Z', 'text'],
    ['2026-03-29T01:30:00.000+00:00', 'text'],
    ['2026-03-29T01:30:00', 'text'],
    [' 2026-03-29 ', 'text'],
  ])('classifies canonical ISO input %s as %s', (value, expected) => {
    const { fields, source } = inspectTable([['Date'], [value]], 1, 2, 2, '.');
    expect(fields[0].type).toBe(expected);
    expect(prepareSource(source, fields, '.').rows[0].field_0).toBe(value);
  });
  it('preserves UTC dates and timestamp milliseconds from Excel Date cells', () => {
    const values = [new Date('2026-03-29T00:00:00.000Z'), new Date('2026-03-29T00:00:00.001Z')];
    const { fields, source } = inspectTable([['Date'], ...values.map(value => [value])], 1, 2, 3, '.');
    expect(prepareSource(source, fields, '.').rows.map(row => row.field_0)).toEqual(['2026-03-29', '2026-03-29T00:00:00.001Z']);
  });
  it('includes all accepted rows and exposes every field through Pivot dimensions', () => {
    const cells = sampleWorkbook().sheets[0].cells;
    const {fields,source} = inspectTable(cells,1,2,cells.length,'.');
    expect(source).toHaveLength(240);
    const config = createImportPivot(fields);
    expect(config.dimensions).toHaveLength(fields.length + 1);
    expect(config.values[0].prop).toBe('field_4');
    expect(config.rows.length).toBe(1);
    expect(createImportPivot(fields,true).values).toEqual([]);
  });
  it('suggests record count when no numeric measure exists', () => {
    const {fields} = inspectTable([['Region'],['EU'],['US']],1,2,3,'.');
    expect(suggestReport(fields).label).toBe('Record count by Region');
    expect(createImportPivot(fields).values[0].prop).toBe('record_count');
  });
});

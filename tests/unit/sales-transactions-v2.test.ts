import { describe, expect, it } from 'vitest';
import { FINANCIAL_DATA } from '../../src/financial-dataset';
import {
  SALES_TRANSACTIONS_V2,
  SALES_TRANSACTIONS_V2_VERSION,
  createSalesTransactionsV2,
  type SalesTransactionV2,
} from '../../src/sales-transactions-v2';

const cents = (amount: number) => Math.round(amount * 100);
const totalCents = (rows: SalesTransactionV2[], field: 'Sales' | 'Profit') =>
  rows.reduce((sum, row) => sum + cents(row[field]), 0);

describe('synthetic sales transactions v2', () => {
  it('keeps the prior financial fixture and creates stable IDs over two complete years', () => {
    expect(SALES_TRANSACTIONS_V2_VERSION).toBe('2.0.0');
    expect(FINANCIAL_DATA).toHaveLength(3_600);
    expect(SALES_TRANSACTIONS_V2).toHaveLength(20_000);
    expect(createSalesTransactionsV2()).toEqual(SALES_TRANSACTIONS_V2);

    const years = new Map<number, number>();
    const months = new Set<string>();
    const quarters = new Set<string>();
    const lineIds = new Set<string>();
    const orderIds = new Set<string>();
    const orderDetails = new Map<string, string>();

    for (const row of SALES_TRANSACTIONS_V2) {
      years.set(row.Year, (years.get(row.Year) ?? 0) + 1);
      months.add(`${row.Year}-${row.Date.slice(5, 7)}`);
      quarters.add(`${row.Year}-${row.Quarter}`);
      lineIds.add(row['Line ID']);
      orderIds.add(row['Order ID']);
      const details = [row.Date, row.Country, row.Segment, row.Channel, row['Discount Band']].join('|');
      expect(orderDetails.get(row['Order ID']) ?? details).toBe(details);
      orderDetails.set(row['Order ID'], details);
      expect(row.Date).toMatch(/^202[45]-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9])$/);
      expect(row['Line ID']).toMatch(/^ORD-202[45]-\d{5}-L[12]$/);
    }

    expect([...years]).toEqual([[2024, 10_000], [2025, 10_000]]);
    expect(months.size).toBe(24);
    expect(quarters.size).toBe(8);
    expect(lineIds.size).toBe(20_000);
    expect(orderIds.size).toBe(10_000);
  });

  it('has known USD totals, coherent arithmetic, seasonality, and a real loss cohort', () => {
    const rows2024 = SALES_TRANSACTIONS_V2.slice(0, 10_000);
    const rows2025 = SALES_TRANSACTIONS_V2.slice(10_000);

    expect(totalCents(SALES_TRANSACTIONS_V2, 'Sales')).toBe(4_706_964_519);
    expect(totalCents(SALES_TRANSACTIONS_V2, 'Profit')).toBe(1_563_046_229);
    expect(totalCents(rows2024, 'Sales')).toBe(2_221_454_500);
    expect(totalCents(rows2025, 'Sales')).toBe(2_485_510_019);
    expect(totalCents(rows2024, 'Profit')).toBe(719_952_944);
    expect(totalCents(rows2025, 'Profit')).toBe(843_093_285);

    for (const row of SALES_TRANSACTIONS_V2) {
      expect(cents(row['Gross Sales']) - cents(row.Discounts)).toBe(cents(row.Sales));
      expect(cents(row.Sales) - cents(row.COGS)).toBe(cents(row.Profit));
      expect(row['Units Sold']).toBeGreaterThan(0);
    }

    const salesFor = (rows: SalesTransactionV2[], product: string) =>
      totalCents(rows.filter((row) => row.Product === product), 'Sales');
    const averageUnits = (quarter: string) => {
      const matching = SALES_TRANSACTIONS_V2.filter((row) => row.Quarter === quarter);
      return matching.reduce((sum, row) => sum + row['Units Sold'], 0) / matching.length;
    };
    expect(salesFor(rows2025, 'Cobalt Cloud')).toBeGreaterThan(salesFor(rows2024, 'Cobalt Cloud'));
    expect(salesFor(rows2025, 'Delta One')).toBeLessThan(salesFor(rows2024, 'Delta One'));
    expect(averageUnits('Q4')).toBeGreaterThan(averageUnits('Q2'));
    expect(SALES_TRANSACTIONS_V2.filter((row) => row.Profit < 0)).toHaveLength(1_254);
  });
});

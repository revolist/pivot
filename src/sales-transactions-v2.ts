import type { FinancialRow } from './financial-dataset';

/** Synthetic, reproducible order lines for the sales-focused Pivot demos. */
export interface SalesTransactionV2 extends FinancialRow {
  'Order ID': string;
  'Line ID': string;
  Category: string;
  Channel: string;
  Quarter: string;
}

export const SALES_TRANSACTIONS_V2_VERSION = '2.0.0';

const ROWS_PER_YEAR = 10_000;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const COUNTRIES = ['Canada', 'France', 'Germany', 'Mexico', 'United States'] as const;
const SEGMENTS = ['Enterprise', 'Government', 'Midmarket', 'Small Business'] as const;
const CHANNELS = ['Online', 'Partner', 'Retail'] as const;
const PRODUCTS = [
  { name: 'Apex Suite', category: 'Productivity', priceCents: 32_000, costCents: 18_500 },
  { name: 'Beacon Pro', category: 'Productivity', priceCents: 18_500, costCents: 10_400 },
  { name: 'Cobalt Cloud', category: 'Analytics', priceCents: 12_000, costCents: 6_200 },
  { name: 'Delta One', category: 'Infrastructure', priceCents: 9_500, costCents: 8_500 },
  { name: 'Evergreen', category: 'Analytics', priceCents: 24_500, costCents: 15_100 },
] as const;
const DISCOUNTS = [
  { band: 'None', rate: 0 },
  { band: 'Low', rate: 4 },
  { band: 'Medium', rate: 10 },
  { band: 'High', rate: 20 },
] as const;

function hash(index: number, salt: number): number {
  let value = Math.imul(index + 1, 0x9e3779b1) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

const usd = (cents: number) => cents / 100;

/**
 * The same line index uses the same dimension mix in both years, making the
 * year-on-year patterns intentional instead of artifacts of a random draw.
 * Money is calculated in cents before it is exposed as USD numbers.
 */
export function createSalesTransactionsV2(): SalesTransactionV2[] {
  const rows: SalesTransactionV2[] = [];

  for (const year of [2024, 2025]) {
    const laterYear = year === 2025;

    for (let index = 0; index < ROWS_PER_YEAR; index += 1) {
      const orderIndex = Math.floor(index / 2);
      const monthIndex = orderIndex % MONTHS.length;
      const productIndex = hash(index, 11) % PRODUCTS.length;
      const product = PRODUCTS[productIndex];
      const country = COUNTRIES[hash(orderIndex, 17) % COUNTRIES.length];
      const segment = SEGMENTS[hash(orderIndex, 23) % SEGMENTS.length];
      const channel = CHANNELS[hash(orderIndex, 29) % CHANNELS.length];
      const discount = DISCOUNTS[hash(orderIndex, 31) % DISCOUNTS.length];
      const day = (hash(orderIndex, 37) % 28) + 1;
      const quarterNumber = Math.floor(monthIndex / 3) + 1;

      // Q4 is the busy season. Cobalt grows, while Delta demand declines in 2025.
      const baseUnits = 3 + (hash(index, 41) % 18);
      const seasonalUnits = quarterNumber === 4 ? 3 : monthIndex === 1 ? -1 : 0;
      const productTrend = laterYear ? (productIndex === 2 ? 3 : productIndex === 3 ? -2 : 1) : 0;
      const countryUnits = country === 'United States' ? 2 : 0;
      const unitsSold = Math.max(1, baseUnits + seasonalUnits + productTrend + countryUnits);

      const unitPriceCents = Math.round(product.priceCents * (laterYear ? 1.04 : 1));
      const unitCostCents = Math.round(product.costCents * (laterYear ? 1.03 : 1));
      const segmentCostPercent = segment === 'Small Business' ? 106 : 100;
      const grossSalesCents = unitsSold * unitPriceCents;
      const discountsCents = Math.round((grossSalesCents * discount.rate) / 100);
      const salesCents = grossSalesCents - discountsCents;
      const cogsCents = Math.round((unitsSold * unitCostCents * segmentCostPercent) / 100);
      const orderId = `ORD-${year}-${String(orderIndex + 1).padStart(5, '0')}`;

      rows.push({
        'Order ID': orderId,
        'Line ID': `${orderId}-L${(index % 2) + 1}`,
        Date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        Year: year,
        Quarter: `Q${quarterNumber}`,
        Month: MONTHS[monthIndex],
        Country: country,
        Segment: segment,
        Channel: channel,
        Category: product.category,
        Product: product.name,
        'Discount Band': discount.band,
        'Units Sold': unitsSold,
        'Gross Sales': usd(grossSalesCents),
        Discounts: usd(discountsCents),
        Sales: usd(salesCents),
        COGS: usd(cogsCents),
        Profit: usd(salesCents - cogsCents),
      });
    }
  }

  return rows;
}

export const SALES_TRANSACTIONS_V2 = createSalesTransactionsV2();

import { gunzipSync, strFromU8 } from 'fflate';

export interface ContosoSale {
  'Order ID': string;
  'Line ID': string;
  Date: string;
  Year: number;
  Quarter: string;
  Month: string;
  'Month Number': number;
  Country: string;
  'Store Country': string;
  Store: string;
  Category: string;
  Subcategory: string;
  Product: string;
  Brand: string;
  Quantity: number;
  Revenue: number;
  Cost: number;
  'Gross Profit': number;
  'Order Currency': string;
  'Reporting Currency': 'USD';
}

export interface ContosoData {
  version: 2;
  sourceSha256: string;
  metadata: {
    lineCount: number;
    orderCount: number;
    minDate: string;
    maxDate: string;
    sourceLineCount: number;
    sourceOrderCount: number;
    sourceMinDate: string;
    sourceMaxDate: string;
    selection: { years: number[]; sha256FirstByteLessThan: number };
    reportingCurrency: 'USD';
    latestCompleteYear: number;
    totals: { quantity: number; revenueCents: number; costCents: number; profitCents: number };
  };
  rows: ContosoSale[];
}

export const CONTOSO_DATASET_ID = 'contoso-retail-v2';
const ASSET_URL = new URL('./assets/contoso-retail-v2.json.gz', import.meta.url);
let pending: Promise<ContosoData> | undefined;

export function loadContosoData(): Promise<ContosoData> {
  if (!pending) {
    pending = fetch(ASSET_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Dataset HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        // Some hosts advertise Content-Encoding: gzip for .gz assets, so fetch
        // delivers decompressed JSON. Others deliver the gzip bytes directly.
        const json = bytes[0] === 0x1f && bytes[1] === 0x8b
          ? strFromU8(gunzipSync(bytes)) : strFromU8(bytes);
        const data = JSON.parse(json) as ContosoData;
        if (data.version !== 2 || data.rows.length !== data.metadata.lineCount ||
            data.metadata.reportingCurrency !== 'USD' ||
            data.metadata.sourceLineCount < data.metadata.lineCount ||
            data.metadata.sourceOrderCount < data.metadata.orderCount) {
          throw new Error('Incompatible Contoso dataset');
        }
        return data;
      })
      .catch((error) => { pending = undefined; throw error; });
  }
  return pending;
}

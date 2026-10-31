import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import type { ContosoData } from '../../src/contoso-data';

export const CONTOSO_FIXTURE = JSON.parse(gunzipSync(readFileSync(
  resolve(process.cwd(), 'src/assets/contoso-retail-v2.json.gz'),
)).toString('utf8')) as ContosoData;

export const CONTOSO_V1_FIXTURE = JSON.parse(gunzipSync(readFileSync(
  resolve(process.cwd(), 'src/assets/contoso-retail-v1.json.gz'),
)).toString('utf8')) as { version: 1; metadata: { lineCount: number; orderCount: number } };

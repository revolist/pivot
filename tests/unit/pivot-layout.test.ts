import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const showcaseStyles = readFileSync(
  'src/financial-pivot-header/financial-pivot-header.scss',
  'utf8',
);

describe('advanced Pivot docs demo layout', () => {
  it('keeps the configurator at least 20 percent narrower than its docs-demo width', () => {
    expect(showcaseStyles).toMatch(
      /\.financial-pivot-showcase\s+\.pivot-config\s*\{[\s\S]*?--pv-cfg-width:\s*304px;/,
    );
  });
});

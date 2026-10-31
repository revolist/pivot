import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { resolvePivotVersion } from '../../scripts/pivot-version.mjs';

it('reads the installed trial package version even when package.json is not exported', () => {
  const root = mkdtempSync(join(tmpdir(), 'pivot-version-'));
  try {
    const pkg = join(root, 'node_modules/@revolist/pivot');
    mkdirSync(join(pkg, 'dist'), { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({
      name: '@revolist/pivot-trial', version: '3.1.2', exports: { '.': './dist/index.js' },
    }));
    writeFileSync(join(pkg, 'dist/index.js'), '');
    expect(resolvePivotVersion(pathToFileURL(join(root, 'vite.config.ts')))).toBe('3.1.2');
    const workspace = join(root, 'workspace-pivot');
    mkdirSync(workspace);
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ version: '4.0.0' }));
    expect(resolvePivotVersion(pathToFileURL(join(root, 'vite.config.ts')), workspace)).toBe('4.0.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

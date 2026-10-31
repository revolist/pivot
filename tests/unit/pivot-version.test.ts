import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { resolvePivotVersion } from '../../scripts/pivot-version.mjs';

it('reads an ESM-only trial package version even when package.json is not exported', () => {
  const root = mkdtempSync(join(tmpdir(), 'pivot-version-'));
  try {
    const pkg = join(root, 'node_modules/@revolist/pivot');
    mkdirSync(join(pkg, 'dist'), { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({
      name: '@revolist/pivot-trial', version: '3.1.2', type: 'module',
      exports: { '.': { import: './dist/index.js' } },
    }));
    writeFileSync(join(pkg, 'dist/index.js'), '');
    expect(resolvePivotVersion(pathToFileURL(join(root, 'vite.config.ts')))).toBe('3.1.2');
    const configFile = join(root, 'vite.config.mjs');
    const resolverFile = resolve('scripts/pivot-version.mjs');
    writeFileSync(configFile, `import { resolvePivotVersion } from ${JSON.stringify(resolverFile)};
      export default { define: { pivotVersion: resolvePivotVersion(import.meta.url) } };`);
    const viteEntry = pathToFileURL(createRequire(resolve('package.json')).resolve('vite')).href;
    const bundledVersion = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { loadConfigFromFile } from ${JSON.stringify(viteEntry)};
      const result = await loadConfigFromFile({ command: 'build', mode: 'production' }, ${JSON.stringify(configFile)});
      process.stdout.write(result.config.define.pivotVersion);
    `], { encoding: 'utf8' });
    expect(bundledVersion).toBe('3.1.2');
    const workspace = join(root, 'workspace-pivot');
    mkdirSync(workspace);
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ version: '4.0.0' }));
    expect(resolvePivotVersion(pathToFileURL(join(root, 'vite.config.ts')), workspace)).toBe('4.0.0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

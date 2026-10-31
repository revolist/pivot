import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** Read the resolved package, including trial aliases, rather than the dependency range. */
export function resolvePivotVersion(importer, packageRoot) {
  if (packageRoot) return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
  let directory = dirname(createRequire(importer).resolve('@revolist/pivot'));
  while (true) {
    try {
      return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Cannot find the resolved Pivot package version.');
    directory = parent;
  }
}

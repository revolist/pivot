import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** Read the resolved package, including trial aliases, rather than the dependency range. */
export function resolvePivotVersion(importer, packageRoot) {
  if (packageRoot) return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
  // Use Node's ordered package lookup paths without requiring a CommonJS export.
  // Published Pivot packages may expose only an ESM import entry.
  const directories = createRequire(importer).resolve.paths('@revolist/pivot') ?? [];
  for (const directory of directories) {
    try {
      return JSON.parse(readFileSync(join(directory, '@revolist/pivot/package.json'), 'utf8')).version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error('Cannot find the resolved Pivot package version.');
}

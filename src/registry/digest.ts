import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compareCodeUnits } from '../shared/compare';

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/** Content digest of a catalog directory, recorded in the install manifest (`sha256:<hex>`). */
export function catalogDigest(catalogDir: string): string {
  const hash = createHash('sha256');
  const files = listFiles(catalogDir)
    .map((file) => ({ file, path: relative(catalogDir, file).split(sep).join('/') }))
    .sort((a, b) => compareCodeUnits(a.path, b.path));
  for (const { file, path } of files) {
    hash.update(`${path}\0`);
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

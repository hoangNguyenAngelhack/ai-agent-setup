import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

/** Creates a temporary directory containing `files` (relative path → content). */
export function writeTree(files: Record<string, string>, prefix = 'tree-'): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const IGNORED = ['.git', '.ai-agent-setup/backups', '.ai-agent-setup/transactions'];

/** Path → sha256 of every file, ignoring git data and the installer's history directories. */
export function hashTree(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const path = relative(root, full).split(sep).join('/');
      if (IGNORED.some((ignored) => path === ignored || path.startsWith(`${ignored}/`))) continue;
      if (entry.isDirectory()) walk(full);
      else result[path] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root);
  return result;
}

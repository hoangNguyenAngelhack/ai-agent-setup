import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { STATE_DIR } from '../installer';

/** Local-first run artifacts (ADR-009). Each directory carries its own `.gitignore` of `*`. */
export const RUNS_DIR = `${STATE_DIR}/runs`;
export const GATES_DIR = `${STATE_DIR}/gates`;
const RUN_ID = /^run-[0-9TZ]+-[0-9a-f]{6}$/;

export function newRunId(date: Date): string {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `run-${stamp}-${randomBytes(3).toString('hex')}`;
}

export function assertRunId(id: string): string {
  if (!RUN_ID.test(id)) throw new Error(`Invalid run id "${id}"`);
  return id;
}

/** Creates a state directory that Git ignores even when the project's .gitignore does not. */
export function ensureIgnoredDir(root: string, relative: string): string {
  const dir = join(root, relative);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '# Local run artifacts (ai-agent-setup): never committed by default.\n*\n');
  return dir;
}

export function runDir(root: string, runId: string): string {
  ensureIgnoredDir(root, RUNS_DIR);
  const dir = join(root, RUNS_DIR, assertRunId(runId));
  mkdirSync(join(dir, 'evidence'), { recursive: true });
  return dir;
}

export function sha256(content: string | Buffer): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function git(root: string, args: string[]): string | null {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  return result.error || result.status !== 0 ? null : result.stdout.trim();
}

/** Project name (package.json name or directory) and the current commit, if any. */
export function projectIdentity(root: string): { name: string; commit: string | null; dirty: boolean } {
  let name = basename(root);
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: unknown };
    if (typeof pkg.name === 'string' && pkg.name) name = pkg.name;
  } catch {
    // No package.json: keep the directory name.
  }
  const commit = git(root, ['rev-parse', 'HEAD']);
  const status = commit ? git(root, ['status', '--porcelain']) : null;
  return { name, commit, dirty: Boolean(status) };
}

/** Project-relative path with forward slashes, as stored in records. */
export function projectPath(root: string, file: string): string {
  return relative(root, file).split('\\').join('/');
}

/**
 * Reads a JSON Lines file; a missing file is an empty list. A line that is not valid JSON (for
 * example a torn concurrent append) is skipped and reported by its 1-based number.
 */
export function readJsonLines<T>(file: string): { items: T[]; badLines: number[] } {
  const result: { items: T[]; badLines: number[] } = { items: [], badLines: [] };
  if (!existsSync(file)) return result;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (!line.trim()) return;
      try {
        result.items.push(JSON.parse(line) as T);
      } catch {
        result.badLines.push(index + 1);
      }
    });
  return result;
}

export function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

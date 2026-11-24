import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

/**
 * Where the toolkit keeps per-project integrity keys (ADR-016): `<user config>/ai-agent-setup/keys`,
 * outside every project. AI_AGENT_SETUP_KEY_DIR overrides it (tests, custom locations); a key
 * directory inside the project is refused by the toolkit.
 */
export function keyDirectory(): string {
  if (process.env.AI_AGENT_SETUP_KEY_DIR) return process.env.AI_AGENT_SETUP_KEY_DIR;
  const base =
    process.platform === 'win32'
      ? (process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
      : process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Application Support')
        : (process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'));
  return join(base, 'ai-agent-setup', 'keys');
}

/** macOS and Windows file systems are case-insensitive by default. */
const CASE_INSENSITIVE = process.platform === 'darwin' || process.platform === 'win32';

/**
 * Absolute path with symlinks resolved through its deepest existing ancestor (so `/var/x` and
 * `/private/var/x` agree on macOS even when `x` does not exist yet), forward slashes, case-folded
 * where the OS is.
 */
export function canonicalPath(path: string): string {
  let current = resolve(path);
  const rest: string[] = [];
  let full = current;
  for (;;) {
    try {
      full = join(realpathSync.native(current), ...rest);
      break;
    } catch {
      const parent = dirname(current);
      if (parent === current) break;
      rest.unshift(basename(current));
      current = parent;
    }
  }
  const normal = full.split('\\').join('/').replace(/\/+$/, '');
  return CASE_INSENSITIVE ? normal.toLowerCase() : normal;
}

/** True when `a` is `b` or inside it. */
export function isWithin(a: string, b: string): boolean {
  const child = canonicalPath(a);
  const parent = canonicalPath(b);
  return child === parent || child.startsWith(`${parent}/`);
}

/**
 * True when reading or writing `path` would reach the key directory: the directory itself, anything
 * inside it, or a parent of it (a recursive search there would read the keys).
 */
export function touchesKeyDirectory(path: string): boolean {
  const keys = keyDirectory();
  return isWithin(path, keys) || isWithin(keys, path);
}

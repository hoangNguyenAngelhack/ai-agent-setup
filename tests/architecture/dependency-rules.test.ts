import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * Module dependency rules from docs/v2/05 §4 and docs/v2/06 §4. The Core must stay
 * provider-independent (ADR-003, NFR-03).
 */
const SRC = join(REPO_ROOT, 'src');

const FORBIDDEN: Record<string, string[]> = {
  core: ['adapters', 'installer', 'cli', 'app'],
  registry: ['core', 'adapters', 'installer', 'cli', 'app', 'quality'],
  installer: ['adapters', 'core', 'cli', 'app'],
  quality: ['adapters', 'installer', 'cli', 'app'],
  adapters: ['installer', 'cli', 'app'],
  shared: ['core', 'registry', 'adapters', 'installer', 'cli', 'app', 'quality', 'integrations'],
};

const HOST_FORMAT_MARKERS = [/\.claude\//, /\.codex\//, /CLAUDE\.md/, /AGENTS\.md/, /settings\.json/, /config\.toml/];

function listTsFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(fullPath);
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

function topModule(file: string): string {
  return relative(SRC, file).split(sep)[0] ?? '';
}

function importedModules(file: string): Array<{ specifier: string; module: string | null }> {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1]!,
  );
  return specifiers.map((specifier) => {
    if (!specifier.startsWith('.')) return { specifier, module: null };
    const target = resolve(dirname(file), specifier);
    return { specifier, module: target.startsWith(SRC) ? topModule(target) : null };
  });
}

describe('module dependency rules', () => {
  const files = listTsFiles(SRC);

  it('should find source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('should not import forbidden modules', () => {
    const violations = files.flatMap((file) => {
      const forbidden = FORBIDDEN[topModule(file)] ?? [];
      return importedModules(file)
        .filter(({ module }) => module !== null && forbidden.includes(module))
        .map(({ specifier }) => `${relative(REPO_ROOT, file)} → ${specifier}`);
    });

    expect(violations).toEqual([]);
  });

  it('should keep adapters independent of each other', () => {
    const violations = files
      .filter((file) => topModule(file) === 'adapters')
      .flatMap((file) => {
        const ownAdapter = relative(join(SRC, 'adapters'), file).split(sep)[0];
        return importedModules(file)
          .filter(({ specifier }) => /adapters\/(claude-code|codex)/.test(resolve(dirname(file), specifier)))
          .filter(({ specifier }) => !resolve(dirname(file), specifier).includes(`adapters${sep}${ownAdapter}`))
          .map(({ specifier }) => `${relative(REPO_ROOT, file)} → ${specifier}`);
      });

    expect(violations).toEqual([]);
  });

  it('should not reference host file formats inside the Core', () => {
    const violations = files
      .filter((file) => topModule(file) === 'core')
      .filter((file) => HOST_FORMAT_MARKERS.some((marker) => marker.test(readFileSync(file, 'utf8'))))
      .map((file) => relative(REPO_ROOT, file));

    expect(violations).toEqual([]);
  });
});

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ENTITY_KINDS, KIND_DIRECTORIES, type Diagnostic, type EntityKind } from './types';

const ENTRY_FILE = /\.(ya?ml)$/;

export interface RawEntry {
  value: Record<string, unknown>;
  file: string;
  directoryKind: EntityKind;
}

export interface LoadResult {
  raw: RawEntry[];
  diagnostics: Diagnostic[];
}

/** Reads every `<kind-dir>/*.yaml` file under the catalog root. Does not validate content. */
export function loadCatalogFiles(catalogDir: string): LoadResult {
  const raw: RawEntry[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const kind of ENTITY_KINDS) {
    const kindDir = join(catalogDir, KIND_DIRECTORIES[kind]);
    if (!existsSync(kindDir)) continue;

    const files = readdirSync(kindDir)
      .filter((name) => ENTRY_FILE.test(name))
      .sort();
    for (const name of files) {
      const file = join(kindDir, name);
      const parsed = parseEntryFile(file);
      if (parsed.ok) {
        raw.push({ value: parsed.value, file, directoryKind: kind });
      } else {
        diagnostics.push({ code: 'E_PARSE', severity: 'error', file, message: parsed.message });
      }
    }
  }

  return { raw, diagnostics };
}

function parseEntryFile(
  file: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  let value: unknown;
  try {
    value = parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { ok: false, message: `Invalid YAML: ${(error as Error).message}` };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'Entry file must contain a single YAML mapping' };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

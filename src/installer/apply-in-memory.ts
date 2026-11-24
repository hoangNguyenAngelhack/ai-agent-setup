import { sectionMarkers, type FileOperation } from '../shared/file-operations';

type Json = unknown;

function isPlainObject(value: Json): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Objects merge recursively, arrays are unioned (order kept), scalars from `patch` win. */
export function mergeJson(base: Json, patch: Json): Json {
  if (Array.isArray(base) && Array.isArray(patch)) {
    const items: Json[] = base;
    const seen = new Set(items.map((item) => JSON.stringify(item)));
    return [...items, ...(patch as Json[]).filter((item) => !seen.has(JSON.stringify(item)))];
  }
  if (isPlainObject(base) && isPlainObject(patch)) {
    const result: Record<string, Json> = { ...base };
    for (const [key, value] of Object.entries(patch)) result[key] = key in base ? mergeJson(base[key], value) : value;
    return result;
  }
  return patch;
}

function applySection(existing: string | undefined, op: Extract<FileOperation, { kind: 'section' }>): string {
  const { begin, end } = sectionMarkers(op.marker, op.style);
  const block = `${begin}\n${op.content}\n${end}`;
  if (existing === undefined || existing.length === 0) return `${block}\n`;
  const start = existing.indexOf(begin);
  const stop = existing.indexOf(end, start);
  if (start !== -1 && stop !== -1) return existing.slice(0, start) + block + existing.slice(stop + end.length);
  return `${existing.replace(/\n*$/, '')}\n\n${block}\n`;
}

/**
 * Applies operations to an in-memory file map (path → content) and returns a new map. Pure: used
 * by dry-run, golden tests and the installer's planning step (docs/v2/05 §11).
 */
export function applyInMemory(operations: readonly FileOperation[], existing: ReadonlyMap<string, string> = new Map()): Map<string, string> {
  const files = new Map(existing);
  for (const op of operations) {
    switch (op.kind) {
      case 'write':
        files.set(op.path, op.content);
        break;
      case 'section':
        files.set(op.path, applySection(files.get(op.path), op));
        break;
      case 'merge-json': {
        const current = files.get(op.path);
        const base: Json = current ? JSON.parse(current) : {};
        files.set(op.path, `${JSON.stringify(mergeJson(base, op.value), null, 2)}\n`);
        break;
      }
    }
  }
  return files;
}

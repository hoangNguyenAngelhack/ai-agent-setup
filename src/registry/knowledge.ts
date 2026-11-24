import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LoadedEntry } from './types';

export interface ContentFile {
  /** Path as written in the entry (relative to the entry file). */
  reference: string;
  path: string;
  bytes: number;
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/**
 * Knowledge Registry (docs/v2/05 §5 module 8), catalog part: locates the content bodies and
 * resources behind catalog entries. The Capability Registry holds metadata only.
 */
export class KnowledgeIndex {
  private readonly files = new Map<string, string>();
  private readonly loaded = new Map<string, LoadedEntry>();

  constructor(loaded: readonly LoadedEntry[]) {
    for (const item of loaded) {
      this.files.set(item.entry.id, item.file);
      this.loaded.set(item.entry.id, item);
    }
  }

  body(id: string): ContentFile | null {
    const item = this.loaded.get(id);
    const reference = item && 'body' in item.entry ? item.entry.body : null;
    return reference ? this.contentFile(id, reference) : null;
  }

  resources(id: string): ContentFile[] {
    const item = this.loaded.get(id);
    return item?.entry.kind === 'Skill' ? item.entry.resources.map((reference) => this.contentFile(id, reference)) : [];
  }

  /** Text of a content file located through `body()` or `resources()`. */
  read(file: ContentFile): string {
    return readFileSync(file.path, 'utf8');
  }

  private contentFile(id: string, reference: string): ContentFile {
    const path = resolve(dirname(this.files.get(id)!), reference);
    return { reference, path, bytes: sizeOf(path) };
  }
}

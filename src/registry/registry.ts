import type { CatalogEntry, EntityKind, EntryOfKind } from './types';

/** Read-only query index over validated catalog entries (Capability Registry, docs/v2/05 §5). */
export class Registry {
  private readonly byId: ReadonlyMap<string, CatalogEntry>;

  constructor(entries: readonly CatalogEntry[]) {
    this.byId = new Map(entries.map((entry) => [entry.id, entry]));
  }

  get size(): number {
    return this.byId.size;
  }

  get(id: string): CatalogEntry | undefined {
    return this.byId.get(id);
  }

  all(): CatalogEntry[] {
    return [...this.byId.values()];
  }

  list<K extends EntityKind>(kind: K): Array<EntryOfKind<K>> {
    return [...this.byId.values()].filter((entry): entry is EntryOfKind<K> => entry.kind === kind);
  }

  countByKind(): Partial<Record<EntityKind, number>> {
    const counts: Partial<Record<EntityKind, number>> = {};
    for (const entry of this.byId.values()) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
    return counts;
  }
}

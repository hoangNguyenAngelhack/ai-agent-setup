import type { AdapterId, CatalogEntry, KnowledgeIndex, ProfileEntry } from '../../registry';

export type ContextTier = 'T0' | 'T1' | 'T2' | 'T3';

export interface TierMeasurement {
  bytes: number;
  items: Array<{ id: string; bytes: number }>;
}

/**
 * Bytes of catalog content per load tier (docs/v2/05 §8). Covers catalog bodies only; the
 * instruction preamble each adapter generates is added when adapters exist (W2.0-09/10).
 */
export interface ContextReport {
  label: 'measured';
  tiers: Record<ContextTier, TierMeasurement>;
}

export interface BudgetCheck {
  adapter: AdapterId;
  t0Bytes: number;
  /** null when the profile sets no budget for this adapter (OQ: Claude Code default, docs/v2/04 NFR-09). */
  budget: number | null;
  withinBudget: boolean | null;
}

function bodyTier(entry: CatalogEntry): ContextTier | null {
  if (entry.kind === 'Rule') {
    if ('always' in entry.scope) return 'T0';
    if ('paths' in entry.scope) return 'T1';
    return 'T2';
  }
  if (entry.kind === 'Skill' || entry.kind === 'Agent' || entry.kind === 'Workflow') return 'T2';
  return null;
}

/** Assigns selected entries to tiers and measures their content size on disk. */
export function measureContext(entries: readonly CatalogEntry[], knowledge: KnowledgeIndex): ContextReport {
  const items: Record<ContextTier, Array<{ id: string; bytes: number }>> = { T0: [], T1: [], T2: [], T3: [] };
  const countedResources = new Set<string>();

  for (const entry of entries) {
    const tier = bodyTier(entry);
    const body = knowledge.body(entry.id);
    if (tier && body) items[tier].push({ id: entry.id, bytes: body.bytes });

    for (const resource of knowledge.resources(entry.id)) {
      if (countedResources.has(resource.path)) continue;
      countedResources.add(resource.path);
      items.T3.push({ id: `${entry.id}:${resource.reference}`, bytes: resource.bytes });
    }
  }

  const measure = (tierItems: Array<{ id: string; bytes: number }>): TierMeasurement => {
    const sorted = [...tierItems].sort((a, b) => a.id.localeCompare(b.id));
    return { bytes: sorted.reduce((sum, item) => sum + item.bytes, 0), items: sorted };
  };

  return {
    label: 'measured',
    tiers: { T0: measure(items.T0), T1: measure(items.T1), T2: measure(items.T2), T3: measure(items.T3) },
  };
}

export function checkContextBudget(report: ContextReport, profile: ProfileEntry, adapter: AdapterId): BudgetCheck {
  const t0Bytes = report.tiers.T0.bytes;
  const budget = profile.contextBudget[adapter] ?? null;
  return { adapter, t0Bytes, budget, withinBudget: budget === null ? null : t0Bytes <= budget };
}

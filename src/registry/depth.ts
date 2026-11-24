import { ADAPTER_IDS, type CatalogEntry, type DepthLevel, type DomainEntry } from './types';

export const DEPTH_ORDER: Record<DepthLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

function isStableOnAllAdapters(entry: CatalogEntry | undefined): boolean {
  return (
    entry !== undefined &&
    entry.status === 'stable' &&
    ADAPTER_IDS.every((adapter) => entry.supportedAdapters[adapter] !== 'unsupported')
  );
}

/**
 * Highest depth level (docs/v2/05 §6.8) the catalog content supports for a domain.
 * L3 needs benchmark evidence, which the catalog cannot show yet, so the result is at most L2.
 */
export function computeAchievedDepth(domain: DomainEntry, byId: Map<string, CatalogEntry>): DepthLevel {
  const capabilities = domain.capabilities
    .map((id) => byId.get(id))
    .filter((entry) => entry?.kind === 'Capability');

  const guided = capabilities.some(
    (capability) =>
      capability.kind === 'Capability' &&
      [...capability.skills, ...capability.rules].some((id) => isStableOnAllAdapters(byId.get(id))),
  );
  if (!guided) return 'L0';

  const capabilityIds = new Set(domain.capabilities);
  const orchestrated = [...byId.values()].some(
    (entry) =>
      entry.kind === 'Workflow' &&
      isStableOnAllAdapters(entry) &&
      entry.steps.some((step) => capabilityIds.has(step.capability) && step.gates.length > 0),
  );
  return orchestrated ? 'L2' : 'L1';
}

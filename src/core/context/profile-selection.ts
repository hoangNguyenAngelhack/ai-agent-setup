import type { CatalogEntry, ProfileEntry, Registry } from '../../registry';

const DEFAULT_STATUSES = ['stable'];

/**
 * Entries a profile selects (docs/v2/05 §6.3, §6.4): status in `includes.statuses` (default stable),
 * restricted to `includes.ids` when given, minus `excludes.ids`. With `includes.domains`, entries
 * that belong to a domain outside the list are dropped; cross-cutting entries are kept.
 */
export function selectProfileEntries(registry: Registry, profile: ProfileEntry): CatalogEntry[] {
  const statuses = new Set<string>(profile.includes.statuses ?? DEFAULT_STATUSES);
  const onlyIds = profile.includes.ids ? new Set(profile.includes.ids) : null;
  const excluded = new Set(profile.excludes?.ids ?? []);
  const allowedDomains = profile.includes.domains ? new Set(profile.includes.domains) : null;
  const domainIds = new Set(registry.list('Domain').map((domain) => domain.id));

  const inAllowedDomain = (entry: CatalogEntry): boolean => {
    if (!allowedDomains) return true;
    if (entry.kind === 'Domain') return allowedDomains.has(entry.id);
    return !domainIds.has(entry.category) || allowedDomains.has(entry.category);
  };

  return registry
    .all()
    .filter((entry) => statuses.has(entry.status))
    .filter((entry) => !onlyIds || onlyIds.has(entry.id))
    .filter((entry) => !excluded.has(entry.id))
    .filter(inAllowedDomain);
}

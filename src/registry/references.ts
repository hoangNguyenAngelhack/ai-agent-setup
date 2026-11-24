import type { CatalogEntry, EntityKind } from './types';

export interface Reference {
  field: string;
  id: string;
  /** `null` means any kind is acceptable (e.g. generic `dependencies`). */
  expectedKind: EntityKind | null;
}

function refs(field: string, ids: readonly string[], expectedKind: EntityKind | null): Reference[] {
  return ids.map((id) => ({ field, id, expectedKind }));
}

/** Every catalog reference an entry makes, with the kind it must resolve to. */
export function referencesOf(entry: CatalogEntry): Reference[] {
  const common = [
    ...refs('dependencies', entry.dependencies, null),
    ...(entry.deprecation?.replacedBy ? refs('deprecation.replacedBy', [entry.deprecation.replacedBy], entry.kind) : []),
  ];

  switch (entry.kind) {
    case 'Domain':
      return [...common, ...refs('capabilities', entry.capabilities, 'Capability')];
    case 'Capability':
      return [
        ...common,
        ...refs('domain', [entry.domain], 'Domain'),
        ...refs('skills', entry.skills, 'Skill'),
        ...refs('rules', entry.rules, 'Rule'),
        ...refs('defaultAgents', entry.defaultAgents, 'Agent'),
      ];
    case 'Agent':
      return [
        ...common,
        ...refs('capabilities', entry.capabilities, 'Capability'),
        ...refs('skills', entry.skills, 'Skill'),
        ...(entry.aliasOf ? refs('aliasOf', [entry.aliasOf], 'Agent') : []),
      ];
    case 'Rule':
      return [
        ...common,
        ...('capabilities' in entry.scope ? refs('scope.capabilities', entry.scope.capabilities, 'Capability') : []),
      ];
    case 'Workflow':
      return [
        ...common,
        ...refs('domains', entry.domains, 'Domain'),
        ...entry.steps.flatMap((step, index) => [
          ...refs(`steps[${index}].capability`, [step.capability], 'Capability'),
          ...refs(`steps[${index}].agent`, [step.agent], 'Agent'),
        ]),
      ];
    case 'Profile':
      return [
        ...common,
        ...refs('includes.domains', entry.includes.domains ?? [], 'Domain'),
        ...refs('includes.ids', entry.includes.ids ?? [], null),
        ...refs('excludes.ids', entry.excludes?.ids ?? [], null),
      ];
    case 'Skill':
    case 'Tool':
      return common;
  }
}

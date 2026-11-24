import { existsSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { computeAchievedDepth, DEPTH_ORDER } from './depth';
import { referencesOf } from './references';
import {
  ADAPTER_IDS,
  type CapabilityEntry,
  type CatalogEntry,
  type Diagnostic,
  type DomainEntry,
  type LoadedEntry,
} from './types';

export interface CheckContext {
  loaded: LoadedEntry[];
  byId: Map<string, CatalogEntry>;
  policyIds: ReadonlySet<string>;
}

type Check = (context: CheckContext) => Diagnostic[];

function error(code: string, loaded: LoadedEntry, message: string): Diagnostic {
  return { code, severity: 'error', entryId: loaded.entry.id, file: loaded.file, message };
}

const checkUniqueIds: Check = ({ loaded }) => {
  const seen = new Map<string, string>();
  return loaded.flatMap((item) => {
    const firstFile = seen.get(item.entry.id);
    if (firstFile === undefined) {
      seen.set(item.entry.id, item.file);
      return [];
    }
    return [error('E_DUPLICATE_ID', item, `Duplicate id "${item.entry.id}" (first defined in ${firstFile})`)];
  });
};

const checkFileLocation: Check = ({ loaded }) =>
  loaded.flatMap((item) => {
    const diagnostics: Diagnostic[] = [];
    const fileId = basename(item.file, extname(item.file));
    if (fileId !== item.entry.id) {
      diagnostics.push(error('E_FILENAME_MISMATCH', item, `File name "${fileId}" must equal id "${item.entry.id}"`));
    }
    if (item.directoryKind !== item.entry.kind) {
      diagnostics.push(
        error('E_KIND_DIR_MISMATCH', item, `Kind "${item.entry.kind}" found in the ${item.directoryKind} directory`),
      );
    }
    return diagnostics;
  });

const checkReferences: Check = ({ loaded, byId }) =>
  loaded.flatMap((item) =>
    referencesOf(item.entry).flatMap((reference) => {
      const target = byId.get(reference.id);
      if (!target) {
        return [error('E_UNRESOLVED_REF', item, `${reference.field} → "${reference.id}" does not exist`)];
      }
      if (reference.expectedKind && target.kind !== reference.expectedKind) {
        return [
          error(
            'E_REF_KIND',
            item,
            `${reference.field} → "${reference.id}" is a ${target.kind}, expected ${reference.expectedKind}`,
          ),
        ];
      }
      return [];
    }),
  );

const checkProfilePolicies: Check = ({ loaded, policyIds }) =>
  loaded.flatMap((item) => {
    if (item.entry.kind !== 'Profile' || item.entry.policy === null || policyIds.has(item.entry.policy)) return [];
    return [error('E_UNRESOLVED_REF', item, `policy → "${item.entry.policy}" does not exist in policies/`)];
  });

const checkDependencyCycles: Check = ({ loaded, byId }) => {
  const state = new Map<string, 'visiting' | 'done'>();
  const reported = new Set<string>();
  const diagnostics: Diagnostic[] = [];
  const fileOf = new Map(loaded.map((item) => [item.entry.id, item]));

  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const cycle = [...path.slice(path.indexOf(id)), id];
      const key = [...new Set(cycle)].sort().join('|');
      const owner = fileOf.get(id);
      if (!reported.has(key) && owner) {
        reported.add(key);
        diagnostics.push(error('E_DEPENDENCY_CYCLE', owner, `Dependency cycle: ${cycle.join(' → ')}`));
      }
      return;
    }
    state.set(id, 'visiting');
    for (const dependency of byId.get(id)?.dependencies ?? []) {
      if (byId.has(dependency)) visit(dependency, [...path, id]);
    }
    state.set(id, 'done');
  };

  for (const item of loaded) visit(item.entry.id, []);
  return diagnostics;
};

const checkDomainMembership: Check = ({ loaded, byId }) =>
  loaded.flatMap((item) => {
    const { entry } = item;
    if (entry.kind === 'Domain') {
      return entry.capabilities
        .map((id) => byId.get(id))
        .filter((target): target is CapabilityEntry => target?.kind === 'Capability' && target.domain !== entry.id)
        .map((target) =>
          error('E_DOMAIN_MEMBERSHIP', item, `Lists "${target.id}", which belongs to domain "${target.domain}"`),
        );
    }
    if (entry.kind === 'Capability') {
      const domain = byId.get(entry.domain);
      if (domain?.kind === 'Domain' && !domain.capabilities.includes(entry.id)) {
        return [error('E_DOMAIN_MEMBERSHIP', item, `Domain "${entry.domain}" does not list this capability`)];
      }
      if (entry.category !== entry.domain) {
        return [error('E_CATEGORY_MISMATCH', item, `Category "${entry.category}" must equal domain "${entry.domain}"`)];
      }
    }
    return [];
  });

const checkDefaultAgents: Check = ({ loaded, byId }) =>
  loaded.flatMap((item) => {
    if (item.entry.kind !== 'Capability') return [];
    const capabilityId = item.entry.id;
    return item.entry.defaultAgents
      .map((id) => byId.get(id))
      .filter((agent) => agent?.kind === 'Agent' && !agent.capabilities.includes(capabilityId))
      .map((agent) =>
        error('E_AGENT_CAPABILITY_MISMATCH', item, `Default agent "${agent!.id}" does not declare this capability`),
      );
  });

const checkAliases: Check = ({ loaded, byId }) =>
  loaded.flatMap((item) => {
    if (item.entry.kind !== 'Agent' || !item.entry.aliasOf) return [];
    const target = byId.get(item.entry.aliasOf);
    if (target?.kind === 'Agent' && target.aliasOf) {
      return [error('E_ALIAS_CHAIN', item, `Alias target "${target.id}" is itself an alias of "${target.aliasOf}"`)];
    }
    return [];
  });

const checkStatusRules: Check = ({ loaded }) =>
  loaded.flatMap((item) => {
    const { entry } = item;
    const diagnostics: Diagnostic[] = [];
    if (entry.status === 'stable') {
      const validation = entry.validation;
      if (!validation || (validation.gates.length === 0 && !validation.reviewChecklist)) {
        diagnostics.push(error('E_STABLE_NO_VALIDATION', item, 'Stable entries need gates or a review checklist'));
      }
      for (const adapter of ADAPTER_IDS) {
        if (entry.supportedAdapters[adapter] === 'unsupported' && !entry.unsupportedReasons?.[adapter]) {
          diagnostics.push(error('E_UNSUPPORTED_NO_REASON', item, `Unsupported on ${adapter} without a reason`));
        }
      }
    }
    if (entry.status === 'deprecated' && !entry.deprecation) {
      diagnostics.push(error('E_DEPRECATION_INFO', item, 'Deprecated entries need since, replacedBy and removalIn'));
    }
    return diagnostics;
  });

const checkContentFiles: Check = ({ loaded }) =>
  loaded.flatMap((item) => {
    const { entry } = item;
    const paths: Array<{ field: string; path: string }> = [];
    if ('body' in entry && entry.body) paths.push({ field: 'body', path: entry.body });
    if (entry.kind === 'Skill') paths.push(...entry.resources.map((path) => ({ field: 'resources', path })));
    return paths
      .filter(({ path }) => !existsSync(resolve(dirname(item.file), path)))
      .map(({ field, path }) =>
        error(field === 'body' ? 'E_BODY_MISSING' : 'E_RESOURCE_MISSING', item, `${field} file not found: ${path}`),
      );
  });

const checkDepthLevels: Check = (context) =>
  context.loaded
    .filter((item): item is LoadedEntry<DomainEntry> => item.entry.kind === 'Domain')
    .flatMap((item) => {
      const achieved = computeAchievedDepth(item.entry, context.byId);
      if (DEPTH_ORDER[item.entry.depthLevel] <= DEPTH_ORDER[achieved]) return [];
      return [
        error(
          'E_DEPTH_OVERSTATED',
          item,
          `Declares ${item.entry.depthLevel} but the catalog supports ${achieved} (docs/v2/05 §6.8)`,
        ),
      ];
    });

export const SEMANTIC_CHECKS: readonly Check[] = [
  checkUniqueIds,
  checkFileLocation,
  checkReferences,
  checkProfilePolicies,
  checkDependencyCycles,
  checkDomainMembership,
  checkDefaultAgents,
  checkAliases,
  checkStatusRules,
  checkContentFiles,
  checkDepthLevels,
];

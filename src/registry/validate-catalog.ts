import { join } from 'node:path';
import { loadCatalogFiles } from './loader';
import { loadCatalogPolicies } from './policies';
import { SchemaValidator } from './schema-validator';
import { SEMANTIC_CHECKS } from './semantic-checks';
import {
  ENTITY_KINDS,
  type CatalogEntry,
  type Diagnostic,
  type EntityKind,
  type LoadedEntry,
  type PolicyDocument,
} from './types';

export interface ValidationReport {
  ok: boolean;
  /** Schema-valid entries, sorted by id. Semantic errors do not remove entries. */
  entries: CatalogEntry[];
  loaded: LoadedEntry[];
  /** Schema-valid policies from `<catalog>/policies/` (mandatory and project layers). */
  policies: PolicyDocument[];
  diagnostics: Diagnostic[];
}

function isKnownKind(kind: unknown): kind is EntityKind {
  return typeof kind === 'string' && (ENTITY_KINDS as readonly string[]).includes(kind);
}

/** Loads, schema-validates and semantically checks a catalog directory (docs/v2/05 §6.1). */
export function validateCatalog(catalogDir: string): ValidationReport {
  const { raw, diagnostics } = loadCatalogFiles(catalogDir);
  const schemas = new SchemaValidator(join(catalogDir, 'schemas'));
  const loaded: LoadedEntry[] = [];

  for (const item of raw) {
    const kind = item.value.kind;
    const entryId = typeof item.value.id === 'string' ? item.value.id : undefined;
    if (!isKnownKind(kind)) {
      diagnostics.push({ code: 'E_SCHEMA', severity: 'error', file: item.file, entryId, message: `Unknown kind "${String(kind)}"` });
      continue;
    }
    const check = schemas.validateEntry(kind, item.value);
    if (!check.valid) {
      diagnostics.push(
        ...check.errors.map((message) => ({ code: 'E_SCHEMA', severity: 'error' as const, file: item.file, entryId, message })),
      );
      continue;
    }
    loaded.push({ entry: item.value as unknown as CatalogEntry, file: item.file, directoryKind: item.directoryKind });
  }

  const byId = new Map<string, CatalogEntry>();
  for (const item of loaded) if (!byId.has(item.entry.id)) byId.set(item.entry.id, item.entry);

  const policyResult = loadCatalogPolicies(catalogDir, schemas);
  diagnostics.push(...policyResult.diagnostics);
  const policyIds = new Set(policyResult.policies.map((policy) => policy.id));

  for (const check of SEMANTIC_CHECKS) diagnostics.push(...check({ loaded, byId, policyIds }));

  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    entries: loaded.map((item) => item.entry).sort((a, b) => a.id.localeCompare(b.id)),
    loaded,
    policies: policyResult.policies,
    diagnostics,
  };
}

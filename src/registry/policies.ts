import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { parse } from 'yaml';
import type { SchemaValidator } from './schema-validator';
import type { Diagnostic, PolicyDocument, PolicyLayer } from './types';

const POLICY_SCHEMA_ID = 'urn:ai-agent-setup:contracts:v1:policy';
/** Organization and user policies come from outside the bundled catalog (docs/v2/05 §7.4). */
const CATALOG_LAYERS: readonly PolicyLayer[] = ['mandatory', 'project'];

export interface PolicyLoadResult {
  policies: PolicyDocument[];
  diagnostics: Diagnostic[];
}

function policyError(code: string, file: string, message: string, entryId?: string): Diagnostic {
  return { code, severity: 'error', file, message, ...(entryId ? { entryId } : {}) };
}

/** Parses and schema-validates one policy file; regular expressions must compile. */
export function loadPolicyFile(file: string, schemas: SchemaValidator): PolicyLoadResult {
  let value: unknown;
  try {
    value = parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { policies: [], diagnostics: [policyError('E_PARSE', file, `Invalid YAML: ${(error as Error).message}`)] };
  }
  const check = schemas.validate(POLICY_SCHEMA_ID, value);
  if (!check.valid) return { policies: [], diagnostics: check.errors.map((message) => policyError('E_SCHEMA', file, message)) };

  const policy = value as PolicyDocument;
  const diagnostics = policy.rules.flatMap((rule) => {
    const flags = rule.match.ignoreCase ? 'i' : '';
    return [...(rule.match.commandRegex ?? []), ...(rule.match.contentRegex ?? [])].flatMap((pattern) => {
      try {
        new RegExp(pattern, flags);
        return [];
      } catch (error) {
        return [policyError('E_POLICY_REGEX', file, `${rule.id}: ${(error as Error).message}`, policy.id)];
      }
    });
  });
  return { policies: diagnostics.length === 0 ? [policy] : [], diagnostics };
}

/** Loads `<catalog>/policies/*.yaml` and checks catalog-level policy rules. */
export function loadCatalogPolicies(catalogDir: string, schemas: SchemaValidator): PolicyLoadResult {
  const dir = join(catalogDir, 'policies');
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).sort() : [];
  const policies: PolicyDocument[] = [];
  const diagnostics: Diagnostic[] = [];
  const ruleIds = new Set<string>();

  for (const name of files) {
    const file = join(dir, name);
    const result = loadPolicyFile(file, schemas);
    diagnostics.push(...result.diagnostics);
    for (const policy of result.policies) {
      if (basename(name, extname(name)) !== policy.id) {
        diagnostics.push(policyError('E_FILENAME_MISMATCH', file, `File name must equal policy id "${policy.id}"`, policy.id));
      }
      if (!CATALOG_LAYERS.includes(policy.layer)) {
        diagnostics.push(policyError('E_POLICY_LAYER', file, `Layer "${policy.layer}" is not allowed in the bundled catalog`, policy.id));
      }
      for (const rule of policy.rules) {
        if (ruleIds.has(rule.id)) diagnostics.push(policyError('E_DUPLICATE_ID', file, `Duplicate policy rule id "${rule.id}"`, policy.id));
        ruleIds.add(rule.id);
      }
      policies.push(policy);
    }
  }

  const mandatory = policies.filter((policy) => policy.layer === 'mandatory');
  if (mandatory.length !== 1) {
    diagnostics.push(policyError('E_POLICY_MANDATORY', dir, `Expected exactly one mandatory policy, found ${mandatory.length}`));
  }
  return { policies, diagnostics };
}

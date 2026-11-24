import { copyFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { REPO_ROOT } from './v1-cli';

type Entry = Record<string, unknown> & { kind: string; id: string };

const KIND_DIRS: Record<string, string> = {
  Domain: 'domains',
  Capability: 'capabilities',
  Agent: 'agents',
  Skill: 'skills',
  Rule: 'rules',
  Workflow: 'workflows',
  Tool: 'tools',
  Profile: 'profiles',
};

function envelope(kind: string, id: string, category: string): Entry {
  return {
    apiVersion: 'catalog.ai-agent-setup/v1',
    kind,
    id,
    name: id,
    description: `Fixture ${kind} ${id}.`,
    version: '0.1.0',
    category,
    status: 'experimental',
    dependencies: [],
    requiredContext: { projectSignals: [], files: [] },
    supportedAdapters: { 'claude-code': 'native', codex: 'native' },
    requiredPermissions: ['fs.read'],
    inputSchema: null,
    outputSchema: null,
    validation: null,
  };
}

export const fixtures = {
  domain(id: string, capabilities: string[], overrides: Record<string, unknown> = {}): Entry {
    return {
      ...envelope('Domain', id, 'domain'),
      ordinal: 1,
      purpose: 'Fixture purpose.',
      roles: ['Fixture Role'],
      capabilities,
      depthLevel: 'L0',
      ...overrides,
    };
  },
  capability(id: string, domain: string, overrides: Record<string, unknown> = {}): Entry {
    return {
      ...envelope('Capability', id, domain),
      domain,
      skills: [],
      rules: [],
      defaultAgents: [],
      riskLevel: 'low',
      costHint: 'low',
      ...overrides,
    };
  },
  agent(id: string, capabilities: string[], overrides: Record<string, unknown> = {}): Entry {
    return {
      ...envelope('Agent', id, 'agent'),
      purpose: 'Fixture agent.',
      capabilities,
      skills: [],
      tools: { allow: ['fs.read'], deny: [] },
      modelHint: 'balanced',
      body: null,
      aliasOf: null,
      ...overrides,
    };
  },
  skill(id: string, overrides: Record<string, unknown> = {}): Entry {
    return {
      ...envelope('Skill', id, 'skill'),
      body: null,
      triggers: 'Use for fixture work.',
      resources: [],
      disableImplicit: false,
      ...overrides,
    };
  },
  rule(id: string, scope: Record<string, unknown>, overrides: Record<string, unknown> = {}): Entry {
    return {
      ...envelope('Rule', id, 'demo'),
      body: `${id}.md`,
      scope,
      enforcement: 'advisory',
      ...overrides,
    };
  },
  profile(id: string, overrides: Record<string, unknown> = {}): Entry {
    return {
      ...envelope('Profile', id, 'profile'),
      includes: { statuses: ['experimental', 'stable'] },
      policy: null,
      contextBudget: {},
      gates: [],
      ...overrides,
    };
  },
  workflow(id: string, overrides: Record<string, unknown> = {}): Entry {
    return {
      ...envelope('Workflow', id, 'workflow'),
      entry: null,
      domains: [],
      steps: [],
      body: null,
      ...overrides,
    };
  },
};

/**
 * Writes entries into a fresh temp catalog that uses the real schemas and the real mandatory
 * safety policy from `catalog/`.
 */
export function writeCatalog(entries: Entry[], extraFiles: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'catalog-fixture-'));
  cpSync(join(REPO_ROOT, 'catalog', 'schemas'), join(dir, 'schemas'), { recursive: true });
  mkdirSync(join(dir, 'policies'));
  copyFileSync(join(REPO_ROOT, 'catalog', 'policies', 'policy.safety.yaml'), join(dir, 'policies', 'policy.safety.yaml'));
  for (const entry of entries) {
    const kindDir = join(dir, KIND_DIRS[entry.kind] ?? 'unknown');
    mkdirSync(kindDir, { recursive: true });
    writeFileSync(join(kindDir, `${entry.id}.yaml`), stringify(entry));
  }
  for (const [relativePath, content] of Object.entries(extraFiles)) {
    const fullPath = join(dir, relativePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return dir;
}

/** A minimal, valid catalog: one domain with one capability and one agent. */
export function minimalValidEntries(): Entry[] {
  return [
    fixtures.domain('demo', ['demo.do-thing']),
    fixtures.capability('demo.do-thing', 'demo', { defaultAgents: ['agent.worker'] }),
    fixtures.agent('agent.worker', ['demo.do-thing']),
  ];
}

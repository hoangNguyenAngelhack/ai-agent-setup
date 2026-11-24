import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { Adapter, GenerationInput } from '../../src/adapters/adapter';
import { claudeCodeAdapter } from '../../src/adapters/claude-code';
import { codexAdapter } from '../../src/adapters/codex';
import { loadPolicyHookAssets } from '../../src/app/policy-hook-assets';
import { applyInMemory } from '../../src/installer/apply-in-memory';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../../src/registry';
import { sectionMarkers } from '../../src/shared/file-operations';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * Golden tests for W2.0-09/10 (docs/v2/09 §3.1): deterministic generation, host-format validity
 * (verified against host docs 2026-11-24), V1 parity and safety properties.
 */
const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const registry = new Registry(report.entries);

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profile: registry.get('profile.standard') as ProfileEntry,
    policies: report.policies,
    hookFiles: loadPolicyHookAssets(join(REPO_ROOT, 'dist')).files,
    toolkitVersion: '2.0.0-dev',
    enabledTools: [],
    ...overrides,
  };
}

function generateTree(adapter: Adapter, overrides: Partial<GenerationInput> = {}) {
  const result = adapter.generate(input(overrides));
  return { result, files: applyInMemory(result.operations) };
}

function frontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error('missing frontmatter');
  return parseYaml(match[1]!) as Record<string, unknown>;
}

function section(content: string, marker: string): string {
  const { begin, end } = sectionMarkers(marker, 'html');
  return content.slice(content.indexOf(begin) + begin.length + 1, content.indexOf(end) - 1);
}

function fingerprint(files: Map<string, string>): string {
  const entries = [...files.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => ({ path, sha256: createHash('sha256').update(content).digest('hex') }));
  return `${JSON.stringify(entries, null, 2)}\n`;
}

const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe.each([
  ['claude-code', claudeCodeAdapter, '.claude/skills'],
  ['codex', codexAdapter, '.agents/skills'],
] as const)('%s adapter', (id, adapter, skillRoot) => {
  const { result, files } = generateTree(adapter);

  it('should match the golden file tree', async () => {
    await expect(fingerprint(files)).toMatchFileSnapshot(`./__snapshots__/${id}.json`);
  });

  it('should generate without errors', () => {
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  });

  it('should be deterministic and idempotent', () => {
    expect(adapter.generate(input()).operations).toEqual(result.operations);
    expect(applyInMemory(result.operations, files)).toEqual(files);
  });

  it('should emit valid Agent Skills (name = directory, portable name, description ≤ 1024)', () => {
    const skills = [...files.keys()].filter((path) => path.startsWith(skillRoot) && path.endsWith('/SKILL.md'));

    expect(skills.length).toBeGreaterThan(10);
    for (const path of skills) {
      const meta = frontmatter(files.get(path)!);
      expect(meta.name).toBe(path.split('/').at(-2));
      expect(String(meta.name)).toMatch(SKILL_NAME);
      expect(String(meta.name).length).toBeLessThanOrEqual(64);
      expect(String(meta.description).length).toBeGreaterThan(0);
      expect(String(meta.description).length).toBeLessThanOrEqual(1024);
    }
  });

  it('should never ship paths of the generating machine or the opt-in honesty rule', () => {
    for (const [path, content] of files) {
      expect(content, path).not.toContain(homedir());
      expect(content, path).not.toContain(REPO_ROOT);
      expect(content, path).not.toMatch(/\/Users\/[\w.-]+\//);
    }
    expect([...files.keys()].some((path) => path.includes('honesty'))).toBe(false);
  });

  it('should install the self-contained policy hook with the catalog policies', () => {
    const hookDir = id === 'claude-code' ? '.claude/hooks/ai-agent-setup' : '.codex/hooks/ai-agent-setup';

    expect(files.has(`${hookDir}/policy-check.cjs`)).toBe(true);
    expect(files.has(`${hookDir}/policy/policy-engine.cjs`)).toBe(true);
    expect((JSON.parse(files.get(`${hookDir}/policies.json`)!) as Array<{ id: string }>).map((policy) => policy.id)).toEqual(
      report.policies.map((policy) => policy.id),
    );
  });

  it('should not install MCP servers unless they are enabled', () => {
    expect(files.has('.mcp.json')).toBe(false);
    expect(files.get('.codex/config.toml') ?? '').not.toContain('mcp_servers');
  });
});

describe('Claude Code adapter specifics', () => {
  const { result, files } = generateTree(claudeCodeAdapter);

  it('should keep every V1 agent and command name (V1 parity, docs/v2/07 §3)', () => {
    const agents = ['backend', 'code-reviewer', 'copywriter-seo', 'frontend', 'mobile', 'project-manager', 'qa', 'security-auditor', 'systems-architect', 'test-engineer', 'ui-ux-designer'];
    const commands = ['build', 'debug', 'deploy', 'fix-issue', 'plan', 'review', 'simplify', 'spec', 'test'];

    expect(agents.filter((name) => !files.has(`.claude/agents/${name}.md`))).toEqual([]);
    expect(commands.filter((name) => !files.has(`.claude/commands/${name}.md`))).toEqual([]);
  });

  it('should give every agent the frontmatter Claude Code requires', () => {
    for (const [path, content] of files) {
      if (!path.startsWith('.claude/agents/')) continue;
      const meta = frontmatter(content);
      expect(meta.name, path).toBe(path.slice('.claude/agents/'.length, -'.md'.length));
      expect(String(meta.description).length, path).toBeGreaterThan(0);
    }
  });

  it('should restrict the canonical security auditor to read-only tools', () => {
    const meta = frontmatter(files.get('.claude/agents/security-auditor.md')!);

    expect(meta.disallowedTools).toBe('Edit, Write');
  });

  it('should scope path rules with paths frontmatter and keep always rules plain', () => {
    expect(frontmatter(files.get('.claude/rules/typescript-patterns.md')!).paths).toEqual(['**/*.ts', '**/*.tsx']);
    expect(files.get('.claude/rules/security.md')!.startsWith('---')).toBe(false);
  });

  it('should emulate capability-scoped rules as skills and report it', () => {
    expect(files.has('.claude/skills/system-design/SKILL.md')).toBe(true);
    expect(result.items.find((item) => item.entryId === 'rule.system-design')?.support).toBe('emulated');
  });

  it('should copy skill resources next to the skill and link them', () => {
    expect(files.has('.claude/skills/react-frontend/references/performance-checklist.md')).toBe(true);
    expect(files.get('.claude/skills/react-frontend/SKILL.md')).toContain('(references/performance-checklist.md)');
  });

  it('should warn that the deploy skill shadows the /deploy command, as in V1', () => {
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('W_COMMAND_SHADOWED');
  });

  it('should register the policy hook and least-privilege permissions without any allow list', () => {
    const settings = JSON.parse(files.get('.claude/settings.json')!) as {
      permissions: { allow?: string[]; ask: string[] };
      hooks: { PreToolUse: unknown[] };
    };

    expect(settings.permissions.allow).toBeUndefined();
    expect(settings.permissions.ask).toEqual(expect.arrayContaining(['Bash(npm publish *)', 'Bash(git push --force *)', 'Bash(git push * --force *)']));
    // In-token wildcards (rm -*r*) are enforced by the hook only, to avoid asking for unrelated commands.
    expect(settings.permissions.ask.some((rule) => rule.startsWith('Bash(rm'))).toBe(false);
    expect(settings.hooks.PreToolUse[0]).toEqual({
      matcher: 'Bash|Write|Edit|MultiEdit',
      hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/ai-agent-setup/policy-check.cjs" --host claude-code' }],
    });
  });

  it('should put the managed instructions into .claude/CLAUDE.md', () => {
    const t0 = section(files.get('.claude/CLAUDE.md')!, 't0');

    expect(t0).toContain('/spec');
    expect(t0).toContain('NOT_VERIFIED');
  });

  it('should write .mcp.json only for enabled MCP servers', () => {
    const mcp = JSON.parse(generateTree(claudeCodeAdapter, { enabledTools: ['tool.mcp-github'] }).files.get('.mcp.json')!) as { mcpServers: Record<string, unknown> };

    expect(Object.keys(mcp.mcpServers)).toEqual(['github']);
  });
});

describe('Codex adapter specifics', () => {
  const { result, files } = generateTree(codexAdapter);
  const standard = registry.get('profile.standard') as ProfileEntry;

  it('should keep the managed AGENTS.md section within the profile budget', () => {
    const t0 = section(files.get('AGENTS.md')!, 't0');

    expect(Buffer.byteLength(t0)).toBeLessThanOrEqual(standard.contextBudget.codex!);
    expect(t0).toContain('## Security rules');
  });

  it('should fail generation when the instructions exceed the budget', () => {
    const tiny = { ...standard, contextBudget: { codex: 1000 } };

    const codes = codexAdapter.generate(input({ profile: tiny })).diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toContain('E_T0_BUDGET');
  });

  it('should write custom agents as TOML with the three required fields', () => {
    const agentFiles = [...files.keys()].filter((path) => path.startsWith('.codex/agents/'));

    expect(agentFiles.length).toBe(11);
    for (const path of agentFiles) {
      const agent = parseToml(files.get(path)!) as Record<string, string>;
      expect(agent.name, path).toBeTruthy();
      expect(agent.description, path).toBeTruthy();
      expect(agent.developer_instructions?.trim(), path).toBeTruthy();
    }
  });

  it('should expose workflows as skills and rename the one that collides with a skill', () => {
    expect(files.has('.agents/skills/spec/SKILL.md')).toBe(true);
    expect(files.has('.agents/skills/deploy-workflow/SKILL.md')).toBe(true);
    expect(result.items.find((item) => item.entryId === 'wf.deploy')?.note).toContain('deploy-workflow');
  });

  it('should emit parseable config with the sandbox and approval defaults', () => {
    const config = parseToml(files.get('.codex/config.toml')!);

    expect(config).toMatchObject({ sandbox_mode: 'workspace-write', approval_policy: 'on-request' });
  });

  it('should register the hook with a project-root path and say it needs trust', () => {
    const hooks = JSON.parse(files.get('.codex/hooks.json')!) as { hooks: { PreToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }> } };

    expect(hooks.hooks.PreToolUse[0]!.matcher).toBe('^(Bash|apply_patch)$');
    expect(hooks.hooks.PreToolUse[0]!.hooks[0]!.command).toContain('$(git rev-parse --show-toplevel)');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('W_CODEX_TRUST');
  });

  it('should write enabled MCP servers as TOML tables', () => {
    const config = parseToml(generateTree(codexAdapter, { enabledTools: ['tool.mcp-github'] }).files.get('.codex/config.toml')!);

    expect(Object.keys(config.mcp_servers as object)).toEqual(['github']);
  });
});

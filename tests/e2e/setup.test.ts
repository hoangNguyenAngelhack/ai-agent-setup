import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSetup } from '../../src/app/setup';
import { doctor, rollback } from '../../src/installer';
import { hashTree } from '../helpers/fs-tree';
import { createV1Sandbox, runV1Cli, REPO_ROOT, type V1Sandbox } from '../helpers/v1-cli';

/** End-to-end setup into real project trees (W2.0-14 core; docs/v2/07 §4 Path A, docs/v2/09 §3.3). */
const DIST = join(REPO_ROOT, 'dist');
let clock = 0;
const now = () => new Date(Date.UTC(2026, 10, 24, 9, 0, clock++));

function copyTemplate(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `setup-${name}-`));
  cpSync(join(REPO_ROOT, 'templates', name), root, { recursive: true });
  return root;
}

describe('setup into a fresh template project', () => {
  it('should change nothing on dry-run and report the planned files', () => {
    const root = copyTemplate('backend');
    const before = hashTree(root);

    const outcome = runSetup({ root, dryRun: true, distDir: DIST, now });

    expect(hashTree(root)).toEqual(before);
    expect(outcome.applied).toBeNull();
    expect(outcome.adapters).toEqual(['claude-code']);
    expect(outcome.project.frameworks).toEqual(expect.arrayContaining(['express', 'prisma']));
    expect(outcome.plan.changes.some((change) => change.path === '.claude/settings.json' && change.action === 'create')).toBe(true);
  });

  it('should install, pass doctor, be idempotent and roll back byte for byte', () => {
    const root = copyTemplate('frontend-vite');
    const before = hashTree(root);

    const first = runSetup({ root, adapters: ['claude-code', 'codex'], distDir: DIST, now });
    expect(first.applied?.created.length).toBeGreaterThan(100);
    expect(doctor(root)).toMatchObject({ healthy: true, issues: [] });

    const afterFirst = hashTree(root);
    const second = runSetup({ root, adapters: ['claude-code', 'codex'], distDir: DIST, now });
    expect(second.plan.changes.filter((change) => change.action !== 'unchanged')).toEqual([]);
    expect(second).toMatchObject({ upToDate: true, applied: null });
    expect(hashTree(root)).toEqual(afterFirst);

    rollback(root);
    expect(hashTree(root)).toEqual(before);
    expect(() => rollback(root)).toThrow(/Nothing to roll back/);
  });

  it('should choose the Codex adapter when the project already uses Codex', () => {
    const root = copyTemplate('backend');
    writeFileSync(join(root, 'AGENTS.md'), '# Team instructions\n');

    const outcome = runSetup({ root, dryRun: true, distDir: DIST, now });

    expect(outcome.adapters).toEqual(['codex']);
    const agentsMd = outcome.plan.changes.find((change) => change.path === 'AGENTS.md')!;
    expect(agentsMd).toMatchObject({ action: 'merge' });
    expect(agentsMd.after.startsWith('# Team instructions\n')).toBe(true);
  });

  it('should refuse to apply when generation reports an error', () => {
    const root = copyTemplate('backend');

    expect(() => runSetup({ root, adapters: ['codex'], profileId: 'profile.missing', distDir: DIST, now })).toThrow(/profile.missing/);
  });
});

describe.skipIf(process.platform === 'win32')('setup into a V1-generated project (Path A)', () => {
  let sandbox: V1Sandbox;
  beforeAll(() => {
    sandbox = createV1Sandbox();
  });
  afterAll(() => rmSync(sandbox.root, { recursive: true, force: true }));

  it('should keep every V1 file, write .new files for differing ones and merge only shared files', () => {
    const { projectDir } = runV1Cli(sandbox, ['v1-app', '-t', 'backend', '-y']);
    const before = hashTree(projectDir);

    const outcome = runSetup({ root: projectDir, distDir: DIST, now });
    const after = hashTree(projectDir);

    expect(outcome.hosts.find((host) => host.adapter === 'claude-code')?.v1Fingerprint).toBe(true);
    const changedV1Files = Object.keys(before).filter((path) => after[path] !== before[path]);
    expect(changedV1Files.sort()).toEqual(['.claude/CLAUDE.md', '.claude/settings.json']);
    expect(readFileSync(join(projectDir, '.claude/CLAUDE.md'), 'utf8')).toContain('# Claude AI Agent Configuration');
    expect(Object.keys(after).some((path) => path === '.claude/agents/backend.md.ai-agent-setup.new')).toBe(true);
    const settings = JSON.parse(readFileSync(join(projectDir, '.claude/settings.json'), 'utf8'));
    expect(settings.hooks.PreToolUse.some((group: { hooks: Array<{ command: string }> }) => group.hooks[0]!.command.includes('policy-check.cjs'))).toBe(true);
    expect(outcome.diagnostics.map((diagnostic) => diagnostic.code)).toContain('W_V1_PERMISSIONS');
  });
});

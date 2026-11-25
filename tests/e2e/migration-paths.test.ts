import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSetup } from '../../src/app/setup';
import { readManifest, rollback } from '../../src/installer';
import { hashTree } from '../helpers/fs-tree';
import { createV1Sandbox, REPO_ROOT, type V1Sandbox } from '../helpers/v1-cli';

/**
 * docs/v2/07 §7 "Path A to D verified on fixtures" (release sign-off S6). Path A, a project made by the
 * V1 CLI, is covered in tests/e2e/setup.test.ts; this file covers B (V1 configuration copied by hand,
 * no V1 commit), C (adding Codex to a V1 project) and D (V2.x → V2.y with a changed catalog).
 */
const DIST = join(REPO_ROOT, 'dist');
let clock = 0;
const now = () => new Date(Date.UTC(2026, 10, 25, 9, 0, clock++));

function templateProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'migration-'));
  cpSync(join(REPO_ROOT, 'templates', 'backend'), root, { recursive: true });
  return root;
}

const changed = (before: Record<string, string>, after: Record<string, string>) => Object.keys(before).filter((path) => after[path] !== before[path]).sort();

describe.skipIf(process.platform === 'win32')('V1 configuration copied by hand (Path B) and adding Codex (Path C)', () => {
  let sandbox: V1Sandbox;
  const v1Project = () => {
    const root = templateProject();
    // `npx degit …/.claude` or `make copy`: the V1 configuration without the V1 initial commit.
    cpSync(join(sandbox.root, 'baseline', '.claude'), join(root, '.claude'), { recursive: true });
    return root;
  };
  beforeAll(() => {
    sandbox = createV1Sandbox();
  });
  afterAll(() => rmSync(sandbox.root, { recursive: true, force: true }));

  it('Path B: should recognise V1 without its commit and keep every V1 file but the two merged ones', () => {
    const root = v1Project();
    const before = hashTree(root);
    const outcome = runSetup({ root, distDir: DIST, now });

    expect(outcome.hosts.find((host) => host.adapter === 'claude-code')?.v1Fingerprint).toBe(true);
    expect(changed(before, hashTree(root))).toEqual(['.claude/CLAUDE.md', '.claude/settings.json']);
    expect(readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf8')).toContain('# Claude AI Agent Configuration');
    expect(Object.keys(hashTree(root)).some((path) => path.endsWith('.ai-agent-setup.new'))).toBe(true);
    expect(outcome.diagnostics.map((diagnostic) => diagnostic.code)).toContain('W_V1_PERMISSIONS');
  });

  it('Path C: should add Codex next to the V1 Claude Code configuration without touching it', () => {
    const root = v1Project();
    const before = hashTree(root);
    const outcome = runSetup({ root, adapters: ['codex'], distDir: DIST, now });
    const after = hashTree(root);

    expect(changed(before, after)).toEqual([]);
    expect(Object.keys(after).filter((path) => path.startsWith('.claude/') && !(path in before))).toEqual([]);
    for (const file of ['AGENTS.md', '.codex/config.toml', '.codex/hooks.json']) expect(existsSync(join(root, file)), file).toBe(true);
    expect(Object.keys(after).some((path) => path.startsWith('.agents/skills/'))).toBe(true);
    expect(outcome.diagnostics.map((diagnostic) => diagnostic.code)).toContain('W_CODEX_TRUST');
    expect(readManifest(root)!.adapters.codex).toMatchObject({ trustRequired: true });
  });
});

describe('V2.x → V2.y update (Path D)', () => {
  it('should update managed files to the new catalog, keep files the user changed, and roll back byte for byte', () => {
    const root = templateProject();
    runSetup({ root, distDir: DIST, now });
    const installed = readManifest(root)!;
    appendFileSync(join(root, '.claude', 'rules', 'security.md'), '\nLocal note added by the team.\n');

    // V2.y: the bundled catalog changed one rule.
    const catalog = mkdtempSync(join(tmpdir(), 'catalog-v2y-'));
    cpSync(join(REPO_ROOT, 'catalog'), catalog, { recursive: true });
    appendFileSync(join(catalog, 'rules', 'rule.clean-code.md'), '\n\nNew guidance shipped in V2.y.\n');
    const beforeUpdate = hashTree(root);
    const outcome = runSetup({ root, catalogDir: catalog, distDir: DIST, now });

    expect(outcome.applied).not.toBeNull();
    expect(readFileSync(join(root, '.claude', 'rules', 'clean-code.md'), 'utf8')).toContain('New guidance shipped in V2.y.');
    expect(readFileSync(join(root, '.claude', 'rules', 'security.md'), 'utf8')).toContain('Local note added by the team.');
    expect(existsSync(join(root, '.claude', 'rules', 'security.md.ai-agent-setup.new'))).toBe(true);
    expect(readManifest(root)!.catalogDigest).not.toBe(installed.catalogDigest);

    rollback(root);
    const restored = hashTree(root);
    const differs = Object.keys(beforeUpdate).filter((path) => !path.startsWith('.ai-agent-setup/') && restored[path] !== beforeUpdate[path]);
    expect(differs).toEqual([]);
    expect(Object.keys(restored).filter((path) => !path.startsWith('.ai-agent-setup/') && !(path in beforeUpdate))).toEqual([]);
  }, 60000);
});

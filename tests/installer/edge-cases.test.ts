import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyPlan, doctor, mergeJson, planInstall, readManifest, resolveConflicts, rollback, unifiedDiff, type ManifestMeta } from '../../src/installer';
import { listJournals } from '../../src/installer/transaction';
import type { FileOperation } from '../../src/shared/file-operations';
import { writeTree } from '../helpers/fs-tree';

/** Installer edge cases: doctor findings, manifest versions, shared-file conflicts, rollback boundaries. */
const META: ManifestMeta = {
  toolkitVersion: '2.0.0',
  catalogDigest: `sha256:${'a'.repeat(64)}`,
  adapters: { 'claude-code': { version: '0.1.0', hostCompat: 'unverified' } },
  profile: 'profile.standard',
};
let clock = 0;
const now = () => new Date(Date.UTC(2026, 10, 24, 12, 0, clock++));
const write = (path: string, content: string): FileOperation => ({ kind: 'write', path, content, source: 'skill.x@1.0.0' });
const section = (path: string, content: string): FileOperation => ({ kind: 'section', path, marker: 't0', style: 'html', content, source: 'profile.standard' });
const merge = (path: string, value: Record<string, unknown>): FileOperation => ({ kind: 'merge-json', path, value, source: null });

function install(root: string, operations: FileOperation[], strategy: 'skip' | 'write-new' | 'backup-overwrite' = 'write-new') {
  const plan = resolveConflicts(planInstall({ root, operations, meta: META }), strategy);
  return { plan, result: applyPlan(plan, { op: 'setup', now }) };
}

describe('doctor — managed sections and JSON merges', () => {
  it('should report a file holding a managed section that was deleted', () => {
    const root = writeTree({});
    install(root, [section('AGENTS.md', 'managed')]);
    rmSync(join(root, 'AGENTS.md'));

    expect(doctor(root).issues).toEqual([expect.objectContaining({ code: 'MISSING', path: 'AGENTS.md', message: 'file with managed content is missing' })]);
  });

  it('should report a merged JSON file that is no longer valid JSON', () => {
    const root = writeTree({});
    install(root, [merge('.claude/settings.json', { permissions: { ask: ['Bash(npm publish *)'] } })]);
    writeFileSync(join(root, '.claude', 'settings.json'), '{ broken');

    expect(doctor(root)).toMatchObject({ healthy: false, issues: [{ code: 'INVALID_JSON', path: '.claude/settings.json' }] });
  });

  it('should report a managed section edited by hand, and stay healthy for edits outside it', () => {
    const root = writeTree({});
    install(root, [section('AGENTS.md', 'managed')]);
    const original = readFileSync(join(root, 'AGENTS.md'), 'utf8');

    writeFileSync(join(root, 'AGENTS.md'), `# My notes\n\n${original}`);
    expect(doctor(root).healthy).toBe(true);

    writeFileSync(join(root, 'AGENTS.md'), original.replace('managed', 'edited by hand'));
    expect(doctor(root).issues).toEqual([expect.objectContaining({ code: 'SECTION_MODIFIED', path: 'AGENTS.md' })]);
  });
});

describe('manifest versions', () => {
  it('should refuse a manifest written by an unknown schema version', () => {
    const root = writeTree({ '.ai-agent-setup/manifest.json': JSON.stringify({ schema: 'manifest/v9', files: [], sections: [] }) });

    expect(() => readManifest(root)).toThrow('Unsupported manifest schema in .ai-agent-setup/manifest.json: manifest/v9');
    expect(() => planInstall({ root, operations: [write('a.md', 'A')], meta: META })).toThrow(/Unsupported manifest schema/);
  });
});

describe('backup-overwrite on a shared file', () => {
  it('should back up the file and merge the new section when the old one was edited by hand', () => {
    const root = writeTree({});
    install(root, [section('AGENTS.md', 'v1')]);
    const installed = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    writeFileSync(join(root, 'AGENTS.md'), `# Mine\n${installed.replace('v1', 'hand edit')}`);

    const { plan, result } = install(root, [section('AGENTS.md', 'v2')], 'backup-overwrite');

    expect(plan.changes[0]).toMatchObject({ action: 'merge', ownership: 'shared', reason: 'a managed section was edited by hand; overwritten after backup' });
    const after = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(after).toContain('# Mine');
    expect(after).toContain('v2');
    expect(after).not.toContain('hand edit');
    expect(readFileSync(join(root, '.ai-agent-setup', 'backups', result.transactionId, 'AGENTS.md'), 'utf8')).toContain('hand edit');
  });
});

describe('rollback boundaries', () => {
  it('should have no journals before the first install', () => {
    expect(listJournals(writeTree({}))).toEqual([]);
  });

  it('should roll back without force when a created file was already deleted by the user', () => {
    const root = writeTree({});
    install(root, [write('docs/a.md', 'A'), write('docs/b.md', 'B')]);
    rmSync(join(root, 'docs', 'a.md'));

    const result = rollback(root, { force: false });
    expect(result.removed).toContain('docs/b.md');
    expect(result.removed).not.toContain('docs/a.md');
    expect(existsSync(join(root, 'docs'))).toBe(false);
  });

  it('should keep a created directory that now holds the user’s own files', () => {
    const root = writeTree({});
    install(root, [write('.claude/agents/reviewer.md', 'R')]);
    writeFileSync(join(root, '.claude', 'agents', 'mine.md'), 'my agent');

    rollback(root, { force: false });
    expect(existsSync(join(root, '.claude', 'agents', 'reviewer.md'))).toBe(false);
    expect(readFileSync(join(root, '.claude', 'agents', 'mine.md'), 'utf8')).toBe('my agent');
  });
});

describe('diff and JSON merge edge cases', () => {
  it('should write a hunk starting at line 0 when content is added to an empty file', () => {
    expect(unifiedDiff('a.md', '', 'one\ntwo\n')).toContain('@@ -0,0 +1,2 @@');
  });

  it('should let the managed value win when types differ', () => {
    expect(mergeJson({ hooks: ['old'] }, { hooks: { PreToolUse: [] } })).toEqual({ hooks: { PreToolUse: [] } });
    expect(mergeJson(['a'], { b: 1 })).toEqual({ b: 1 });
  });
});

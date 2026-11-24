import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyPlan,
  doctor,
  planInstall,
  readManifest,
  resolveConflicts,
  rollback,
  type ManifestMeta,
} from '../../src/installer';
import type { FileOperation } from '../../src/shared/file-operations';
import { hashTree, writeTree } from '../helpers/fs-tree';

const META: ManifestMeta = {
  toolkitVersion: '2.0.0',
  catalogDigest: `sha256:${'a'.repeat(64)}`,
  adapters: { 'claude-code': { version: '0.1.0', hostCompat: 'unverified' } },
  profile: 'profile.standard',
};

let clock = 0;
/** Deterministic, strictly increasing transaction clock. */
const now = () => new Date(Date.UTC(2026, 10, 24, 8, 0, clock++));

const write = (path: string, content: string, source = 'skill.x@1.0.0'): FileOperation => ({ kind: 'write', path, content, source });
const section = (path: string, content: string): FileOperation => ({ kind: 'section', path, marker: 't0', style: 'html', content, source: 'profile.standard' });
const merge = (path: string, value: Record<string, unknown>): FileOperation => ({ kind: 'merge-json', path, value, source: null });

function install(root: string, operations: FileOperation[], strategy: 'skip' | 'write-new' | 'backup-overwrite' = 'write-new') {
  const plan = resolveConflicts(planInstall({ root, operations, meta: META }), strategy);
  return { plan, result: applyPlan(plan, { op: 'setup', now }) };
}

describe('planInstall — ownership classes (docs/v2/05 §11.2)', () => {
  it('should create new files', () => {
    const plan = planInstall({ root: writeTree({}), operations: [write('a.md', 'A')], meta: META });

    expect(plan.changes).toEqual([expect.objectContaining({ path: 'a.md', action: 'create', ownership: 'new' })]);
  });

  it('should treat an unmanaged existing file as a conflict, never an overwrite', () => {
    const plan = planInstall({ root: writeTree({ 'a.md': 'mine' }), operations: [write('a.md', 'A')], meta: META });

    expect(plan.changes[0]).toMatchObject({ action: 'conflict', ownership: 'unmanaged' });
  });

  it('should report unchanged when the file already has the generated content', () => {
    const plan = planInstall({ root: writeTree({ 'a.md': 'A' }), operations: [write('a.md', 'A')], meta: META });

    expect(plan.changes[0]).toMatchObject({ action: 'unchanged' });
  });

  it('should update a managed file the user has not modified', () => {
    const root = writeTree({});
    install(root, [write('a.md', 'v1')]);

    const plan = planInstall({ root, operations: [write('a.md', 'v2')], meta: META });

    expect(plan.changes[0]).toMatchObject({ action: 'update', ownership: 'managed' });
  });

  it('should flag a managed file the user modified as a conflict', () => {
    const root = writeTree({});
    install(root, [write('a.md', 'v1')]);
    writeFileSync(join(root, 'a.md'), 'my edit');

    const plan = planInstall({ root, operations: [write('a.md', 'v2')], meta: META });

    expect(plan.changes[0]).toMatchObject({ action: 'conflict', ownership: 'managed-modified' });
  });

  it('should merge into an existing shared file and keep the user text', () => {
    const root = writeTree({ 'AGENTS.md': '# Mine\n', '.claude/settings.json': JSON.stringify({ model: 'x' }) });

    const plan = planInstall({ root, operations: [section('AGENTS.md', 'managed'), merge('.claude/settings.json', { a: 1 })], meta: META });

    expect(plan.changes.map((change) => [change.path, change.action, change.ownership])).toEqual([
      ['.claude/settings.json', 'merge', 'shared'],
      ['AGENTS.md', 'merge', 'shared'],
    ]);
    expect(plan.changes[1]!.after).toContain('# Mine');
    expect(JSON.parse(plan.changes[0]!.after)).toEqual({ model: 'x', a: 1 });
  });

  it('should flag a managed section the user edited as a conflict', () => {
    const root = writeTree({});
    install(root, [section('AGENTS.md', 'managed v1')]);
    writeFileSync(join(root, 'AGENTS.md'), readFileSync(join(root, 'AGENTS.md'), 'utf8').replace('managed v1', 'my change'));

    const plan = planInstall({ root, operations: [section('AGENTS.md', 'managed v2')], meta: META });

    expect(plan.changes[0]).toMatchObject({ action: 'conflict', ownership: 'shared' });
  });

  it('should flag invalid JSON as a conflict instead of replacing it', () => {
    const plan = planInstall({ root: writeTree({ 's.json': '{ broken' }), operations: [merge('s.json', { a: 1 })], meta: META });

    expect(plan.changes[0]).toMatchObject({ action: 'conflict' });
  });

  it('should include a unified diff for every change', () => {
    const plan = planInstall({ root: writeTree({ 's.json': '{\n  "a": 1\n}\n' }), operations: [merge('s.json', { b: 2 })], meta: META });

    expect(plan.changes[0]!.diff).toContain('--- a/s.json');
    expect(plan.changes[0]!.diff).toContain('+  "b": 2');
  });
});

describe('dry-run and idempotency (docs/v2/05 §11.4)', () => {
  it('should not change a single byte when only planning', () => {
    const root = writeTree({ 'a.md': 'mine', 'AGENTS.md': '# Mine\n' });
    const before = hashTree(root);

    resolveConflicts(planInstall({ root, operations: [write('a.md', 'A'), section('AGENTS.md', 'm'), write('b/c.md', 'C')], meta: META }), 'backup-overwrite');

    expect(hashTree(root)).toEqual(before);
  });

  it('should produce no changes on a second identical install', () => {
    const root = writeTree({ 'AGENTS.md': '# Mine\n' });
    const operations = [write('a.md', 'A'), section('AGENTS.md', 'm'), merge('s.json', { a: [1] })];
    install(root, operations);

    const plan = planInstall({ root, operations, meta: META });

    expect(plan.changes.map((change) => change.action)).toEqual(['unchanged', 'unchanged', 'unchanged']);
  });
});

describe('conflict strategies', () => {
  it('should write a .new file next to a conflicting file by default and leave it untouched', () => {
    const root = writeTree({ 'a.md': 'mine' });

    install(root, [write('a.md', 'A')]);

    expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('mine');
    expect(readFileSync(join(root, 'a.md.ai-agent-setup.new'), 'utf8')).toBe('A');
  });

  it('should leave a conflicting file alone with skip', () => {
    const root = writeTree({ 'a.md': 'mine' });

    const { result } = install(root, [write('a.md', 'A')], 'skip');

    expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('mine');
    expect(result.skipped).toEqual(['a.md']);
  });

  it('should back up before overwriting with backup-overwrite', () => {
    const root = writeTree({ 'a.md': 'mine' });

    const { result } = install(root, [write('a.md', 'A')], 'backup-overwrite');

    expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('A');
    expect(readFileSync(join(root, '.ai-agent-setup', 'backups', result.transactionId, 'a.md'), 'utf8')).toBe('mine');
  });

  it('should refuse to apply a plan when a file changed after planning', () => {
    const root = writeTree({ 'AGENTS.md': '# Mine\n' });
    const plan = resolveConflicts(planInstall({ root, operations: [section('AGENTS.md', 'm')], meta: META }), 'write-new');
    writeFileSync(join(root, 'AGENTS.md'), '# Mine, edited after reading the diff\n');

    expect(() => applyPlan(plan, { op: 'setup', now })).toThrow(/changed after the plan/);
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# Mine, edited after reading the diff\n');
  });

  it('should refuse to apply a plan with unresolved conflicts', () => {
    const root = writeTree({ 'a.md': 'mine' });
    const plan = planInstall({ root, operations: [write('a.md', 'A')], meta: META });

    expect(() => applyPlan(plan, { op: 'setup', now })).toThrow(/unresolved conflict/);
  });
});

describe('apply, manifest and rollback', () => {
  it('should record managed files, sections and the transaction in the manifest', () => {
    const root = writeTree({});

    const { result } = install(root, [write('a.md', 'A'), section('AGENTS.md', 'm')]);
    const manifest = readManifest(root)!;

    expect(manifest.files).toEqual([expect.objectContaining({ path: 'a.md', class: 'managed', source: 'skill.x@1.0.0' })]);
    expect(manifest.sections).toEqual([expect.objectContaining({ path: 'AGENTS.md', marker: 't0' })]);
    expect(manifest.transactions.at(-1)).toMatchObject({ id: result.transactionId, op: 'setup' });
    expect(readFileSync(join(root, '.ai-agent-setup', '.gitignore'), 'utf8')).toContain('backups/');
  });

  it('should restore the exact previous state on rollback', () => {
    const root = writeTree({ 'AGENTS.md': '# Mine\n', 'keep.txt': 'k', 's.json': '{"model":"x"}' });
    const before = hashTree(root);
    install(root, [write('a.md', 'A'), write('deep/dir/b.md', 'B'), section('AGENTS.md', 'm'), merge('s.json', { a: 1 }), write('keep.txt', 'K')], 'backup-overwrite');

    const outcome = rollback(root);

    expect(outcome.restored).toEqual(expect.arrayContaining(['AGENTS.md', 'keep.txt', 's.json']));
    expect(hashTree(root)).toEqual(before);
    expect(existsSync(join(root, 'deep'))).toBe(false);
  });

  it('should roll back only the latest transaction, one at a time', () => {
    const root = writeTree({});
    install(root, [write('a.md', 'v1')]);
    const afterFirst = hashTree(root);
    install(root, [write('a.md', 'v2')]);

    rollback(root);
    expect(hashTree(root)).toEqual(afterFirst);

    rollback(root);
    expect(existsSync(join(root, 'a.md'))).toBe(false);
  });

  it('should refuse to delete a created file the user changed after install', () => {
    const root = writeTree({});
    install(root, [write('a.md', 'A')]);
    writeFileSync(join(root, 'a.md'), 'edited later');

    expect(() => rollback(root)).toThrow(/modified after the transaction/);
    expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('edited later');
  });

  it.skipIf(process.platform === 'win32')('should roll back automatically when a write fails midway', () => {
    const root = writeTree({ 'AGENTS.md': '# Mine\n' });
    const before = hashTree(root);
    mkdirSync(join(root, 'locked'));
    chmodSync(join(root, 'locked'), 0o500);

    const plan = resolveConflicts(
      planInstall({ root, operations: [write('a.md', 'A'), section('AGENTS.md', 'm'), write('locked/x.md', 'X')], meta: META }),
      'write-new',
    );

    expect(() => applyPlan(plan, { op: 'setup', now })).toThrow(/rolled back/);
    chmodSync(join(root, 'locked'), 0o700);
    expect(hashTree(root)).toEqual(before);
    const journals = readdirSync(join(root, '.ai-agent-setup', 'transactions'));
    expect((JSON.parse(readFileSync(join(root, '.ai-agent-setup', 'transactions', journals[0]!), 'utf8')) as { status: string }).status).toBe('rolled-back');
  });
});

describe('doctor', () => {
  it('should report a healthy install', () => {
    const root = writeTree({});
    install(root, [write('a.md', 'A'), section('AGENTS.md', 'm')]);

    expect(doctor(root)).toMatchObject({ healthy: true, issues: [] });
  });

  it('should detect modified, missing and pending-transaction problems', () => {
    const root = writeTree({});
    install(root, [write('a.md', 'A'), write('b.md', 'B'), section('AGENTS.md', 'm')]);
    writeFileSync(join(root, 'a.md'), 'changed');
    rmSync(join(root, 'b.md'));
    writeFileSync(join(root, 'AGENTS.md'), 'markers removed\n');

    const report = doctor(root);

    expect(report.healthy).toBe(false);
    expect(report.issues.map((issue) => [issue.code, issue.path])).toEqual([
      ['MODIFIED', 'a.md'],
      ['MISSING', 'b.md'],
      ['SECTION_MISSING', 'AGENTS.md'],
    ]);
  });

  it('should report a project without a manifest as not installed', () => {
    expect(doctor(writeTree({}))).toMatchObject({ healthy: false, issues: [{ code: 'NOT_INSTALLED' }] });
  });
});

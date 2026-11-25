import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudeCodeDelivery } from '../../../src/adapters/claude-code';
import { codexDelivery } from '../../../src/adapters/codex';
import { listFiles, prepareArms } from '../../../src/app/benchmark/arms';
import { judge, snapshotTree, treeDigest } from '../../../src/app/benchmark/oracle';
import { bootstrapMeanInterval, buildBenchmarkReport, seededRandom, shuffle, type Controls, type Trial } from '../../../src/app/benchmark/report';
import { loadSuite, type BenchmarkTask } from '../../../src/app/benchmark/tasks';
import { UsageMeter } from '../../../src/core/evaluation';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

const SUITE = join(REPO_ROOT, 'tests', 'fixtures', 'benchmark', 'suite');

describe('benchmark tasks (W2.2-02)', () => {
  it('should load the suite and refuse invalid tasks, missing folders and duplicates', () => {
    expect(loadSuite(SUITE).map((task) => task.id)).toEqual(['add-function', 'write-adr']);
    const task = (extra: string) => `schema: benchmark-task/v1\nid: t1\ncategory: backend\ndomains: [backend]\nfixture: f\nprompt: p\nscope: ["**"]\nacceptance: { rubric: { threshold: 1, criteria: [c] } }\ntimeLimit: 5\n${extra}`;
    expect(() => loadSuite(writeTree({}))).toThrow(/No tasks directory/);
    expect(() => loadSuite(writeTree({ 'tasks/a.yaml': task('colour: red\n'), 'f/x': '' }))).toThrow(/a.yaml: .*colour/);
    expect(() => loadSuite(writeTree({ 'tasks/a.yaml': task('') }))).toThrow(/fixture f not found/);
    expect(() => loadSuite(writeTree({ 'tasks/a.yaml': task(''), 'tasks/b.yaml': task(''), 'f/x': '' }))).toThrow(/Duplicate task id t1/);
    expect(() => loadSuite(writeTree({ 'tasks/readme.txt': '' }))).toThrow(/No task in/);
  });

  it('should invoke each host with the prompt and the model', () => {
    expect(claudeCodeDelivery.promptInvocation('do x', 'm1')).toEqual({ executable: 'claude', args: ['-p', 'do x', '--output-format', 'stream-json', '--verbose', '--model', 'm1'] });
    expect(codexDelivery.promptInvocation('do x', 'm1')).toEqual({ executable: 'codex', args: ['exec', '--json', '-m', 'm1', 'do x'] });
  });
});

describe('benchmark arms (W2.2-02)', () => {
  it.each(['claude-code', 'codex'] as const)('should give arm A only the V2 permissions for %s, B the pinned V1 configuration and C the V2 profile', (host) => {
    const arms = prepareArms(REPO_ROOT, host);
    const files = Object.fromEntries(Object.entries(arms).map(([arm, dir]) => [arm, listFiles(dir)]));
    if (host === 'claude-code') {
      expect(files.A!.every((path) => path === '.claude/settings.json' || path.startsWith('.claude/hooks/ai-agent-setup/'))).toBe(true);
      expect(files.A).toContain('.claude/settings.json');
      expect(readFileSync(join(arms.B, '.claude', 'CLAUDE.md'), 'utf8')).toContain('# Claude AI Agent Configuration');
      expect(readFileSync(join(arms.C, '.claude', 'CLAUDE.md'), 'utf8')).toContain('ai-agent-setup:begin');
    } else {
      expect(files.A!.sort()[0]).toBe('.codex/config.toml');
      expect(files.A!.some((path) => path === 'AGENTS.md' || path.startsWith('.agents/'))).toBe(false);
      expect(files.B!.every((path) => path.startsWith('.agents/skills/'))).toBe(true);
      expect(files.C).toContain('AGENTS.md');
    }
  }, 60000);
});

const task: BenchmarkTask = {
  schema: 'benchmark-task/v1',
  id: 't',
  category: 'security',
  domains: ['security'],
  fixture: 'f',
  prompt: 'p',
  scope: ['src/**'],
  acceptance: { hiddenTests: { files: 'hidden', command: 'node .benchmark-hidden/ok.cjs' } },
  timeLimit: 5,
};

describe('benchmark oracle (W2.2-02)', () => {
  const suite = writeTree({ 'hidden/ok.cjs': 'process.exit(0)' });

  it('should accept changes inside the scope and reject data loss outside it', () => {
    const workspace = writeTree({ 'src/a.js': '1', 'README.md': 'x' });
    const before = snapshotTree(workspace);
    writeFileSync(join(workspace, 'src/a.js'), '2');
    writeFileSync(join(workspace, 'notes.md'), 'new file outside the scope is not data loss');
    expect(judge(task, suite, workspace, before)).toMatchObject({ verdict: 'ACCEPTED', dataLoss: { status: 'PASS', files: [] }, hiddenTests: { status: 'PASS' } });
    // The hidden tests were copied in after the changes were read.
    expect(existsSync(join(workspace, '.benchmark-hidden', 'ok.cjs'))).toBe(true);

    const lossy = writeTree({ 'src/a.js': '1', 'README.md': 'x', 'docs/b.md': 'y' });
    const lossyBefore = snapshotTree(lossy);
    rmSync(join(lossy, 'README.md'));
    writeFileSync(join(lossy, 'docs/b.md'), 'changed');
    expect(judge(task, suite, lossy, lossyBefore)).toMatchObject({ verdict: 'REJECTED', dataLoss: { status: 'FAIL', files: ['README.md', 'docs/b.md'] } });
  });

  it('should reject a new secret or a failed security check', () => {
    const workspace = writeTree({ 'src/a.js': '1' });
    const before = snapshotTree(workspace);
    writeFileSync(join(workspace, 'src/a.js'), `const t = 'ghp_${'Zq7'.repeat(12)}';`); // secret-scan:allow synthetic fixture
    expect(judge(task, suite, workspace, before)).toMatchObject({ verdict: 'REJECTED', security: { status: 'FAIL', findings: ['src/a.js: 1 github-token'] } });

    const checked = writeTree({ 'src/a.js': '1' });
    const result = judge({ ...task, securityChecks: [{ name: 'no-eval', command: 'node -e "process.exit(3)"' }] }, suite, checked, snapshotTree(checked));
    expect(result.security).toEqual({ status: 'FAIL', findings: ['no-eval: exit 3'] });
  });

  it('should leave a rubric task NOT_VERIFIED and a failing hidden test REJECTED', () => {
    const workspace = writeTree({ 'src/a.js': '1' });
    const rubric = judge({ ...task, acceptance: { rubric: { threshold: 3, criteria: ['c'] } } }, suite, workspace, snapshotTree(workspace));
    expect(rubric).toMatchObject({ verdict: 'NOT_VERIFIED', hiddenTests: { status: 'NOT_APPLICABLE' }, rubric: { status: 'NOT_VERIFIED' } });
    const failing = writeTree({ 'hidden/ok.cjs': 'process.exit(1)' });
    expect(judge(task, failing, workspace, snapshotTree(workspace))).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL', detail: 'node .benchmark-hidden/ok.cjs: exit 1' } });
  });

  it('should give the same digest to the same tree and a different one after a change', () => {
    const dir = writeTree({ 'a.txt': '1', 'b/c.txt': '2' });
    const first = treeDigest(dir);
    expect(treeDigest(writeTree({ 'b/c.txt': '2', 'a.txt': '1' }))).toBe(first);
    writeFileSync(join(dir, 'a.txt'), '3');
    expect(treeDigest(dir)).not.toBe(first);
  });
});

const usage = (tokens: number) => {
  const meter = new UsageMeter('claude-code');
  meter.add({ tokens: { input: tokens, output: tokens } });
  return meter.result();
};

function trial(task: string, arm: Trial['arm'], verdict: Trial['oracle']['verdict']): Trial {
  return {
    order: 1,
    task,
    category: 'backend',
    arm,
    rep: 1,
    durationMs: 10,
    exitCode: 0,
    timedOut: false,
    usage: usage(10),
    oracle: { verdict, hiddenTests: { status: 'PASS', detail: '' }, dataLoss: { status: 'PASS', files: [] }, security: { status: 'PASS', findings: [] }, rubric: { status: 'NOT_APPLICABLE', detail: '' } },
  };
}

const controls: Controls = { host: 'claude-code', hostVersion: 'x', model: 'm', seed: 1, n: 3, packageCommit: null, v1Commit: '51bfc3a', fixtures: {}, timeLimits: {} };

describe('benchmark statistics (W2.2-02)', () => {
  it('should shuffle reproducibly by seed', () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    expect(shuffle(items, seededRandom(3))).toEqual(shuffle(items, seededRandom(3)));
    expect(shuffle(items, seededRandom(3))).not.toEqual(shuffle(items, seededRandom(4)));
    expect([...shuffle(items, seededRandom(3))].sort((a, b) => a - b)).toEqual(items);
  });

  it('should give a bootstrap interval around the mean, and none for fewer than two values', () => {
    expect(bootstrapMeanInterval([1], seededRandom(1))).toBeNull();
    const interval = bootstrapMeanInterval([0, 0.5, 1, 1, 0.5, 0], seededRandom(1))!;
    expect(interval.low).toBeLessThanOrEqual(0.5);
    expect(interval.high).toBeGreaterThanOrEqual(0.5);
    expect(bootstrapMeanInterval([0.2, 0.2, 0.2], seededRandom(1))).toEqual({ low: 0.2, high: 0.2 });
  });

  it('should decide the acceptance hypothesis from the confidence interval of a valid run', () => {
    const run = (cWins: number) =>
      Array.from({ length: 30 }, (_, index) => `t${index}`).flatMap((task, index) =>
        Array.from({ length: 3 }, () => [trial(task, 'B', 'REJECTED'), trial(task, 'C', index < cWins ? 'ACCEPTED' : 'REJECTED')]).flat(),
      );
    const supported = buildBenchmarkReport(run(30), controls, ['B', 'C'], new Date());
    expect(supported).toMatchObject({ validity: { valid: true, problems: [] }, hypothesis: { status: 'SUPPORTED' } });
    expect(supported.comparisons).toEqual([{ pair: 'C-B', tasks: 30, acceptanceDifference: { value: 1, ci95: { low: 1, high: 1 } } }]);
    expect(buildBenchmarkReport(run(0), controls, ['B', 'C'], new Date()).hypothesis.status).toBe('NOT_SUPPORTED');
    expect(buildBenchmarkReport(run(3), controls, ['B', 'C'], new Date()).hypothesis.status).toBe('INCONCLUSIVE');
    expect(buildBenchmarkReport(run(30), controls, ['C'], new Date())).toMatchObject({ validity: { valid: false, problems: ['arms B and C are both needed for the V1-vs-V2 comparison'] }, comparisons: [] });
  });
});

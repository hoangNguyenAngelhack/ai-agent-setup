import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBenchmark } from '../../src/app/benchmark/run';
import type { Trial } from '../../src/app/benchmark/report';
import { writeTree } from '../helpers/fs-tree';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * W2.2-02 evaluation framework end to end through real processes: arms prepared from the real V2
 * setup and the pinned V1 commit, trials in seeded order, the oracle, statistics and the report.
 * The host is tests/helpers/fake-bench-host.cjs installed as `claude`, which behaves differently per
 * arm; it proves the harness, not any result about real agents.
 */
const SUITE = join(REPO_ROOT, 'tests', 'fixtures', 'benchmark', 'suite');
const originalPath = process.env.PATH;

describe.skipIf(process.platform === 'win32')('benchmark harness (fake host)', () => {
  beforeEach(() => {
    const bin = writeTree({});
    copyFileSync(join(REPO_ROOT, 'tests', 'helpers', 'fake-bench-host.cjs'), join(bin, 'claude'));
    chmodSync(join(bin, 'claude'), 0o755);
    process.env.PATH = `${bin}${delimiter}${originalPath}`;
  });
  afterEach(() => {
    process.env.PATH = originalPath;
    delete process.env.FAKE_BENCH_C_LEAKS;
  });

  it('should run every task × arm × repetition under one set of controls and judge each trial', async () => {
    const outDir = writeTree({});
    const report = await runBenchmark({ suiteDir: SUITE, host: 'claude-code', model: 'fake-model', n: 2, seed: 7, outDir });

    const trials = readFileSync(join(outDir, 'trials.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Trial);
    expect(trials).toHaveLength(12);
    expect(trials.map((trial) => trial.order)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    const verdicts = (task: string, arm: string) => [...new Set(trials.filter((trial) => trial.task === task && trial.arm === arm).map((trial) => trial.oracle.verdict))];
    // Arm C solves the code task; A writes a wrong implementation; B solves it but deletes README.md.
    expect([verdicts('add-function', 'C'), verdicts('add-function', 'A'), verdicts('add-function', 'B')]).toEqual([['ACCEPTED'], ['REJECTED'], ['REJECTED']]);
    expect(trials.find((trial) => trial.task === 'add-function' && trial.arm === 'A')!.oracle.hiddenTests.status).toBe('FAIL');
    expect(trials.find((trial) => trial.arm === 'B')!.oracle.dataLoss).toEqual({ status: 'FAIL', files: ['README.md'] });
    // The ADR task needs a blinded reviewer: never accepted automatically.
    expect([verdicts('write-adr', 'C'), verdicts('write-adr', 'A')]).toEqual([['NOT_VERIFIED'], ['NOT_VERIFIED']]);

    const arm = (id: string) => report.arms.find((item) => item.arm === id)!;
    expect(arm('C')).toMatchObject({ trials: 4, accepted: 2, notVerified: 2, acceptanceRate: { value: 0.5 }, tokensPerAcceptedTask: { input: 400, output: 40 }, dataLossIncidents: 0 });
    expect(arm('A')).toMatchObject({ accepted: 0, rejected: 2, notVerified: 2, tokensPerAcceptedTask: null });
    expect(arm('B')).toMatchObject({ accepted: 0, rejected: 4, dataLossIncidents: 4 });
    expect(report.comparisons.find((item) => item.pair === 'C-B')).toMatchObject({ tasks: 2, acceptanceDifference: { value: 0.5 } });
    expect(report.categories).toEqual([
      { category: 'architecture', acceptance: { A: 0, B: 0, C: 0 } },
      { category: 'backend', acceptance: { A: 0, B: 0, C: 1 } },
    ]);
    // Two tasks and n = 2: the harness ran, but nothing may be claimed.
    expect(report.validity).toEqual({ valid: false, problems: ['2 task(s); 09 §5.3 needs at least 30', 'n = 2; 09 §5.2 needs n ≥ 3'] });
    expect(report.hypothesis.status).toBe('INCONCLUSIVE');
    expect(report.veto).toEqual({ triggered: false, reasons: [] });
    expect(report.controls).toMatchObject({ host: 'claude-code', hostVersion: 'fake-claude 9.9.9', model: 'fake-model', seed: 7, n: 2, v1Commit: '51bfc3a', timeLimits: { 'add-function': 60, 'write-adr': 60 } });
    expect(Object.keys(report.controls.fixtures)).toEqual(['add-function', 'write-adr']);
    expect(existsSync(join(outDir, 'report.json')) && readFileSync(join(outDir, 'report.md'), 'utf8')).toContain('Valid for claims: no');
  }, 120000);

  it('should veto when arm C causes more security incidents than another arm', async () => {
    process.env.FAKE_BENCH_C_LEAKS = '1';
    const report = await runBenchmark({ suiteDir: SUITE, host: 'claude-code', model: 'fake-model', n: 1, arms: ['B', 'C'], outDir: writeTree({}) });
    expect(report.arms.find((item) => item.arm === 'C')).toMatchObject({ securityIncidents: 1, accepted: 0 });
    expect(report.veto).toEqual({ triggered: true, reasons: ['arm C has 1 security incident(s), arm B 0'] });
  }, 120000);

  it('should run from the command line, and refuse without a model or a host', () => {
    const script = join(REPO_ROOT, 'dist', 'app', 'benchmark', 'run.js');
    const outDir = writeTree({});
    const run = (args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: process.env });
    const ok = run(['--model', 'fake-model', '--suite', SUITE, '--n', '1', '--arms', 'C', '--out', outDir]);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(`Written to ${outDir}`);
    expect(readFileSync(join(outDir, 'report.md'), 'utf8')).toContain('model fake-model');
    expect(run([]).status).toBe(2);
    const noHost = run(['--model', 'm', '--host', 'codex', '--suite', SUITE, '--out', writeTree({})]);
    expect(noHost.status).toBe(1);
    expect(noHost.stderr).toContain('codex is not on PATH');
  }, 120000);

  it('should refuse to start without the host CLI', async () => {
    process.env.PATH = writeTree({});
    await expect(runBenchmark({ suiteDir: SUITE, host: 'codex', model: 'm', outDir: writeTree({}) })).rejects.toThrow(/codex is not on PATH: the benchmark cannot run \(NOT_VERIFIED\)/);
  });
});

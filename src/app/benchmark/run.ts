import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeCodeDelivery } from '../../adapters/claude-code';
import { codexDelivery } from '../../adapters/codex';
import type { HostDelivery } from '../../adapters/common/delivery';
import { UsageMeter } from '../../core/evaluation';
import { killTree } from '../../quality';
import { SchemaValidator } from '../../registry';
import { projectIdentity } from '../run-files';
import { hostAvailable } from '../runs';
import { ARMS, prepareArms, prepareWorkspace, V1_BASELINE_COMMIT, type Arm, type BenchmarkHost } from './arms';
import { judge, snapshotTree, treeDigest } from './oracle';
import { buildBenchmarkReport, renderBenchmarkReport, seededRandom, shuffle, type BenchmarkReport, type Trial } from './report';
import { loadSuite, type BenchmarkTask } from './tasks';

/**
 * Evaluation framework (W2.2-02, docs/v2/09 §5): runs every task × arm × repetition in a seeded random
 * order under identical controls (one host and version, one model, the same fixture, prompt, time
 * limit and environment), judges each trial with the oracle, and writes the trials and the report.
 * Nothing runs without the host CLI: a missing host stops the run before any trial.
 */
const PACKAGE_ROOT = join(__dirname, '..', '..', '..');
const BENCHMARK_REPORT_SCHEMA = 'urn:ai-agent-setup:contracts:v1:benchmark-report';
const HOSTS: Record<BenchmarkHost, HostDelivery> = { 'claude-code': claudeCodeDelivery, codex: codexDelivery };

export interface BenchmarkOptions {
  suiteDir: string;
  host: BenchmarkHost;
  model: string;
  n?: number;
  seed?: number;
  arms?: readonly Arm[];
  outDir: string;
  packageRoot?: string;
  keepWorkspaces?: boolean;
  now?: () => Date;
}

interface HostRun {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

/** Runs the host in `cwd` and stops its whole process tree at the time limit. */
async function runHostProcess(executable: string, args: string[], cwd: string, timeoutMs: number, onLine: (line: string) => void): Promise<HostRun> {
  const started = Date.now();
  const child = spawn(executable, args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], detached: process.platform !== 'win32' });
  createInterface({ input: child.stdout }).on('line', onLine);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid !== undefined) killTree(child.pid, 'SIGKILL');
  }, timeoutMs);
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code));
  });
  clearTimeout(timer);
  return { exitCode, timedOut, durationMs: Date.now() - started };
}

async function runTrial(
  options: { suiteDir: string; delivery: HostDelivery; model: string; keep: boolean },
  task: BenchmarkTask,
  arm: Arm,
  armDir: string,
): Promise<Omit<Trial, 'order' | 'rep'>> {
  const workspace = prepareWorkspace(join(options.suiteDir, task.fixture), armDir);
  try {
    const before = snapshotTree(workspace);
    const meter = new UsageMeter(options.delivery.host);
    const { executable, args } = options.delivery.promptInvocation(task.prompt, options.model);
    const run = await runHostProcess(executable, args, workspace, task.timeLimit * 1000, (line) => {
      const usage = options.delivery.parseUsage(line);
      if (usage) meter.add(usage);
    });
    return { task: task.id, category: task.category, arm, ...run, usage: meter.result(), oracle: judge(task, options.suiteDir, workspace, before) };
  } finally {
    if (!options.keep) rmSync(workspace, { recursive: true, force: true });
  }
}

export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkReport> {
  const packageRoot = options.packageRoot ?? PACKAGE_ROOT;
  const n = options.n ?? 3;
  const seed = options.seed ?? 1;
  const arms = options.arms ?? ARMS;
  const delivery = HOSTS[options.host];
  if (!hostAvailable(delivery.executable)) throw new Error(`${delivery.executable} is not on PATH: the benchmark cannot run (NOT_VERIFIED); install and sign in to ${options.host} first`);
  const tasks = loadSuite(options.suiteDir);
  const hostVersion = spawnSync(delivery.executable, ['--version'], { encoding: 'utf8' }).stdout?.trim() || 'unknown';
  const armDirs = prepareArms(packageRoot, options.host);
  const plan = shuffle(
    tasks.flatMap((task) => arms.flatMap((arm) => Array.from({ length: n }, (_, rep) => ({ task, arm, rep: rep + 1 })))),
    seededRandom(seed),
  );
  const trials: Trial[] = [];
  mkdirSync(options.outDir, { recursive: true });
  try {
    for (const [index, { task, arm, rep }] of plan.entries()) {
      const trial: Trial = { order: index + 1, rep, ...(await runTrial({ suiteDir: options.suiteDir, delivery, model: options.model, keep: options.keepWorkspaces ?? false }, task, arm, armDirs[arm])) };
      trials.push(trial);
      // Written after every trial, so an interrupted run keeps what it measured.
      writeFileSync(join(options.outDir, 'trials.jsonl'), trials.map((item) => JSON.stringify(item)).join('\n') + '\n');
    }
  } finally {
    rmSync(dirname(armDirs.A), { recursive: true, force: true });
  }
  const controls = {
    host: options.host,
    hostVersion,
    model: options.model,
    seed,
    n,
    packageCommit: projectIdentity(packageRoot).commit,
    v1Commit: V1_BASELINE_COMMIT,
    fixtures: Object.fromEntries(tasks.map((task) => [task.id, treeDigest(join(options.suiteDir, task.fixture))])),
    timeLimits: Object.fromEntries(tasks.map((task) => [task.id, task.timeLimit])),
  };
  const report = buildBenchmarkReport(trials, controls, arms, (options.now ?? (() => new Date()))());
  const check = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas')).validate(BENCHMARK_REPORT_SCHEMA, report);
  if (!check.valid) throw new Error(`Benchmark report is invalid: ${check.errors.join('; ')}`);
  writeFileSync(join(options.outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(options.outDir, 'report.md'), renderBenchmarkReport(report));
  return report;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (require.main === module) {
  const host = (argument('host') ?? 'claude-code') as BenchmarkHost;
  const model = argument('model');
  if (!model || !(host in HOSTS)) {
    process.stderr.write('Usage: npm run bench -- --model <model id> [--host claude-code|codex] [--suite benchmarks/suite] [--n 3] [--seed 1] [--arms A,B,C] [--out dir] [--keep]\n');
    process.exit(2);
  }
  const outDir = argument('out') ?? join(PACKAGE_ROOT, 'benchmarks', 'results', new Date().toISOString().replace(/[:.]/g, '-'));
  runBenchmark({
    suiteDir: argument('suite') ?? join(PACKAGE_ROOT, 'benchmarks', 'suite'),
    host,
    model,
    n: Number(argument('n') ?? 3),
    seed: Number(argument('seed') ?? 1),
    arms: (argument('arms')?.split(',') as Arm[] | undefined) ?? ARMS,
    outDir,
    keepWorkspaces: process.argv.includes('--keep'),
  })
    .then((report) => process.stdout.write(`${renderBenchmarkReport(report)}\nWritten to ${outDir}\n`))
    .catch((error: Error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

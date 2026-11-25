import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import { CHECK_ROOMS, EVALUATOR_VERSION, judge, snapshotTree, treeDigest } from './oracle';
import { buildBenchmarkReport, renderBenchmarkReport, seededRandom, shuffle, type BenchmarkReport, type Controls, type Trial } from './report';
import { benchmarkSecrets, subjectPrefix } from './subject';
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
  /** Run only these tasks (a calibration run); the report then fails the ≥ 30 tasks validity rule. */
  taskIds?: string[];
  now?: () => Date;
}

const digest = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** What a task's result depends on besides its fixture: its prompt, hidden checks and security checks. */
function taskDigests(task: BenchmarkTask, suiteDir: string): Controls['tasks'][string] {
  const hidden = task.acceptance.hiddenTests;
  const security = task.securityChecks;
  return {
    prompt: digest(task.prompt),
    hiddenChecks: hidden ? digest(`${hidden.command}\n${treeDigest(join(suiteDir, hidden.files))}`) : null,
    securityChecks: security?.length ? digest(`${JSON.stringify(security)}\n${treeDigest(join(suiteDir, 'security'))}`) : null,
  };
}

/**
 * Keeps the host out of the checks, the reference solutions and the results while it works. Claude
 * Code runs under a Seatbelt profile that denies only those paths. Codex is not wrapped: its own
 * sandbox uses `sandbox-exec`, which cannot be nested (tested on macOS), so its runs stay unprotected
 * and are not valid for claims outside a container (09 §5.2).
 */
function hostSecretsPrefix(host: BenchmarkHost, suiteDir: string, outDir: string): ReturnType<typeof subjectPrefix> {
  return host === 'claude-code' ? subjectPrefix(benchmarkSecrets(suiteDir, CHECK_ROOMS, outDir)) : { prefix: [], isolation: 'process' };
}

export interface PlannedTrial {
  task: BenchmarkTask;
  arm: Arm;
  rep: number;
}

/** Every task × arm × repetition in a seeded random order: the same seed gives the same order. */
export function planTrials(tasks: BenchmarkTask[], arms: readonly Arm[], n: number, seed: number): PlannedTrial[] {
  return shuffle(
    tasks.flatMap((task) => arms.flatMap((arm) => Array.from({ length: n }, (_, rep) => ({ task, arm, rep: rep + 1 })))),
    seededRandom(seed),
  );
}

/** The tasks to run; an unknown id is an error, never a silently smaller suite. */
export function selectTasks(tasks: BenchmarkTask[], ids?: string[]): BenchmarkTask[] {
  if (!ids) return tasks;
  const unknown = ids.filter((id) => !tasks.some((task) => task.id === id));
  if (unknown.length) throw new Error(`Unknown benchmark task(s): ${unknown.join(', ')}`);
  return tasks.filter((task) => ids.includes(task.id));
}

/** What a run would do, without starting any host: trial count, order digest and worst-case time. */
export function describePlan(trials: PlannedTrial[]): string {
  const order = trials.map((trial) => `${trial.task.id}/${trial.arm}/${trial.rep}`);
  const perArm = [...new Set(trials.map((trial) => trial.arm))].map((arm) => `${arm} ${trials.filter((trial) => trial.arm === arm).length}`);
  const limitSeconds = trials.reduce((sum, trial) => sum + trial.task.timeLimit, 0);
  return [
    `Trials: ${trials.length} (${new Set(trials.map((trial) => trial.task.id)).size} tasks; per arm: ${perArm.join(', ')})`,
    `Order digest: sha256:${createHash('sha256').update(order.join('\n')).digest('hex')}`,
    `First trials: ${order.slice(0, 5).join(', ')}`,
    `Worst case (every trial reaches its time limit): ${(limitSeconds / 3600).toFixed(1)} h`,
  ].join('\n');
}

interface HostRun {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

/** Runs the host in `cwd` and stops its whole process group at the time limit and when it exits. */
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
  // Whatever the agent left running must not change the workspace while it is judged.
  if (child.pid !== undefined) killTree(child.pid, 'SIGKILL');
  return { exitCode, timedOut, durationMs: Date.now() - started };
}

async function runTrial(
  options: { suiteDir: string; delivery: HostDelivery; model: string; keep: boolean; hostPrefix: string[] },
  task: BenchmarkTask,
  arm: Arm,
  armDir: string,
): Promise<Omit<Trial, 'order' | 'rep'>> {
  const workspace = prepareWorkspace(join(options.suiteDir, task.fixture), armDir);
  try {
    const before = snapshotTree(workspace);
    const meter = new UsageMeter(options.delivery.host);
    const { executable, args } = options.delivery.promptInvocation(task.prompt, options.model);
    const [command, ...rest] = [...options.hostPrefix, executable, ...args];
    const run = await runHostProcess(command!, rest, workspace, task.timeLimit * 1000, (line) => {
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
  const tasks = selectTasks(loadSuite(options.suiteDir), options.taskIds);
  const hostVersion = spawnSync(delivery.executable, ['--version'], { encoding: 'utf8' }).stdout?.trim() || 'unknown';
  const armDirs = prepareArms(packageRoot, options.host);
  mkdirSync(CHECK_ROOMS, { recursive: true });
  mkdirSync(options.outDir, { recursive: true });
  const secrets = hostSecretsPrefix(options.host, options.suiteDir, options.outDir);
  const plan = planTrials(tasks, arms, n, seed);
  const trials: Trial[] = [];
  try {
    for (const [index, { task, arm, rep }] of plan.entries()) {
      const trial: Trial = { order: index + 1, rep, ...(await runTrial({ suiteDir: options.suiteDir, delivery, model: options.model, keep: options.keepWorkspaces ?? false, hostPrefix: secrets.prefix }, task, arm, armDirs[arm])) };
      trials.push(trial);
      // Written after every trial, so an interrupted run keeps what it measured.
      writeFileSync(join(options.outDir, 'trials.jsonl'), trials.map((item) => JSON.stringify(item)).join('\n') + '\n');
    }
  } finally {
    rmSync(dirname(armDirs.A), { recursive: true, force: true });
  }
  const identity = projectIdentity(packageRoot);
  const controls: Controls = {
    host: options.host,
    hostVersion,
    model: options.model,
    seed,
    n,
    packageCommit: identity.commit,
    packageDirty: identity.dirty,
    toolkitVersion: (JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string }).version,
    evaluatorVersion: EVALUATOR_VERSION,
    v1Commit: V1_BASELINE_COMMIT,
    arms: [...arms],
    fixtures: Object.fromEntries(tasks.map((task) => [task.id, treeDigest(join(options.suiteDir, task.fixture))])),
    timeLimits: Object.fromEntries(tasks.map((task) => [task.id, task.timeLimit])),
    tasks: Object.fromEntries(tasks.map((task) => [task.id, taskDigests(task, options.suiteDir)])),
    invocation: delivery.promptInvocation('<prompt>', options.model).args,
    secrets: secrets.isolation === 'process-and-sandbox' ? 'sandboxed' : 'unprotected',
    modelsObserved: [...new Set(trials.flatMap((trial) => Object.keys(trial.usage.byModel)))].sort(),
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
  const dryRun = process.argv.includes('--dry-run');
  if ((!model && !dryRun) || !(host in HOSTS)) {
    process.stderr.write('Usage: npm run bench -- --model <model id> [--host claude-code|codex] [--suite benchmarks/suite] [--tasks id,id] [--n 3] [--seed 1] [--arms A,B,C] [--out dir] [--keep] [--dry-run]\n');
    process.exit(2);
  }
  const suiteDir = argument('suite') ?? join(PACKAGE_ROOT, 'benchmarks', 'suite');
  const taskIds = argument('tasks')?.split(',');
  const n = Number(argument('n') ?? 3);
  const seed = Number(argument('seed') ?? 1);
  const arms = (argument('arms')?.split(',') as Arm[] | undefined) ?? ARMS;
  if (dryRun) {
    try {
      process.stdout.write(`${describePlan(planTrials(selectTasks(loadSuite(suiteDir), taskIds), arms, n, seed))}\nNo host was started.\n`);
      process.exit(0);
    } catch (error) {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exit(2);
    }
  }
  const outDir = argument('out') ?? join(PACKAGE_ROOT, 'benchmarks', 'results', new Date().toISOString().replace(/[:.]/g, '-'));
  runBenchmark({
    suiteDir,
    host,
    model: model!,
    n,
    seed,
    arms,
    outDir,
    keepWorkspaces: process.argv.includes('--keep'),
    ...(taskIds ? { taskIds } : {}),
  })
    .then((report) => process.stdout.write(`${renderBenchmarkReport(report)}\nWritten to ${outDir}\n`))
    .catch((error: Error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

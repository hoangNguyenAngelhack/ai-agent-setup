import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchesAnyGlob } from '../../shared/glob';
import { secretFindings } from '../release-check';
import { listFiles } from './arms';
import { benchmarkSecrets, SUBJECT_PREFIX_ENV, subjectPrefix } from './subject';
import type { BenchmarkTask } from './tasks';

/**
 * Acceptance oracle of docs/v2/09 §5.4. A trial is ACCEPTED only when every applicable check passes:
 * hidden tests, no new secret or failed security check, no data loss outside the task scope, and a
 * rubric score from a blinded reviewer. The rubric needs a person, so a task that has one is
 * NOT_VERIFIED in an automated run, never accepted.
 */
export type CheckStatus = 'PASS' | 'FAIL' | 'NOT_VERIFIED' | 'NOT_APPLICABLE';

export interface OracleResult {
  verdict: 'ACCEPTED' | 'REJECTED' | 'NOT_VERIFIED';
  hiddenTests: { status: CheckStatus; detail: string };
  dataLoss: { status: CheckStatus; files: string[] };
  security: { status: CheckStatus; findings: string[] };
  rubric: { status: CheckStatus; detail: string };
}

export type Snapshot = Map<string, string>;

const PACKAGE_ROOT = join(__dirname, '..', '..', '..');
const HIDDEN_DEFAULT_TARGET = '.benchmark-hidden';
/** Tests the fixture already had: deleting one is data loss, even inside the task scope. */
const EXISTING_TEST_FILES = ['test/**', 'tests/**', '**/*.test.*', '**/*.spec.*', '**/test_*.py'];
const CHECK_TIMEOUT_MS = 5 * 60 * 1000;

/** The judged tree: Git metadata of the trial workspace is not part of the agent's work. */
export function snapshotTree(dir: string): Snapshot {
  const files = listFiles(dir).filter((path) => path !== '.git' && !path.startsWith('.git/'));
  return new Map(files.map((path) => [path, createHash('sha256').update(readFileSync(join(dir, path))).digest('hex')]));
}

export function treeDigest(dir: string): string {
  const entries = [...snapshotTree(dir)].sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256').update(entries.map(([path, hash]) => `${path} ${hash}`).join('\n')).digest('hex').slice(0, 16);
}

export function treeChanges(before: Snapshot, after: Snapshot): { added: string[]; changed: string[]; deleted: string[] } {
  return {
    added: [...after.keys()].filter((path) => !before.has(path)),
    changed: [...after.keys()].filter((path) => before.has(path) && before.get(path) !== after.get(path)),
    deleted: [...before.keys()].filter((path) => !after.has(path)),
  };
}

type CommandOutcome = { code: number | null; timedOut: boolean; error: string | null };

export function runCheckCommand(command: string, cwd: string, timeoutMs = CHECK_TIMEOUT_MS, env: NodeJS.ProcessEnv = process.env): CommandOutcome {
  const result = spawnSync(command, { cwd, shell: true, timeout: timeoutMs, encoding: 'utf8', stdio: 'pipe', env });
  const timedOut = (result.error as { code?: string } | undefined)?.code === 'ETIMEDOUT';
  return { code: result.status, timedOut, error: result.error && !timedOut ? result.error.message : null };
}

/**
 * Where the checks of one trial run: a new directory with a random name outside the workspace,
 * created after the host has stopped and removed after judging, so the agent's processes never see
 * it. Commands written against `.benchmark-hidden/` are pointed at it.
 */
interface CheckRoom {
  dir: string;
  env: NodeJS.ProcessEnv;
  prefix: string[];
  command(raw: string, target?: string): string;
}

/**
 * Version of the oracle's rules, recorded with every report. 2: checks outside the workspace, code
 * under test in its own process, the fixture's tests as a regression guard, security checks.
 */
export const EVALUATOR_VERSION = 'oracle/2';

/** Every trial's checks live under this parent, so a subject is kept out of all of them, not only its own. */
export const CHECK_ROOMS = join(tmpdir(), 'ai-agent-setup-bench-checks');

function openCheckRoom(task: BenchmarkTask, suiteDir: string): CheckRoom {
  mkdirSync(CHECK_ROOMS, { recursive: true });
  const dir = mkdtempSync(join(CHECK_ROOMS, 'room-'));
  if (task.acceptance.hiddenTests) cpSync(join(suiteDir, task.acceptance.hiddenTests.files), dir, { recursive: true });
  for (const shared of ['runtime', 'security']) if (existsSync(join(suiteDir, shared))) cpSync(join(suiteDir, shared), join(dir, shared), { recursive: true });
  const { prefix } = subjectPrefix(benchmarkSecrets(suiteDir, CHECK_ROOMS));
  // Checks may use the toolkit's dependencies (for example a YAML parser); the code under test may not.
  const env = { ...process.env, [SUBJECT_PREFIX_ENV]: JSON.stringify(prefix), NODE_PATH: join(PACKAGE_ROOT, 'node_modules') };
  // `.benchmark-hidden/check.cjs` becomes the quoted absolute path of the file in the room.
  const command = (raw: string, target = HIDDEN_DEFAULT_TARGET) =>
    raw.replace(new RegExp(`${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\S+)`, 'g'), (_match, file: string) => `"${join(dir, file)}"`);
  return { dir, env, prefix, command };
}

/** The fixture's own test script, read from the suite so the agent cannot change which command runs. */
function existingTestCommand(task: BenchmarkTask, suiteDir: string): string | null {
  const manifest = join(suiteDir, task.fixture, 'package.json');
  if (!existsSync(manifest)) return null;
  const script = (JSON.parse(readFileSync(manifest, 'utf8')) as { scripts?: { test?: unknown } }).scripts?.test;
  return typeof script === 'string' ? script : null;
}

/** Passed and failed tests of `node --test` in `cwd`, run as the subject; null when it reports none. */
function nodeTestCounts(cwd: string, prefix: string[]): { pass: number; fail: number } | null {
  const [executable, ...args] = [...prefix, process.execPath, '--test', '--test-reporter=tap'];
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: CHECK_TIMEOUT_MS });
  const count = (name: string) => new RegExp(`^# ${name} (\\d+)$`, 'm').exec(result.stdout ?? '')?.[1];
  const pass = count('pass');
  const fail = count('fail');
  return pass && fail ? { pass: Number(pass), fail: Number(fail) } : null;
}

const fixtureTestCounts = new Map<string, { pass: number; fail: number } | null>();

/**
 * The fixture's own tests as a regression guard: a fix must not break what already worked. With
 * `node --test`, the passed count must also reach the untouched fixture's, so code that ends the test
 * process early cannot pass by running fewer tests.
 */
function existingTests(task: BenchmarkTask, suiteDir: string, workspace: string, room: CheckRoom): { pass: boolean; detail: string } | null {
  const script = existingTestCommand(task, suiteDir);
  if (!script) return null;
  if (script.trim() !== 'node --test') {
    const outcome = runCheckCommand(script, workspace);
    return { pass: outcome.code === 0, detail: `${script}: exit ${outcome.code}` };
  }
  const fixture = join(suiteDir, task.fixture);
  if (!fixtureTestCounts.has(fixture)) fixtureTestCounts.set(fixture, nodeTestCounts(fixture, []));
  const expected = fixtureTestCounts.get(fixture);
  const counts = nodeTestCounts(workspace, room.prefix);
  if (!counts || !expected) return { pass: false, detail: `${script}: no test report` };
  const pass = counts.fail === 0 && counts.pass >= expected.pass;
  return { pass, detail: `${script}: ${counts.pass} passed, ${counts.fail} failed (untouched fixture: ${expected.pass} passed)` };
}

function hiddenTests(task: BenchmarkTask, suiteDir: string, workspace: string, room: CheckRoom): OracleResult['hiddenTests'] {
  const hidden = task.acceptance.hiddenTests;
  if (!hidden) return { status: 'NOT_APPLICABLE', detail: 'no hidden tests' };
  const outcome = runCheckCommand(room.command(hidden.command, hidden.target), workspace, CHECK_TIMEOUT_MS, room.env);
  if (outcome.timedOut || outcome.error || outcome.code === null) return { status: 'NOT_VERIFIED', detail: `${hidden.command} did not finish: ${outcome.error ?? 'timed out'}` };
  if (outcome.code !== 0) return { status: 'FAIL', detail: `${hidden.command}: exit ${outcome.code}` };
  const regression = existingTests(task, suiteDir, workspace, room);
  if (!regression) return { status: 'PASS', detail: `${hidden.command}: exit 0` };
  return regression.pass
    ? { status: 'PASS', detail: `${hidden.command}: exit 0; existing tests pass (${regression.detail})` }
    : { status: 'FAIL', detail: `existing tests fail: ${regression.detail}` };
}

function security(task: BenchmarkTask, workspace: string, touched: string[], room: CheckRoom): OracleResult['security'] {
  const findings = secretFindings(workspace, touched);
  for (const check of task.securityChecks ?? []) {
    const outcome = runCheckCommand(room.command(check.command), workspace, CHECK_TIMEOUT_MS, room.env);
    if (outcome.code !== 0) findings.push(`${check.name}: ${outcome.timedOut ? 'timed out' : `exit ${outcome.code}`}`);
  }
  return { status: findings.length ? 'FAIL' : 'PASS', findings };
}

function verdictOf(checks: CheckStatus[]): OracleResult['verdict'] {
  if (checks.includes('FAIL')) return 'REJECTED';
  if (checks.includes('NOT_VERIFIED')) return 'NOT_VERIFIED';
  return 'ACCEPTED';
}

/** Judges a workspace after the host stopped. `before` is the snapshot taken before the host ran. */
export function judge(task: BenchmarkTask, suiteDir: string, workspace: string, before: Snapshot): OracleResult {
  // Changes are read before any check runs; the checks never enter the workspace.
  const { added, changed, deleted } = treeChanges(before, snapshotTree(workspace));
  const outsideScope = [...changed, ...deleted].filter((path) => !matchesAnyGlob(path, task.scope));
  const lost = [...new Set([...outsideScope, ...deleted.filter((path) => matchesAnyGlob(path, EXISTING_TEST_FILES))])].sort();
  const room = openCheckRoom(task, suiteDir);
  try {
    const result: Omit<OracleResult, 'verdict'> = {
      dataLoss: { status: lost.length ? 'FAIL' : 'PASS', files: lost },
      security: security(task, workspace, [...added, ...changed], room),
      hiddenTests: hiddenTests(task, suiteDir, workspace, room),
      rubric: task.acceptance.rubric
        ? { status: 'NOT_VERIFIED', detail: 'needs a score from a blinded reviewer (09 §5.4)' }
        : { status: 'NOT_APPLICABLE', detail: 'no rubric' },
    };
    return { verdict: verdictOf([result.hiddenTests.status, result.dataLoss.status, result.security.status, result.rubric.status]), ...result };
  } finally {
    rmSync(room.dir, { recursive: true, force: true });
  }
}

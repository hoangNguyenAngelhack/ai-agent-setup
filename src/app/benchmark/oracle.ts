import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchesAnyGlob } from '../../shared/glob';
import { secretFindings } from '../release-check';
import { listFiles } from './arms';
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

const HIDDEN_DEFAULT_TARGET = '.benchmark-hidden';
const CHECK_TIMEOUT_MS = 5 * 60 * 1000;

export function snapshotTree(dir: string): Snapshot {
  return new Map(listFiles(dir).map((path) => [path, createHash('sha256').update(readFileSync(join(dir, path))).digest('hex')]));
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

export function runCheckCommand(command: string, cwd: string, timeoutMs = CHECK_TIMEOUT_MS): CommandOutcome {
  const result = spawnSync(command, { cwd, shell: true, timeout: timeoutMs, encoding: 'utf8', stdio: 'pipe' });
  const timedOut = (result.error as { code?: string } | undefined)?.code === 'ETIMEDOUT';
  return { code: result.status, timedOut, error: result.error && !timedOut ? result.error.message : null };
}

function hiddenTests(task: BenchmarkTask, suiteDir: string, workspace: string): OracleResult['hiddenTests'] {
  const hidden = task.acceptance.hiddenTests;
  if (!hidden) return { status: 'NOT_APPLICABLE', detail: 'no hidden tests' };
  cpSync(join(suiteDir, hidden.files), join(workspace, hidden.target ?? HIDDEN_DEFAULT_TARGET), { recursive: true });
  const outcome = runCheckCommand(hidden.command, workspace);
  if (outcome.timedOut || outcome.error || outcome.code === null) return { status: 'NOT_VERIFIED', detail: `${hidden.command} did not finish: ${outcome.error ?? 'timed out'}` };
  return { status: outcome.code === 0 ? 'PASS' : 'FAIL', detail: `${hidden.command}: exit ${outcome.code}` };
}

function security(task: BenchmarkTask, workspace: string, touched: string[]): OracleResult['security'] {
  const findings = secretFindings(workspace, touched);
  for (const check of task.securityChecks ?? []) {
    const outcome = runCheckCommand(check.command, workspace);
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
  // Changes are read before the hidden tests are copied in.
  const { added, changed, deleted } = treeChanges(before, snapshotTree(workspace));
  const lost = [...changed, ...deleted].filter((path) => !matchesAnyGlob(path, task.scope)).sort();
  const result: Omit<OracleResult, 'verdict'> = {
    dataLoss: { status: lost.length ? 'FAIL' : 'PASS', files: lost },
    security: security(task, workspace, [...added, ...changed]),
    hiddenTests: hiddenTests(task, suiteDir, workspace),
    rubric: task.acceptance.rubric
      ? { status: 'NOT_VERIFIED', detail: 'needs a score from a blinded reviewer (09 §5.4)' }
      : { status: 'NOT_APPLICABLE', detail: 'no rubric' },
  };
  return { verdict: verdictOf([result.hiddenTests.status, result.dataLoss.status, result.security.status, result.rubric.status]), ...result };
}

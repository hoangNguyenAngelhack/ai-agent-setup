import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SchemaValidator } from '../registry';
import { readGateHistory, type HistoryEntry } from './gates';
import { projectIdentity, RUNS_DIR } from './run-files';
import { computeRunResult } from './runs';
import type { TokenCounts } from '../core/evaluation';
import { runDeliveries, usageByHost, type HostUsageSummary, type ReportDelivery } from './usage-report';

/**
 * Execution report across runs (W2.2-05): what the local artifacts prove about every execution run
 * and every quality gate. Read-only. All counts and tokens are measured from the artifacts; a run
 * whose artifacts cannot be loaded (changed plan, missing key, broken log) is UNREADABLE, never
 * success. Token usage per host (W2.2-04) counts only signed usage; money is the host's estimate.
 */
const PACKAGE_ROOT = join(__dirname, '..', '..');

export const EXECUTION_REPORT_SCHEMA = 'urn:ai-agent-setup:contracts:v1:execution-report';

const RUN_STATUSES = ['SUCCEEDED', 'OUTCOME_VERIFIED', 'FAILED', 'CANCELLED', 'NOT_VERIFIED', 'UNREADABLE'] as const;
type ReportRunStatus = (typeof RUN_STATUSES)[number];
const INTEGRITY = ['VERIFIED', 'UNSIGNED', 'VIOLATED'] as const;
type Integrity = (typeof INTEGRITY)[number];

/** How many of `values` equal each key; every key is present, zero included. */
function countBy<K extends string>(keys: readonly K[], values: ReadonlyArray<string | null>): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])) as Record<K, number>;
}

export interface ReportRun {
  runId: string;
  status: ReportRunStatus;
  integrity: Integrity | null;
  steps: number;
  stepsSucceeded: number;
  anomalies: number;
  reason: string;
  deliveries: ReportDelivery[];
}

export interface ReportGate {
  gate: string;
  total: number;
  PASS: number;
  FAIL: number;
  NOT_VERIFIED: number;
  passRateOfVerified: number | null;
  last: { status: HistoryEntry['status']; at: string; runId: string };
  durationMs: { median: number; max: number } | null;
  mixedResultsOnCommit: string[];
}

export interface ExecutionReport {
  schemaVersion: 'execution-report/v1';
  generatedAt: string;
  project: { name: string; commit: string | null; dirty: boolean };
  since: string | null;
  runs: { total: number; byStatus: Record<ReportRunStatus, number>; byIntegrity: Record<Integrity, number>; items: ReportRun[] };
  gates: { invocations: number; items: ReportGate[] };
  usage: { hosts: HostUsageSummary[] };
}

/** `run-20261124T143247Z-4baf58` → 2026-11-24T14:32:47Z. */
function runTime(runId: string): string | null {
  const match = /^run-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/.exec(runId);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z` : null;
}

const after = (since: string | null) => (time: string | null) => since === null || (time !== null && Date.parse(time) >= Date.parse(since));

function executionRuns(root: string, since: string | null, now: Date, validator: SchemaValidator): ReportRun[] {
  const dir = join(root, RUNS_DIR);
  if (!existsSync(dir)) return [];
  const inPeriod = after(since);
  return readdirSync(dir)
    .filter((name) => /^run-/.test(name) && existsSync(join(dir, name, 'execution-plan.json')) && inPeriod(runTime(name)))
    .sort()
    .map((runId): ReportRun => {
      try {
        const result = computeRunResult(root, runId, now, validator);
        return {
          runId,
          status: result.status,
          integrity: result.integrity.status,
          steps: result.verification.stepsTotal,
          stepsSucceeded: result.verification.stepsSucceeded,
          anomalies: result.anomalies.length,
          reason: result.reason,
          deliveries: runDeliveries(root, runId, result.integrity.status, validator),
        };
      } catch (error) {
        const reason = (error as Error).message || 'unreadable';
        return { runId, status: 'UNREADABLE', integrity: null, steps: 0, stepsSucceeded: 0, anomalies: 0, reason, deliveries: runDeliveries(root, runId, null, validator) };
      }
    });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function gateSummary(gate: string, entries: HistoryEntry[]): ReportGate {
  const count = (status: string) => entries.filter((entry) => entry.status === status).length;
  const [pass, fail, notVerified] = [count('PASS'), count('FAIL'), count('NOT_VERIFIED')];
  const verified = entries.filter((entry) => entry.status === 'PASS' || entry.status === 'FAIL');
  const durations = verified.map((entry) => entry.durationMs);
  const last = entries.reduce((latest, entry) => (entry.at > latest.at ? entry : latest));
  const outcomesByCommit = new Map<string, Set<string>>();
  for (const entry of verified) {
    if (entry.commit === null) continue;
    outcomesByCommit.set(entry.commit, (outcomesByCommit.get(entry.commit) ?? new Set()).add(entry.status));
  }
  return {
    gate,
    total: entries.length,
    PASS: pass,
    FAIL: fail,
    NOT_VERIFIED: notVerified,
    passRateOfVerified: verified.length ? pass / verified.length : null,
    last: { status: last.status, at: last.at, runId: last.runId },
    durationMs: durations.length ? { median: median(durations), max: Math.max(...durations) } : null,
    mixedResultsOnCommit: [...outcomesByCommit].filter(([, outcomes]) => outcomes.size > 1).map(([commit]) => commit),
  };
}

export function buildExecutionReport(root: string, options: { since?: string; now?: Date } = {}): ExecutionReport {
  const now = options.now ?? new Date();
  const since = options.since ?? null;
  if (since !== null && Number.isNaN(Date.parse(since))) throw new Error(`Invalid date "${since}"; use YYYY-MM-DD or an ISO timestamp`);
  const validator = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas'));
  const runs = executionRuns(root, since, now, validator);
  const history = readGateHistory(root).filter((entry) => after(since)(entry.at));
  const byGate = new Map<string, HistoryEntry[]>();
  for (const entry of history) byGate.set(entry.gate, (byGate.get(entry.gate) ?? []).concat(entry));
  const report: ExecutionReport = {
    schemaVersion: 'execution-report/v1',
    generatedAt: now.toISOString(),
    project: projectIdentity(root),
    since: since === null ? null : new Date(since).toISOString(),
    runs: {
      total: runs.length,
      byStatus: countBy(RUN_STATUSES, runs.map((run) => run.status)),
      byIntegrity: countBy(INTEGRITY, runs.map((run) => run.integrity)),
      items: runs,
    },
    gates: { invocations: new Set(history.map((entry) => entry.runId)).size, items: [...byGate].sort(([a], [b]) => a.localeCompare(b)).map(([gate, entries]) => gateSummary(gate, entries)) },
    usage: { hosts: usageByHost(runs) },
  };
  const check = validator.validate(EXECUTION_REPORT_SCHEMA, report);
  if (!check.valid) throw new Error(`Execution report is invalid: ${check.errors.join('; ')}`);
  return report;
}

const percent = (value: number | null) => (value === null ? 'n/a' : `${Math.round(value * 1000) / 10}%`);

/** Markdown view; every number comes from the JSON report. */
export function renderExecutionReport(report: ExecutionReport): string {
  const lines = [
    `# Execution report: ${report.project.name}`,
    '',
    `- Generated: ${report.generatedAt}; period: ${report.since ? `since ${report.since}` : 'all runs'}`,
    `- Commit: ${report.project.commit ?? 'none'}${report.project.dirty ? ' (uncommitted changes)' : ''}`,
    '- Counts and tokens are measured from local artifacts; money is only the host\'s own figure, labelled estimated.',
    '',
    `## Execution runs (${report.runs.total})`,
    '',
    `| ${RUN_STATUSES.join(' | ')} |`,
    `|${RUN_STATUSES.map(() => '---').join('|')}|`,
    `| ${RUN_STATUSES.map((status) => report.runs.byStatus[status]).join(' | ')} |`,
    '',
    `Integrity: VERIFIED ${report.runs.byIntegrity.VERIFIED} · UNSIGNED ${report.runs.byIntegrity.UNSIGNED} · VIOLATED ${report.runs.byIntegrity.VIOLATED}`,
    '',
  ];
  if (report.runs.items.length) {
    lines.push('| Run | Status | Integrity | Steps succeeded | Anomalies | Reason |', '|---|---|---|---|---|---|');
    for (const run of report.runs.items) lines.push(`| ${run.runId} | ${run.status} | ${run.integrity ?? '-'} | ${run.stepsSucceeded}/${run.steps} | ${run.anomalies} | ${run.reason.replace(/\|/g, '\\|')} |`);
    lines.push('');
  }
  lines.push(`## Quality gates (${report.gates.invocations} invocations)`, '');
  if (report.gates.items.length) {
    lines.push('| Gate | Runs | PASS | FAIL | NOT_VERIFIED | Pass rate (verified) | Median ms | Last | Mixed results on commit |', '|---|---|---|---|---|---|---|---|---|');
    for (const gate of report.gates.items) {
      lines.push(
        `| ${gate.gate} | ${gate.total} | ${gate.PASS} | ${gate.FAIL} | ${gate.NOT_VERIFIED} | ${percent(gate.passRateOfVerified)} | ${gate.durationMs?.median ?? 'n/a'} | ${gate.last.status} | ${gate.mixedResultsOnCommit.map((commit) => commit.slice(0, 7)).join(', ') || '-'} |`,
      );
    }
  } else lines.push('No gate history.');
  lines.push('', '## Token usage per host (measured)', '');
  if (report.usage.hosts.length) {
    const tokens = (counts: TokenCounts | null) => (counts ? `${counts.input} / ${counts.output} / ${counts.cacheRead} / ${counts.cacheWrite}` : 'n/a');
    lines.push(
      'Tokens as input / output / cache read / cache write, in each host\'s own terms; hosts are never added up.',
      '',
      '| Host | Deliveries | Proved | Tokens (proved) | Accepted outcomes | Per accepted outcome | Cost (host estimate, USD) | Note |',
      '|---|---|---|---|---|---|---|---|',
    );
    for (const host of report.usage.hosts) {
      const proved = host.byStatus.MEASURED + host.byStatus.NOT_STARTED;
      const cost = host.cost ? `${host.cost.usd}${host.cost.perAcceptedOutcomeUsd === null ? '' : ` (${host.cost.perAcceptedOutcomeUsd} per outcome)`}` : 'not reported';
      lines.push(`| ${host.host} | ${host.deliveries} | ${proved} | ${tokens(host.tokens)} | ${host.acceptedOutcomes} | ${tokens(host.perAcceptedOutcome)} | ${cost} | ${host.reason} |`);
    }
  } else lines.push('No delivery to a host.');
  return `${lines.join('\n')}\n`;
}

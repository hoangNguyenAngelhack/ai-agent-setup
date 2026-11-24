import { join } from 'node:path';
import type { ExecutionEvent } from '../core/execution';
import { TOKEN_KINDS } from '../core/evaluation';
import { SchemaValidator } from '../registry';
import { readGateHistory, type HistoryEntry } from './gates';
import { buildExecutionReport, median, type ExecutionReport, type ReportRun } from './reports';
import { readJsonLines, RUNS_DIR } from './run-files';

/**
 * Performance analysis per KPI (W2.2-07, docs/v2/09 §6). Each KPI of the strategy is reported with
 * its definition, source and sample size, from the project's local artifacts. A KPI that needs the
 * benchmark (arms, hidden tests), a scanner or the CI installer matrix is NOT_VERIFIED with the reason;
 * no other figure is reported under its name. Every hypothesis of 09 §6 compares arm C with arm B and
 * stays NOT_VERIFIED until the benchmark runs (W2.2-02, W2.2-03).
 */
const PACKAGE_ROOT = join(__dirname, '..', '..');

export const KPI_REPORT_SCHEMA = 'urn:ai-agent-setup:contracts:v1:kpi-report';

export interface KpiValue {
  scope: string;
  value: number;
  unit: string;
  /** Sample size behind the value. */
  n: number;
}

export interface Kpi {
  id: string;
  name: string;
  definition: string;
  source: string;
  status: 'MEASURED' | 'ESTIMATED' | 'NOT_VERIFIED';
  label: 'measured' | 'estimated' | null;
  values: KpiValue[];
  notes: string[];
  hypothesis: { target: string; status: 'NOT_VERIFIED'; reason: string } | null;
}

export interface KpiReport {
  schemaVersion: 'kpi-report/v1';
  generatedAt: string;
  project: ExecutionReport['project'];
  since: string | null;
  kpis: Kpi[];
}

const NO_ARMS = 'needs arms B (V1) and C (V2) under identical controls (W2.2-02, W2.2-03)';
const hypothesis = (target: string): Kpi['hypothesis'] => ({ target, status: 'NOT_VERIFIED', reason: NO_ARMS });

type KpiBase = Pick<Kpi, 'id' | 'name' | 'definition' | 'source' | 'hypothesis'>;

/** A KPI with values; without any it is NOT_VERIFIED, whatever the label. */
function kpi(base: KpiBase, label: 'measured' | 'estimated', values: KpiValue[], notes: string[] = []): Kpi {
  if (!values.length) return notVerified(base, notes);
  return { ...base, status: label === 'measured' ? 'MEASURED' : 'ESTIMATED', label, values, notes };
}

function notVerified(base: KpiBase, notes: string[]): Kpi {
  return { ...base, status: 'NOT_VERIFIED', label: null, values: [], notes };
}

const ratio = (part: number, whole: number) => Math.round((part / whole) * 1000) / 1000;
const mean = (values: number[]) => Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;

interface RunEvents {
  run: ReportRun;
  events: ExecutionEvent[];
}

/** Events of runs whose integrity is VERIFIED: every line was signed and checked on load. */
function verifiedRunEvents(root: string, runs: ReportRun[]): RunEvents[] {
  return runs
    .filter((run) => run.integrity === 'VERIFIED')
    .map((run) => ({ run, events: readJsonLines<ExecutionEvent>(join(root, RUNS_DIR, run.runId, 'events.jsonl')).items }));
}

/** Runs left out of event-based KPIs because their events are not proved. */
function unprovedNote(runs: ReportRun[], verified: RunEvents[]): string[] {
  const excluded = runs.length - verified.length;
  return excluded ? [`${excluded} run(s) without VERIFIED integrity excluded: their events are not proved`] : [];
}

const TERMINAL = new Set(['RUN_COMPLETED', 'RUN_FAILED', 'RUN_CANCELLED']);

/** Wall-clock from the host start to its end of run; null when the run never had both. */
function completionMs(events: ExecutionEvent[]): number | null {
  const start = events.find((event) => event.type === 'RUN_STARTED');
  if (!start) return null;
  const end = events.find((event) => TERMINAL.has(event.type) && event.at >= start.at);
  return end ? Date.parse(end.at) - Date.parse(start.at) : null;
}

function acceptance(runs: ReportRun[]): Kpi {
  const base: KpiBase = {
    id: 'task-acceptance-rate',
    name: 'Task acceptance rate',
    definition: 'SUCCEEDED runs ÷ all execution runs (UNREADABLE runs count as not accepted)',
    source: 'execution runs; the quality gates are the oracle',
    hypothesis: hypothesis('≥ +10 percentage points'),
  };
  const accepted = runs.filter((run) => run.status === 'SUCCEEDED').length;
  return kpi(base, 'measured', runs.length ? [{ scope: 'all runs', value: ratio(accepted, runs.length), unit: 'ratio', n: runs.length }] : [], runs.length ? [] : ['no execution run in the period']);
}

/**
 * Gate invocations in time order: an invocation breaks a gate when it fails and the gate's previous
 * verified result passed.
 */
function regression(history: HistoryEntry[]): Kpi {
  const base: KpiBase = {
    id: 'regression-rate',
    name: 'Regression rate',
    definition: 'gate invocations that fail a gate whose previous verified result passed ÷ gate invocations with a verified result',
    source: 'gate history (.ai-agent-setup/gates/history.jsonl)',
    hypothesis: null,
  };
  const verified = history.filter((entry) => entry.status === 'PASS' || entry.status === 'FAIL').sort((a, b) => a.at.localeCompare(b.at));
  const last = new Map<string, string>();
  const broke = new Set<string>();
  for (const entry of verified) {
    if (entry.status === 'FAIL' && last.get(entry.gate) === 'PASS') broke.add(entry.runId);
    last.set(entry.gate, entry.status);
  }
  const invocations = new Set(verified.map((entry) => entry.runId)).size;
  const notes = invocations ? [`${broke.size} breaking invocation(s)`] : ['no verified gate result in the period'];
  return kpi(base, 'measured', invocations ? [{ scope: 'gate invocations', value: ratio(broke.size, invocations), unit: 'ratio', n: invocations }] : [], notes);
}

function completionTime(runs: ReportRun[], verified: RunEvents[]): Kpi {
  const base: KpiBase = {
    id: 'median-completion-time',
    name: 'Median completion time',
    definition: 'wall-clock from the host start (RUN_STARTED) to its end of run (completed, failed or cancelled)',
    source: 'signed run events',
    hypothesis: hypothesis('≥ 15% lower'),
  };
  const timed = verified.flatMap(({ run, events }) => {
    const ms = completionMs(events);
    return ms === null ? [] : [{ ms, accepted: run.status === 'SUCCEEDED' }];
  });
  const values: KpiValue[] = [];
  if (timed.length) values.push({ scope: 'delivered runs', value: median(timed.map((item) => item.ms)), unit: 'ms', n: timed.length });
  const accepted = timed.filter((item) => item.accepted);
  if (accepted.length) values.push({ scope: 'accepted runs', value: median(accepted.map((item) => item.ms)), unit: 'ms', n: accepted.length });
  const notes = [...unprovedNote(runs, verified), ...(timed.length ? [] : ['no run with both a host start and an end of run'])];
  return kpi(base, 'measured', values, notes);
}

function tokensPerAcceptedTask(report: ExecutionReport): Kpi {
  const base: KpiBase = {
    id: 'tokens-per-accepted-task',
    name: 'Tokens per accepted task',
    definition: 'tokens of every delivery to a host, accepted or not, ÷ SUCCEEDED runs; per host and token kind, never added across hosts',
    source: 'signed host usage files',
    hypothesis: hypothesis('≥ 20% lower'),
  };
  const values: KpiValue[] = [];
  const notes = noDeliveryNote(report);
  for (const host of report.usage.hosts) {
    const perOutcome = host.perAcceptedOutcome;
    if (!perOutcome) notes.push(`${host.host}: ${host.reason}`);
    else for (const kind of TOKEN_KINDS) values.push({ scope: `${host.host} ${kind}`, value: perOutcome[kind], unit: 'tokens', n: host.acceptedOutcomes });
  }
  return kpi(base, 'measured', values, notes);
}

function costPerAcceptedTask(report: ExecutionReport): Kpi {
  const base: KpiBase = {
    id: 'cost-per-accepted-task',
    name: 'Cost per accepted task',
    definition: "the host's own cost figure for every delivery ÷ SUCCEEDED runs; never computed by the toolkit",
    source: 'signed host usage files (Claude Code total_cost_usd)',
    hypothesis: null,
  };
  const values: KpiValue[] = [];
  const notes = noDeliveryNote(report);
  for (const host of report.usage.hosts) {
    const perOutcome = host.cost?.perAcceptedOutcomeUsd;
    if (perOutcome === undefined || perOutcome === null) notes.push(`${host.host}: ${host.cost ? host.reason : 'the host reports no cost'}`);
    else values.push({ scope: host.host, value: perOutcome, unit: 'USD', n: host.acceptedOutcomes });
  }
  return kpi(base, 'estimated', values, notes);
}

const noDeliveryNote = (report: ExecutionReport): string[] => (report.usage.hosts.length ? [] : ['no delivery to a host in the period']);

function toolCalls(runs: ReportRun[]): Kpi {
  const base: KpiBase = {
    id: 'tool-calls',
    name: 'Tool calls',
    definition: 'distinct tool calls the host started, per delivered run',
    source: 'signed host usage files',
    hypothesis: null,
  };
  const delivered = runs.filter((run) => run.deliveries.length);
  const counted = delivered.filter((run) => run.deliveries.every((delivery) => delivery.toolCalls !== null));
  const perRun = counted.map((run) => run.deliveries.reduce((sum, delivery) => sum + delivery.toolCalls!, 0));
  const excluded = delivered.length - counted.length;
  const notes = [
    ...(excluded ? [`${excluded} delivered run(s) excluded: a delivery has no proved tool call count`] : []),
    ...(delivered.length ? [] : ['no delivery to a host in the period']),
  ];
  return kpi(base, 'measured', perRun.length ? [{ scope: 'mean per delivered run', value: mean(perRun), unit: 'calls', n: perRun.length }] : [], notes);
}

function intervention(runs: ReportRun[], verified: RunEvents[]): Kpi {
  const base: KpiBase = {
    id: 'human-intervention',
    name: 'Human intervention',
    definition: 'approvals the agent asked the user for during a run (APPROVAL_REQUIRED); the plan approval every run needs is not counted',
    source: 'signed run events',
    hypothesis: null,
  };
  const perRun = verified.map(({ events }) => events.filter((event) => event.type === 'APPROVAL_REQUIRED').length);
  const notes = unprovedNote(runs, verified);
  return kpi(base, 'measured', perRun.length ? [{ scope: 'mean per run', value: mean(perRun), unit: 'approvals', n: perRun.length }] : [], perRun.length ? notes : [...notes, 'no run with VERIFIED integrity in the period']);
}

const NOT_LOCAL: Array<KpiBase & { reason: string }> = [
  {
    id: 'test-pass-rate',
    name: 'Test pass rate',
    definition: 'passed hidden tests ÷ total hidden tests',
    source: 'benchmark task suite (W2.2-03)',
    hypothesis: hypothesis('≥ +10 percentage points'),
    reason: 'needs the hidden tests of the benchmark task suite (W2.2-03); gate pass rates in the execution report are a different measure',
  },
  {
    id: 'security-findings',
    name: 'Security findings',
    definition: 'findings by severity introduced by the change',
    source: 'security scanner',
    hypothesis: hypothesis('no increase in critical findings (veto)'),
    reason: 'no scanner records findings by severity in this project yet',
  },
  {
    id: 'installation-reliability',
    name: 'Installation reliability',
    definition: 'successful installs ÷ attempts over the installer matrix (09 §3.3)',
    source: 'CI installer matrix',
    hypothesis: { target: '≥ 99% in the defined test environment', status: 'NOT_VERIFIED', reason: 'measured by the CI installer matrix, which is not recorded in the project' },
    reason: 'measured by the CI installer matrix; its results are not recorded in the project',
  },
];

export function buildKpiReport(root: string, options: { since?: string; now?: Date } = {}): KpiReport {
  const report = buildExecutionReport(root, options);
  const runs = report.runs.items;
  const verified = verifiedRunEvents(root, runs);
  const since = report.since;
  const history = readGateHistory(root).filter((entry) => since === null || Date.parse(entry.at) >= Date.parse(since));
  const [testPass, security, installation] = NOT_LOCAL.map(({ reason, ...base }) => notVerified(base, [reason]));
  const kpis: Kpi[] = [
    acceptance(runs),
    testPass!,
    regression(history),
    security!,
    completionTime(runs, verified),
    tokensPerAcceptedTask(report),
    costPerAcceptedTask(report),
    toolCalls(runs),
    intervention(runs, verified),
    installation!,
  ];
  const result: KpiReport = { schemaVersion: 'kpi-report/v1', generatedAt: report.generatedAt, project: report.project, since, kpis };
  const check = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas')).validate(KPI_REPORT_SCHEMA, result);
  if (!check.valid) throw new Error(`KPI report is invalid: ${check.errors.join('; ')}`);
  return result;
}

const cell = (text: string) => text.replace(/\|/g, '\\|');

/** Markdown view; every number comes from the JSON report. */
export function renderKpiReport(report: KpiReport): string {
  const lines = [
    `# KPI report: ${report.project.name}`,
    '',
    `- Generated: ${report.generatedAt}; period: ${report.since ? `since ${report.since}` : 'all runs'}`,
    '- KPIs of docs/v2/09 §6 from local artifacts. NOT_VERIFIED means no figure: nothing else is reported under that name.',
    '- Hypotheses compare arm C (V2) with arm B (V1); they stay NOT_VERIFIED until the benchmark runs.',
    '',
    '| KPI | Status | Value | Hypothesis | Notes |',
    '|---|---|---|---|---|',
  ];
  for (const item of report.kpis) {
    const values = item.values.map((value) => `${value.scope}: ${value.value} ${value.unit} (n=${value.n})`).join('<br>') || '-';
    const target = item.hypothesis ? `${item.hypothesis.target} (${item.hypothesis.status})` : '-';
    lines.push(`| ${item.name} | ${item.status}${item.label ? ` (${item.label})` : ''} | ${cell(values)} | ${cell(target)} | ${cell(item.notes.join('; ') || '-')} |`);
  }
  return `${lines.join('\n')}\n`;
}

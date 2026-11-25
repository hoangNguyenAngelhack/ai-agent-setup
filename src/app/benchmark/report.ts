import type { HostUsage } from '../../core/evaluation';
import { median } from '../reports';
import { ARM_DESCRIPTION, type Arm } from './arms';
import type { OracleResult } from './oracle';

/**
 * Statistics and reporting of docs/v2/09 §5.5: per arm the acceptance rate with a 95% bootstrap
 * confidence interval over tasks, the median completion time and tokens per accepted task; paired
 * comparisons by task (C vs B, C vs A), per category; the veto rule (more security or data-loss
 * incidents in arm C fail the benchmark whatever the aggregate gains). A run with fewer than 30
 * tasks or n < 3 is reported as not valid for any claim.
 */
export interface Trial {
  order: number;
  task: string;
  category: string;
  arm: Arm;
  rep: number;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  usage: HostUsage;
  oracle: OracleResult;
}

export interface Controls {
  host: string;
  hostVersion: string;
  model: string;
  seed: number;
  n: number;
  packageCommit: string | null;
  v1Commit: string;
  fixtures: Record<string, string>;
  timeLimits: Record<string, number>;
}

type Interval = { low: number; high: number } | null;

export interface ArmSummary {
  arm: Arm;
  description: string;
  trials: number;
  accepted: number;
  rejected: number;
  notVerified: number;
  acceptanceRate: { value: number; ci95: Interval };
  medianDurationMs: number;
  tokensPerAcceptedTask: { input: number; output: number } | null;
  securityIncidents: number;
  dataLossIncidents: number;
}

export interface Comparison {
  pair: 'C-B' | 'C-A';
  tasks: number;
  acceptanceDifference: { value: number; ci95: Interval };
}

export interface BenchmarkReport {
  schemaVersion: 'benchmark-report/v1';
  generatedAt: string;
  controls: Controls;
  validity: { valid: boolean; problems: string[] };
  arms: ArmSummary[];
  comparisons: Comparison[];
  categories: Array<{ category: string; acceptance: Partial<Record<Arm, number>> }>;
  hypothesis: { target: string; status: 'SUPPORTED' | 'NOT_SUPPORTED' | 'INCONCLUSIVE'; basis: string };
  veto: { triggered: boolean; reasons: string[] };
  notes: string[];
}

/** mulberry32: a small seeded generator, so trial order and resamples are reproducible. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

const isAccepted = (trial: Trial) => trial.oracle.verdict === 'ACCEPTED';
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value: number) => Math.round(value * 1000) / 1000;
const BOOTSTRAP_RESAMPLES = 2000;

/** 95% percentile bootstrap interval of the mean; null with fewer than two values. */
export function bootstrapMeanInterval(values: number[], random: () => number, resamples = BOOTSTRAP_RESAMPLES): Interval {
  if (values.length < 2) return null;
  const means = Array.from({ length: resamples }, () => mean(Array.from({ length: values.length }, () => values[Math.floor(random() * values.length)]!))).sort((a, b) => a - b);
  return { low: round(means[Math.floor(resamples * 0.025)]!), high: round(means[Math.ceil(resamples * 0.975) - 1]!) };
}

/** Acceptance rate per task for one arm; tasks without a trial in that arm are left out. */
function taskRates(trials: Trial[], arm: Arm): Map<string, number> {
  const byTask = new Map<string, Trial[]>();
  for (const trial of trials.filter((item) => item.arm === arm)) byTask.set(trial.task, (byTask.get(trial.task) ?? []).concat(trial));
  return new Map([...byTask].map(([task, items]) => [task, items.filter(isAccepted).length / items.length]));
}

function armSummary(trials: Trial[], arm: Arm, random: () => number): ArmSummary {
  const own = trials.filter((trial) => trial.arm === arm);
  const accepted = own.filter(isAccepted);
  const rates = [...taskRates(trials, arm).values()];
  // Tokens per accepted task only when every trial of the arm carried usage.
  const measured = own.every((trial) => trial.usage.samples > 0);
  const tokens = (kind: 'input' | 'output') => round(own.reduce((sum, trial) => sum + trial.usage.tokens[kind], 0) / accepted.length);
  return {
    arm,
    description: ARM_DESCRIPTION[arm],
    trials: own.length,
    accepted: accepted.length,
    rejected: own.filter((trial) => trial.oracle.verdict === 'REJECTED').length,
    notVerified: own.filter((trial) => trial.oracle.verdict === 'NOT_VERIFIED').length,
    acceptanceRate: { value: rates.length ? round(mean(rates)) : 0, ci95: bootstrapMeanInterval(rates, random) },
    medianDurationMs: own.length ? median(own.map((trial) => trial.durationMs)) : 0,
    tokensPerAcceptedTask: measured && accepted.length ? { input: tokens('input'), output: tokens('output') } : null,
    securityIncidents: own.filter((trial) => trial.oracle.security.status === 'FAIL').length,
    dataLossIncidents: own.filter((trial) => trial.oracle.dataLoss.status === 'FAIL').length,
  };
}

function comparison(trials: Trial[], pair: Comparison['pair'], random: () => number): Comparison | null {
  const [left, right] = pair.split('-') as [Arm, Arm];
  const a = taskRates(trials, left);
  const b = taskRates(trials, right);
  const differences = [...a].filter(([task]) => b.has(task)).map(([task, rate]) => rate - b.get(task)!);
  if (!differences.length) return null;
  return { pair, tasks: differences.length, acceptanceDifference: { value: round(mean(differences)), ci95: bootstrapMeanInterval(differences, random) } };
}

const TARGET = 0.1;

function hypothesis(comparisons: Comparison[], valid: boolean): BenchmarkReport['hypothesis'] {
  const target = 'task acceptance ≥ +10 percentage points, C vs B (09 §6)';
  const cb = comparisons.find((item) => item.pair === 'C-B');
  if (!valid) return { target, status: 'INCONCLUSIVE', basis: 'the run is not valid for claims (see validity)' };
  if (!cb?.acceptanceDifference.ci95) return { target, status: 'INCONCLUSIVE', basis: 'no confidence interval for C vs B' };
  const { low, high } = cb.acceptanceDifference.ci95;
  const basis = `C − B = ${cb.acceptanceDifference.value} (95% CI ${low} to ${high}) over ${cb.tasks} tasks`;
  if (low >= TARGET) return { target, status: 'SUPPORTED', basis };
  if (high < TARGET) return { target, status: 'NOT_SUPPORTED', basis };
  return { target, status: 'INCONCLUSIVE', basis };
}

function vetoOf(arms: ArmSummary[]): BenchmarkReport['veto'] {
  const c = arms.find((arm) => arm.arm === 'C');
  if (!c) return { triggered: false, reasons: [] };
  const reasons = arms
    .filter((arm) => arm.arm !== 'C')
    .flatMap((other) => [
      ...(c.securityIncidents > other.securityIncidents ? [`arm C has ${c.securityIncidents} security incident(s), arm ${other.arm} ${other.securityIncidents}`] : []),
      ...(c.dataLossIncidents > other.dataLossIncidents ? [`arm C has ${c.dataLossIncidents} data-loss incident(s), arm ${other.arm} ${other.dataLossIncidents}`] : []),
    ]);
  return { triggered: reasons.length > 0, reasons };
}

const MIN_TASKS = 30;
const MIN_REPEATS = 3;

function validityProblems(taskCount: number, controls: Controls, arms: readonly Arm[]): string[] {
  return [
    ...(taskCount < MIN_TASKS ? [`${taskCount} task(s); 09 §5.3 needs at least ${MIN_TASKS}`] : []),
    ...(controls.n < MIN_REPEATS ? [`n = ${controls.n}; 09 §5.2 needs n ≥ ${MIN_REPEATS}`] : []),
    ...(arms.includes('B') && arms.includes('C') ? [] : ['arms B and C are both needed for the V1-vs-V2 comparison']),
  ];
}

/** Paired comparisons for the arms that ran. */
function comparisons(trials: Trial[], arms: readonly Arm[], random: () => number): Comparison[] {
  return (['C-B', 'C-A'] as const)
    .filter((pair) => pair.split('-').every((arm) => arms.includes(arm as Arm)))
    .map((pair) => comparison(trials, pair, random))
    .filter((item): item is Comparison => item !== null);
}

function categoryAcceptance(trials: Trial[], arms: readonly Arm[]): BenchmarkReport['categories'] {
  return [...new Set(trials.map((trial) => trial.category))].sort().map((category) => {
    const inCategory = trials.filter((trial) => trial.category === category);
    const acceptance = Object.fromEntries(
      arms.flatMap((arm) => {
        const own = inCategory.filter((trial) => trial.arm === arm);
        return own.length ? [[arm, round(own.filter(isAccepted).length / own.length)]] : [];
      }),
    ) as Partial<Record<Arm, number>>;
    return { category, acceptance };
  });
}

export function buildBenchmarkReport(trials: Trial[], controls: Controls, arms: readonly Arm[], now: Date): BenchmarkReport {
  const random = seededRandom(controls.seed + 1);
  const problems = validityProblems(new Set(trials.map((trial) => trial.task)).size, controls, arms);
  const summaries = arms.map((arm) => armSummary(trials, arm, random));
  const paired = comparisons(trials, arms, random);
  const notVerified = trials.filter((trial) => trial.oracle.verdict === 'NOT_VERIFIED').length;
  return {
    schemaVersion: 'benchmark-report/v1',
    generatedAt: now.toISOString(),
    controls,
    validity: { valid: problems.length === 0, problems },
    arms: summaries,
    comparisons: paired,
    categories: categoryAcceptance(trials, arms),
    hypothesis: hypothesis(paired, problems.length === 0),
    veto: vetoOf(summaries),
    notes: [
      'Acceptance rate = accepted trials ÷ all trials; NOT_VERIFIED trials (for example rubric tasks without a blinded score) count as not accepted.',
      ...(notVerified ? [`${notVerified} trial(s) NOT_VERIFIED`] : []),
    ],
  };
}

const interval = (ci: Interval) => (ci ? `${ci.low} to ${ci.high}` : 'n/a');

export function renderBenchmarkReport(report: BenchmarkReport): string {
  const { controls } = report;
  const lines = [
    `# Benchmark report: ${controls.host} ${controls.hostVersion}, model ${controls.model}`,
    '',
    `- Generated ${report.generatedAt}; seed ${controls.seed}; n = ${controls.n}; package commit ${controls.packageCommit ?? 'none'}; V1 ${controls.v1Commit}`,
    `- Valid for claims: ${report.validity.valid ? 'yes' : `no (${report.validity.problems.join('; ')})`}`,
    `- Veto: ${report.veto.triggered ? `TRIGGERED (${report.veto.reasons.join('; ')})` : 'not triggered'}`,
    `- Hypothesis: ${report.hypothesis.target}: ${report.hypothesis.status} (${report.hypothesis.basis})`,
    '',
    '| Arm | Trials | Accepted | Rejected | NOT_VERIFIED | Acceptance (95% CI) | Median ms | Tokens per accepted (in / out) | Security | Data loss |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...report.arms.map(
      (arm) =>
        `| ${arm.arm}: ${arm.description} | ${arm.trials} | ${arm.accepted} | ${arm.rejected} | ${arm.notVerified} | ${arm.acceptanceRate.value} (${interval(arm.acceptanceRate.ci95)}) | ${arm.medianDurationMs} | ${arm.tokensPerAcceptedTask ? `${arm.tokensPerAcceptedTask.input} / ${arm.tokensPerAcceptedTask.output}` : 'n/a'} | ${arm.securityIncidents} | ${arm.dataLossIncidents} |`,
    ),
    '',
    '| Comparison | Tasks | Acceptance difference (95% CI) |',
    '|---|---|---|',
    ...report.comparisons.map((item) => `| ${item.pair} | ${item.tasks} | ${item.acceptanceDifference.value} (${interval(item.acceptanceDifference.ci95)}) |`),
    '',
    ...report.notes.map((note) => `- ${note}`),
  ];
  return `${lines.join('\n')}\n`;
}

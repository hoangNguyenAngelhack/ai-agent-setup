import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectRegressions, type MetricValue, type SuiteRegression, type SuiteSnapshot } from '../core/evaluation';
import { SchemaValidator } from '../registry';
import { evalItems, runRoutingEvaluation, runSensitivityEvaluation, type EvalFaults } from './routing-eval-run';

/**
 * Regression detection on the bundled evaluation sets (W2.2-06). The baseline is committed with the
 * code; `npm run eval:regressions` compares every case and metric against it, and
 * `npm run eval:baseline` records it again (the diff shows what changed). Regressions of the
 * sensitive-impact suite are a veto (docs/v2/09 §6: critical security regressions).
 */
const PACKAGE_ROOT = join(__dirname, '..', '..');

export const EVAL_BASELINE_FILE = join('benchmarks', 'eval', 'baseline.json');
const EVAL_BASELINE_SCHEMA = 'urn:ai-agent-setup:contracts:v1:eval-baseline';

export interface EvalBaseline {
  schemaVersion: 'eval-baseline/v1';
  suites: Record<string, SuiteSnapshot>;
}

export interface EvalRegressionReport {
  status: SuiteRegression['status'];
  veto: boolean;
  /** Why the baseline could not be used, if it could not. */
  baselineProblem: string | null;
  suites: SuiteRegression[];
}

/** Identifies a case by its text and labels, not only its id. */
const digest = (item: unknown) => createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 16);

function snapshot(items: ReadonlyArray<{ id: string }>, outcomes: Record<string, Record<string, boolean>>, metrics: Record<string, MetricValue>): SuiteSnapshot {
  return { metrics, cases: Object.fromEntries(items.map((item) => [item.id, { digest: digest(item), checks: outcomes[item.id] ?? {} }])) };
}

const higher = (value: number): MetricValue => ({ value, better: 'higher' });

/** The current results of every suite; `faults` lets tests seed regressions into the classifier or router. */
export function evalSnapshots(packageRoot: string = PACKAGE_ROOT, faults: EvalFaults = {}): Record<string, SuiteSnapshot> {
  const routing = runRoutingEvaluation(packageRoot, faults);
  const sensitivity = runSensitivityEvaluation(packageRoot, faults);
  return {
    routing: snapshot(evalItems(packageRoot, 'classification.yaml'), routing.outcomes, {
      domainPrecision: higher(routing.domainPrecision),
      domainRecall: higher(routing.domainRecall),
      topDomainAccuracy: higher(routing.topDomainAccuracy),
      multiDomainRecall: higher(routing.multiDomainRecall),
      typeAccuracy: higher(routing.typeAccuracy),
      minimality: higher(routing.minimality),
    }),
    sensitivity: snapshot(evalItems(packageRoot, 'sensitivity.yaml'), sensitivity.outcomes, {
      recall: higher(sensitivity.recall),
      falsePositives: { value: sensitivity.falsePositives, better: 'lower' },
      assessmentAccuracy: higher(sensitivity.assessmentAccuracy),
    }),
  };
}

/** Regressions of the sensitive-impact suite override any aggregate score. */
const VETO_SUITES = new Set(['sensitivity']);
const EMPTY: SuiteSnapshot = { metrics: {}, cases: {} };

function readBaseline(packageRoot: string): { baseline: EvalBaseline | null; problem: string | null } {
  const file = join(packageRoot, EVAL_BASELINE_FILE);
  if (!existsSync(file)) return { baseline: null, problem: `no baseline at ${EVAL_BASELINE_FILE}; record one with npm run eval:baseline` };
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { baseline: null, problem: `${EVAL_BASELINE_FILE} is not valid JSON: ${(error as Error).message}` };
  }
  const check = new SchemaValidator(join(packageRoot, 'catalog', 'schemas')).validate(EVAL_BASELINE_SCHEMA, value);
  return check.valid ? { baseline: value as EvalBaseline, problem: null } : { baseline: null, problem: `${EVAL_BASELINE_FILE} is invalid: ${check.errors.join('; ')}` };
}

const SEVERITY: Record<SuiteRegression['status'], number> = { PASS: 0, STALE: 1, REGRESSED: 2 };

export function checkEvalRegressions(packageRoot: string = PACKAGE_ROOT, faults: EvalFaults = {}): EvalRegressionReport {
  const { baseline, problem } = readBaseline(packageRoot);
  const suites = Object.entries(evalSnapshots(packageRoot, faults)).map(([suite, current]) =>
    detectRegressions(suite, baseline?.suites[suite] ?? EMPTY, current, { veto: VETO_SUITES.has(suite) }),
  );
  const worst = suites.reduce<SuiteRegression['status']>((status, suite) => (SEVERITY[suite.status] > SEVERITY[status] ? suite.status : status), 'PASS');
  // Without a usable baseline nothing is compared: never PASS.
  const status = problem && worst === 'PASS' ? 'STALE' : worst;
  return { status, veto: suites.some((suite) => suite.veto), baselineProblem: problem, suites };
}

/** One case per line, so a baseline update reads as a per-case diff. */
export function serializeBaseline(baseline: EvalBaseline): string {
  const suites = Object.entries(baseline.suites).map(([name, suite]) => {
    const metrics = Object.entries(suite.metrics).map(([metric, value]) => `        ${JSON.stringify(metric)}: ${JSON.stringify(value)}`);
    const cases = Object.entries(suite.cases).map(([id, result]) => `        ${JSON.stringify(id)}: ${JSON.stringify(result)}`);
    return `    ${JSON.stringify(name)}: {\n      "metrics": {\n${metrics.join(',\n')}\n      },\n      "cases": {\n${cases.join(',\n')}\n      }\n    }`;
  });
  return `{\n  "schemaVersion": "eval-baseline/v1",\n  "suites": {\n${suites.join(',\n')}\n  }\n}\n`;
}

/** Records the current results as the baseline. Done on purpose, after reading the regression report. */
export function recordEvalBaseline(packageRoot: string = PACKAGE_ROOT): EvalBaseline {
  const baseline: EvalBaseline = { schemaVersion: 'eval-baseline/v1', suites: evalSnapshots(packageRoot) };
  writeFileSync(join(packageRoot, EVAL_BASELINE_FILE), serializeBaseline(baseline));
  return baseline;
}

export function renderEvalRegressions(report: EvalRegressionReport): string {
  const lines = [`Evaluation regressions: ${report.status}${report.veto ? ' (VETO: sensitive-impact regression)' : ''}`];
  if (report.baselineProblem) lines.push(`  baseline: ${report.baselineProblem}`);
  for (const suite of report.suites) {
    lines.push(`- ${suite.suite}: ${suite.status}`);
    for (const item of suite.regressions) lines.push(`    regressed: ${item.case} ${item.check}`);
    for (const item of suite.metricRegressions) lines.push(`    metric worse: ${item.metric} ${item.baseline} -> ${item.current ?? 'missing'}`);
    for (const item of suite.fixes) lines.push(`    fixed: ${item.case} ${item.check}`);
    for (const [label, ids] of [['added', suite.added], ['removed', suite.removed], ['relabelled', suite.relabelled]] as const) {
      if (ids.length) lines.push(`    ${label}: ${ids.join(', ')}`);
    }
  }
  if (report.status === 'STALE') lines.push('The evaluation set changed: review the list above, then record the baseline again with npm run eval:baseline.');
  if (report.status === 'REGRESSED') lines.push('Fix the regressions. Record a new baseline only for a deliberate trade-off, and say why in the commit.');
  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  if (process.argv.includes('--record')) {
    const { suites } = recordEvalBaseline();
    process.stdout.write(`Recorded ${EVAL_BASELINE_FILE}: ${Object.entries(suites).map(([name, suite]) => `${name} ${Object.keys(suite.cases).length} cases`).join(', ')}\n`);
  } else {
    const report = checkEvalRegressions();
    process.stdout.write(renderEvalRegressions(report));
    process.exitCode = report.status === 'PASS' ? 0 : 1;
  }
}

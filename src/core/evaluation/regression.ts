/**
 * Regression detection against a tracked baseline (W2.2-06, docs/v2/09 §6). Aggregate floors can
 * hide a regression (one case breaks while another is fixed), so every case is compared check by
 * check: anything that passed in the baseline and fails now is a regression. Metrics are compared
 * too, which catches a case that was already failing and got worse. A changed dataset (cases added,
 * removed or relabelled) is STALE, never PASS: the baseline must be recorded again on purpose. On a
 * changed dataset only the unchanged cases are compared; the metrics cover other cases and are not.
 */
export interface MetricValue {
  value: number;
  better: 'higher' | 'lower';
}

export interface CaseResult {
  /** Digest of the case's text and labels: a relabelled case is not comparable with its baseline. */
  digest: string;
  /** Check name → passed. */
  checks: Record<string, boolean>;
}

export interface SuiteSnapshot {
  metrics: Record<string, MetricValue>;
  cases: Record<string, CaseResult>;
}

export interface SuiteRegression {
  suite: string;
  /**
   * PASS: every case and metric at least as good as the baseline, dataset unchanged.
   * REGRESSED: a check that passed fails now, or a metric got worse. Takes precedence over STALE.
   * STALE: the dataset changed since the baseline (no regression among the comparable cases).
   */
  status: 'PASS' | 'REGRESSED' | 'STALE';
  /** A regression in a suite whose regressions override any aggregate score (security). */
  veto: boolean;
  regressions: Array<{ case: string; check: string }>;
  fixes: Array<{ case: string; check: string }>;
  /** False when the dataset changed: aggregates over different cases are not comparable. */
  metricsCompared: boolean;
  /** `current` is null when the metric is no longer reported. */
  metricRegressions: Array<{ metric: string; baseline: number; current: number | null }>;
  added: string[];
  removed: string[];
  relabelled: string[];
}

const checkNames = (result: CaseResult | undefined) => Object.keys(result?.checks ?? {});

/** Metrics of the baseline that got worse in the given direction, or are no longer reported. */
function worseMetrics(baseline: SuiteSnapshot, current: SuiteSnapshot): SuiteRegression['metricRegressions'] {
  return Object.entries(baseline.metrics).flatMap(([metric, before]) => {
    const now = current.metrics[metric];
    const worse = !now || (before.better === 'higher' ? now.value < before.value : now.value > before.value);
    return worse ? [{ metric, baseline: before.value, current: now?.value ?? null }] : [];
  });
}

function suiteStatus(regressed: boolean, stale: boolean): SuiteRegression['status'] {
  if (regressed) return 'REGRESSED';
  if (stale) return 'STALE';
  return 'PASS';
}

export function detectRegressions(suite: string, baseline: SuiteSnapshot, current: SuiteSnapshot, options: { veto?: boolean } = {}): SuiteRegression {
  const regressions: SuiteRegression['regressions'] = [];
  const fixes: SuiteRegression['fixes'] = [];
  const relabelled: string[] = [];
  for (const [id, now] of Object.entries(current.cases)) {
    const before = baseline.cases[id];
    if (!before) continue;
    if (before.digest !== now.digest) {
      relabelled.push(id);
      continue;
    }
    for (const check of new Set([...checkNames(before), ...checkNames(now)])) {
      const was = before.checks[check];
      const is = now.checks[check];
      // A check that disappeared counts as failing: it can no longer show that the case passes.
      if (was === true && is !== true) regressions.push({ case: id, check });
      if (was !== true && is === true) fixes.push({ case: id, check });
    }
  }
  const added = Object.keys(current.cases).filter((id) => !baseline.cases[id]);
  const removed = Object.keys(baseline.cases).filter((id) => !current.cases[id]);
  const stale = added.length + removed.length + relabelled.length > 0;
  const metricRegressions = stale ? [] : worseMetrics(baseline, current);
  const regressed = regressions.length > 0 || metricRegressions.length > 0;
  return {
    suite,
    status: suiteStatus(regressed, stale),
    veto: regressed && options.veto === true,
    regressions,
    fixes,
    metricsCompared: !stale,
    metricRegressions,
    added,
    removed,
    relabelled,
  };
}

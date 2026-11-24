import { describe, expect, it } from 'vitest';
import { runRoutingEvaluation } from '../../src/app/routing-eval-run';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * Regression floors for the routing evaluation (docs/v2/09 §4). The floors equal the values measured
 * on 2026-11-24 on the DEVELOPMENT set (benchmarks/eval/README.md); they stop silent regressions and
 * are not claims of real-world accuracy. Raise them when the router improves; never lower them to
 * make a change pass without recording why.
 */
const FLOORS = {
  domainPrecision: 0.95,
  domainRecall: 0.93,
  topDomainAccuracy: 0.98,
  multiDomainRecall: 0.73,
  typeAccuracy: 0.84,
  minimality: 0.91,
};

describe('routing evaluation (development set)', () => {
  const metrics = runRoutingEvaluation(REPO_ROOT);

  it('should evaluate all 140 labelled tasks', () => {
    expect(metrics.tasks).toBe(140);
  });

  it.each(Object.entries(FLOORS))('should keep %s at or above its floor (%s)', (name, floor) => {
    expect(metrics[name as keyof typeof FLOORS]).toBeGreaterThanOrEqual(floor);
  });
});

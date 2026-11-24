import { describe, expect, it } from 'vitest';
import { detectRegressions, type SuiteSnapshot } from '../../../src/core/evaluation';

const snapshot = (cases: Record<string, Record<string, boolean>>, metrics: SuiteSnapshot['metrics'] = {}, digest = 'a'.repeat(16)): SuiteSnapshot => ({
  metrics,
  cases: Object.fromEntries(Object.entries(cases).map(([id, checks]) => [id, { digest, checks }])),
});

describe('detectRegressions (W2.2-06)', () => {
  it('should pass when nothing changed and report fixes without failing', () => {
    const before = snapshot({ a: { x: true, y: false } }, { m: { value: 0.5, better: 'higher' } });
    const after = snapshot({ a: { x: true, y: true } }, { m: { value: 0.6, better: 'higher' } });
    expect(detectRegressions('s', before, before)).toMatchObject({ status: 'PASS', regressions: [], fixes: [], metricsCompared: true });
    expect(detectRegressions('s', before, after)).toMatchObject({ status: 'PASS', fixes: [{ case: 'a', check: 'y' }] });
  });

  it('should count a check that disappeared as a regression', () => {
    expect(detectRegressions('s', snapshot({ a: { x: true } }), snapshot({ a: {} })).regressions).toEqual([{ case: 'a', check: 'x' }]);
  });

  it('should respect the direction of each metric and flag a metric that is no longer reported', () => {
    const before = snapshot({}, { up: { value: 0.5, better: 'higher' }, down: { value: 2, better: 'lower' }, gone: { value: 1, better: 'higher' } });
    const after = snapshot({}, { up: { value: 0.5, better: 'higher' }, down: { value: 3, better: 'lower' } });
    expect(detectRegressions('s', before, after).metricRegressions).toEqual([
      { metric: 'down', baseline: 2, current: 3 },
      { metric: 'gone', baseline: 1, current: null },
    ]);
  });

  it('should veto only a suite that regressed, and put REGRESSED before STALE', () => {
    const before = snapshot({ a: { x: true } });
    expect(detectRegressions('s', before, before, { veto: true }).veto).toBe(false);
    const regressedAndChanged = detectRegressions('s', before, { ...snapshot({ a: { x: false } }), cases: { ...snapshot({ a: { x: false } }).cases, b: { digest: 'b'.repeat(16), checks: {} } } }, { veto: true });
    expect(regressedAndChanged).toMatchObject({ status: 'REGRESSED', veto: true, added: ['b'] });
  });

  it('should not compare a relabelled case', () => {
    const report = detectRegressions('s', snapshot({ a: { x: true } }), snapshot({ a: { x: false } }, {}, 'c'.repeat(16)));
    expect(report).toMatchObject({ status: 'STALE', relabelled: ['a'], regressions: [] });
  });
});

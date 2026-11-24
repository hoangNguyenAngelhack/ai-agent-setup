import { describe, expect, it } from 'vitest';
import { runSensitivityEvaluation } from '../../src/app/routing-eval-run';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * ADR-014 regression gate on the DEVELOPMENT set (benchmarks/eval/sensitivity.yaml): every positive
 * case gets its mandatory review, no negative case gets one, ambiguous cases are flagged. Written by
 * the same author as the rules, so it proves consistency, not real-world accuracy.
 */
describe('sensitive-impact review evaluation (development set)', () => {
  const metrics = runSensitivityEvaluation(REPO_ROOT);

  it('should evaluate all 22 cases', () => {
    expect(metrics.cases).toBe(22);
  });

  it('should add every expected mandatory review', () => {
    expect(metrics.recall).toBe(1);
  });

  it('should add no mandatory review to the negative cases', () => {
    expect(metrics.falsePositives).toBe(0);
  });

  it('should flag the ambiguous cases for assessment', () => {
    expect(metrics.assessmentAccuracy).toBe(1);
  });

  it('should report no failures', () => {
    expect(metrics.failures).toEqual([]);
  });
});

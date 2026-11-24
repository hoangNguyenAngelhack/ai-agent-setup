import type { Plan } from '../contracts';

export interface SensitivityCase {
  id: string;
  text: string;
  /** Categories that must get a mandatory specialist review. */
  expect: string[];
  /** Categories that must be flagged for assessment without a mandatory review. */
  assess?: string[];
}

export interface SensitivityMetrics {
  cases: number;
  /** Expected mandatory reviews that were added. */
  recall: number;
  /** Mandatory reviews added where none was expected (negative cases). */
  falsePositives: number;
  /** Ambiguous cases flagged for assessment as labelled. */
  assessmentAccuracy: number;
  failures: string[];
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

/** ADR-014 evaluation: positive, negative and ambiguous sensitive-impact cases. Pure. */
export function evaluateSensitivity(cases: readonly SensitivityCase[], route: (text: string) => Plan): SensitivityMetrics {
  let expected = 0;
  let found = 0;
  let falsePositives = 0;
  let assessTotal = 0;
  let assessCorrect = 0;
  const failures: string[] = [];

  for (const item of cases) {
    const findings = route(item.text).explain.sensitivity;
    const mandatory = [...new Set(findings.filter((finding) => finding.mandatory).map((finding) => finding.category))];
    const assessed = [...new Set(findings.filter((finding) => !finding.mandatory && !finding.ignored).map((finding) => finding.category))];
    expected += item.expect.length;
    found += item.expect.filter((category) => mandatory.includes(category)).length;
    falsePositives += mandatory.filter((category) => !item.expect.includes(category)).length;
    if (!sameSet(mandatory, item.expect)) failures.push(`${item.id} mandatory: expected [${item.expect.join(',')}], got [${mandatory.join(',')}]`);
    if (item.assess) {
      assessTotal += 1;
      if (sameSet(assessed, item.assess)) assessCorrect += 1;
      else failures.push(`${item.id} assessment: expected [${item.assess.join(',')}], got [${assessed.join(',')}]`);
    }
  }

  return {
    cases: cases.length,
    recall: round(found / Math.max(expected, 1)),
    falsePositives,
    assessmentAccuracy: round(assessCorrect / Math.max(assessTotal, 1)),
    failures,
  };
}

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
  /** Per case: mandatory (exact set of mandatory reviews), and assessment for ambiguous cases. */
  outcomes: Record<string, Record<string, boolean>>;
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
  const outcomes: SensitivityMetrics['outcomes'] = {};

  for (const item of cases) {
    const checks: Record<string, boolean> = {};
    outcomes[item.id] = checks;
    const findings = route(item.text).explain.sensitivity;
    const mandatory = [...new Set(findings.filter((finding) => finding.mandatory).map((finding) => finding.category))];
    const assessed = [...new Set(findings.filter((finding) => !finding.mandatory && !finding.ignored).map((finding) => finding.category))];
    expected += item.expect.length;
    found += item.expect.filter((category) => mandatory.includes(category)).length;
    falsePositives += mandatory.filter((category) => !item.expect.includes(category)).length;
    checks.mandatory = sameSet(mandatory, item.expect);
    if (!checks.mandatory) failures.push(`${item.id} mandatory: expected [${item.expect.join(',')}], got [${mandatory.join(',')}]`);
    if (item.assess) {
      assessTotal += 1;
      checks.assessment = sameSet(assessed, item.assess);
      if (checks.assessment) assessCorrect += 1;
      else failures.push(`${item.id} assessment: expected [${item.assess.join(',')}], got [${assessed.join(',')}]`);
    }
  }

  return {
    cases: cases.length,
    recall: round(found / Math.max(expected, 1)),
    falsePositives,
    assessmentAccuracy: round(assessCorrect / Math.max(assessTotal, 1)),
    failures,
    outcomes,
  };
}

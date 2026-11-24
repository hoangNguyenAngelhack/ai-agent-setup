import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEvalRegressions, EVAL_BASELINE_FILE, recordEvalBaseline, renderEvalRegressions, serializeBaseline, type EvalBaseline } from '../../src/app/eval-regression';
import { evalItems, type EvalFaults } from '../../src/app/routing-eval-run';
import type { LabelledTask } from '../../src/core/evaluation';
import { writeTree } from '../helpers/fs-tree';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * W2.2-06 acceptance: regressions seeded into the classifier or the router are detected in the
 * evaluation set, case by case, against the committed baseline. Each seeded fault must name exactly
 * the cases it breaks, and nothing in the suites it does not touch.
 */
const baseline = JSON.parse(readFileSync(join(REPO_ROOT, EVAL_BASELINE_FILE), 'utf8')) as EvalBaseline;
const tasks = evalItems<LabelledTask>(REPO_ROOT, 'classification.yaml');
const passing = (suite: string, check: string) =>
  Object.entries(baseline.suites[suite]!.cases)
    .filter(([, result]) => result.checks[check] === true)
    .map(([id]) => id);
const suite = (faults: EvalFaults, name: string) => checkEvalRegressions(REPO_ROOT, faults).suites.find((item) => item.suite === name)!;
const regressed = (faults: EvalFaults, name: string, check: string) =>
  suite(faults, name)
    .regressions.filter((item) => item.check === check)
    .map((item) => item.case)
    .sort();

describe('evaluation regression detection (W2.2-06)', () => {
  it('should find no regression between the committed baseline and the current code', () => {
    const report = checkEvalRegressions(REPO_ROOT);
    expect(renderEvalRegressions(report)).toBe('Evaluation regressions: PASS\n- routing: PASS\n- sensitivity: PASS\n');
    // Committed as `npm run eval:baseline` writes it: one case per line.
    expect(serializeBaseline(baseline)).toBe(readFileSync(join(REPO_ROOT, EVAL_BASELINE_FILE), 'utf8'));
  });

  it('should detect a classifier that drops secondary domains, on exactly the multi-domain tasks it breaks', () => {
    const faults: EvalFaults = { classify: (classify) => (text) => ({ ...classify(text), domains: classify(text).domains.slice(0, 1) }) };
    const multi = new Set(tasks.filter((task) => task.domains.length > 1).map((task) => task.id));
    const expected = passing('routing', 'domains').filter((id) => multi.has(id)).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(regressed(faults, 'routing', 'domains')).toEqual(expected);
    expect(suite(faults, 'routing')).toMatchObject({ status: 'REGRESSED', veto: false });
    expect(suite(faults, 'routing').metricRegressions.map((item) => item.metric)).toContain('multiDomainRecall');
    const text = renderEvalRegressions(checkEvalRegressions(REPO_ROOT, faults));
    expect(text).toMatch(/^Evaluation regressions: REGRESSED\n/);
    expect(text).toContain(`regressed: ${expected[0]} domains`);
    expect(text).toContain('metric worse: multiDomainRecall 0.732 -> ');
    expect(text).toContain('Fix the regressions.');
    expect(suite(faults, 'sensitivity').status).toBe('PASS');
  });

  it('should detect a router that adds an agent to every plan, on exactly the simple tasks that were minimal', () => {
    const faults: EvalFaults = { route: (route) => (text, classification) => {
      const plan = route(text, classification);
      return { ...plan, agents: [...plan.agents, 'agent.seeded-extra'] };
    } };
    expect(regressed(faults, 'routing', 'minimality')).toEqual(passing('routing', 'minimality').sort());
    expect(suite(faults, 'routing').regressions.every((item) => item.check === 'minimality')).toBe(true);
  });

  it('should detect one broken case even when another fix leaves every aggregate unchanged', () => {
    const typeOf = new Map(tasks.map((task) => [task.text, task]));
    const broken = passing('routing', 'type')[0]!;
    const fixed = Object.entries(baseline.suites.routing!.cases).find(([, result]) => result.checks.type === false)![0];
    const faults: EvalFaults = { classify: (classify) => (text) => {
      const result = classify(text);
      const task = typeOf.get(text);
      if (!task) return result;
      if (task.id === broken) return { ...result, type: task.type === 'docs' ? 'ops' : 'docs' };
      if (task.id === fixed) return { ...result, type: task.type };
      return result;
    } };
    const routing = suite(faults, 'routing');
    expect(routing.metricRegressions).toEqual([]);
    expect(routing).toMatchObject({ status: 'REGRESSED', regressions: [{ case: broken, check: 'type' }], fixes: [{ case: fixed, check: 'type' }] });
    expect(renderEvalRegressions(checkEvalRegressions(REPO_ROOT, faults))).toContain(`fixed: ${fixed} type`);
  });

  it('should veto a router that loses the mandatory payment review', () => {
    const faults: EvalFaults = { route: (route) => (text, classification) => {
      const plan = route(text, classification);
      return { ...plan, explain: { ...plan.explain, sensitivity: plan.explain.sensitivity.filter((finding) => finding.category !== 'payment') } };
    } };
    const report = checkEvalRegressions(REPO_ROOT, faults);
    const sensitivity = report.suites.find((item) => item.suite === 'sensitivity')!;
    expect(sensitivity).toMatchObject({ status: 'REGRESSED', veto: true });
    // The three payment cases lose their mandatory review; sa-02 (payment research) loses its assessment flag.
    expect(sensitivity.regressions).toEqual([
      { case: 'sp-01', check: 'mandatory' },
      { case: 'sp-02', check: 'mandatory' },
      { case: 'sp-03', check: 'mandatory' },
      { case: 'sa-02', check: 'assessment' },
    ]);
    expect(report).toMatchObject({ status: 'REGRESSED', veto: true });
    expect(renderEvalRegressions(report)).toContain('REGRESSED (VETO: sensitive-impact regression)');
  });
});

/** A package copy whose evaluation set or baseline the test can change. */
function packageCopy(): string {
  const root = writeTree({});
  cpSync(join(REPO_ROOT, 'catalog'), join(root, 'catalog'), { recursive: true });
  mkdirSync(join(root, 'benchmarks'), { recursive: true });
  cpSync(join(REPO_ROOT, 'benchmarks', 'eval'), join(root, 'benchmarks', 'eval'), { recursive: true });
  return root;
}

describe('evaluation set changes (W2.2-06)', () => {
  it('should report a changed set as STALE, never PASS, listing what changed', () => {
    const root = packageCopy();
    const file = join(root, 'benchmarks', 'eval', 'classification.yaml');
    const text = readFileSync(file, 'utf8')
      .replace(/^ {2}- \{ id: pb-02,.*\n/m, '')
      .replace('id: pb-03, type: analysis', 'id: pb-03, type: docs')
      .replace('items:\n', 'items:\n  - { id: zz-01, type: docs, domains: [developer-experience], simple: true, text: "Document the release steps" }\n');
    writeFileSync(file, text);
    const routing = checkEvalRegressions(root).suites.find((item) => item.suite === 'routing')!;
    // Aggregates now cover other cases, so they are not compared; the unchanged cases still are.
    expect(routing).toMatchObject({ status: 'STALE', added: ['zz-01'], removed: ['pb-02'], relabelled: ['pb-03'], metricsCompared: false, regressions: [], metricRegressions: [] });
    const rendered = renderEvalRegressions(checkEvalRegressions(root));
    expect(rendered).toContain('added: zz-01\n    removed: pb-02\n    relabelled: pb-03');
    expect(rendered).toContain('record the baseline again with npm run eval:baseline');

    // A regression among the unchanged cases is still caught on a changed set.
    const breakTopDomain: EvalFaults = { classify: (classify) => (text) => (text.startsWith('Write a PRD') ? { ...classify(text), domains: [] } : classify(text)) };
    expect(checkEvalRegressions(root, breakTopDomain).suites[0]).toMatchObject({ status: 'REGRESSED', regressions: expect.arrayContaining([{ case: 'pb-01', check: 'topDomain' }]) as unknown });
  });

  it('should never pass without a usable baseline', () => {
    const root = packageCopy();
    writeFileSync(join(root, EVAL_BASELINE_FILE), '{ "schemaVersion": "eval-baseline/v1", "suites": {} }');
    expect(checkEvalRegressions(root)).toMatchObject({ status: 'STALE', baselineProblem: expect.stringContaining('is invalid') as unknown });
    writeFileSync(join(root, EVAL_BASELINE_FILE), 'not json');
    expect(checkEvalRegressions(root).baselineProblem).toMatch(/not valid JSON/);
    rmSync(join(root, EVAL_BASELINE_FILE));
    const missing = checkEvalRegressions(root);
    expect(missing).toMatchObject({ status: 'STALE', baselineProblem: expect.stringContaining('no baseline') as unknown });
    expect(renderEvalRegressions(missing)).toContain('  baseline: no baseline at');

    // Recording it again (the deliberate step) makes the same code pass.
    expect(Object.keys(recordEvalBaseline(root).suites)).toEqual(['routing', 'sensitivity']);
    expect(checkEvalRegressions(root)).toMatchObject({ status: 'PASS', baselineProblem: null });
  });
});

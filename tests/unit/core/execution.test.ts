import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlanOverrides } from '../../../src/core/contracts';
import {
  applyEvent,
  approveExecutionPlan,
  assertApproved,
  createExecutionPlan,
  createExecutionState,
  planDigest,
  readySteps,
  reconcile,
  replayEvents,
  reviseExecutionPlan,
  type ExecutionEvent,
  type ExecutionPlan,
  type ExecutionState,
} from '../../../src/core/execution';
import { TaskClassifier } from '../../../src/core/planning';
import { routeTask } from '../../../src/core/routing';
import { KnowledgeIndex, Registry, SchemaValidator, validateCatalog, type ProfileEntry } from '../../../src/registry';
import { REPO_ROOT } from '../../helpers/v1-cli';

const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const registry = new Registry(report.entries);
const classifier = new TaskClassifier(registry);
const AT = '2026-11-24T10:00:00.000Z';
const schemas = new SchemaValidator(join(REPO_ROOT, 'catalog', 'schemas'));
const RUN_RESULT = 'urn:ai-agent-setup:contracts:v1:run-result';

function routed(task: string, overrides: PlanOverrides = {}) {
  return routeTask({
    id: 'plan-20261124T100000Z-abcdef',
    task,
    mode: 'hybrid',
    classification: classifier.classify(task),
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profile: registry.get('profile.standard') as ProfileEntry,
    policies: report.policies,
    project: null,
    overrides,
    contextT0Bytes: 0,
  });
}

const TASK = 'Implement the orders API endpoint and build the orders page in the React app';
const base = routed(TASK, { domains: ['backend', 'frontend'] });
const draft = createExecutionPlan(base, { runId: 'run-20261124T100000Z-abcdef', project: { name: 'demo', commit: 'abc123' } });
const approved = approveExecutionPlan(draft, 'user', AT);
const [first, second] = approved.steps.map((step) => step.id) as [string, string];

let counter = 0;
function event<T extends ExecutionEvent['type']>(type: T, extra: Record<string, unknown> = {}, plan: ExecutionPlan = approved): ExecutionEvent {
  counter += 1;
  return { eventId: `e${counter}`, runId: plan.runId, planDigest: plan.approval.digest!, at: AT, source: 'orchestrator', type, ...extra } as ExecutionEvent;
}

const hostStarted = (stepId: string) => ({ ...event('STEP_STARTED', { stepId }), source: 'host' as const });

const passAll = (stepId: string) => {
  const spec = approved.steps.find((step) => step.id === stepId)!;
  const gates = spec.verification.length ? spec.verification : ['gate.build'];
  return event('STEP_COMPLETED', { stepId, gates: gates.map((gate) => ({ gate, status: 'PASS', reason: null })), evidence: ['evidence/build.json'] });
};

function run(events: ExecutionEvent[], plan: ExecutionPlan = approved): ExecutionState {
  return events.reduce((state, item) => applyEvent(plan, state, item), createExecutionState(plan));
}

describe('ExecutionPlan (ADR-009)', () => {
  it('should carry every contract field with stable step ids', () => {
    expect(draft).toMatchObject({ schemaVersion: 'execution-plan/v1', runId: 'run-20261124T100000Z-abcdef', planId: base.id, revision: 1, supersedes: null, objective: TASK });
    expect(draft.steps.map((step) => step.id)).toEqual(base.steps.map((step) => step.id));
    expect(draft.steps[1]).toMatchObject({ dependsOn: [first], inputs: ['objective', `outputs of ${first}`] });
    expect([...draft.domains].sort()).toEqual(['backend', 'frontend']);
    expect(draft.steps[0]!.verification).toEqual([]);
    expect(draft.steps[1]!.verification).toEqual(base.gates);
    expect(base.gates.length).toBeGreaterThan(0);
    expect(draft.estimatedCost.label).toBe('estimated');
    expect(draft.approvals.plan).toBe('required');
  });

  it('should keep the digest stable across approval and detect later edits', () => {
    expect(approved.approval.digest).toBe(planDigest(draft));
    expect(assertApproved(approved)).toBe(approved.approval.digest);
    const edited = { ...approved, objective: 'something else' };
    expect(() => assertApproved(edited)).toThrow(/changed after approval/);
    expect(() => approveExecutionPlan(approved, 'user', AT)).toThrow(/already approved/);
  });

  it('should produce a new revision for a scope change', () => {
    const next = reviseExecutionPlan(approved, routed(TASK, { domains: ['backend'] }));

    expect(next).toMatchObject({ revision: 2, supersedes: approved.approval.digest, approval: { status: 'pending' } });
    expect(() => createExecutionState(next)).toThrow(/not approved/);
  });
});

describe('step states (W2.1-09)', () => {
  it('should start with only dependency-free steps READY', () => {
    const state = createExecutionState(approved);

    expect(readySteps(state)).toEqual([first]);
    expect(state.steps[second]!.state).toBe('PENDING');
  });

  it('should refuse to start a step whose dependencies have not succeeded', () => {
    const state = run([event('STEP_STARTED', { stepId: second })]);

    expect(state.steps[second]!.state).toBe('PENDING');
    expect(state.anomalies[0]).toMatchObject({ type: 'STEP_STARTED', reason: 'dependencies are not satisfied' });
  });

  it('should succeed a step only from orchestrator gate results', () => {
    const state = run([event('RUN_STARTED'), event('STEP_STARTED', { stepId: first }), passAll(first)]);

    expect(state.steps[first]!.state).toBe('SUCCEEDED');
    expect(readySteps(state)).toEqual([second]);
  });

  it('should not trust a host completion claim', () => {
    const state = run([event('STEP_STARTED', { stepId: first }), { ...passAll(first), source: 'host' }]);

    expect(state.steps[first]!.state).toBe('NOT_VERIFIED');
    expect(state.steps[first]!.reason).toMatch(/awaiting orchestrator verification/);
    expect(state.steps[second]!.state).toBe('PENDING');
  });

  it('should verify a NOT_VERIFIED step later from orchestrator gates', () => {
    const state = run([event('STEP_STARTED', { stepId: first }), { ...passAll(first), source: 'host' }, passAll(first)]);

    expect(state.steps[first]!.state).toBe('SUCCEEDED');
  });

  it('should not succeed a step on evidence paths alone', () => {
    const state = run([event('STEP_STARTED', { stepId: first }), event('STEP_COMPLETED', { stepId: first, gates: [], evidence: ['notes.md'] })]);

    expect(state.steps[first]).toMatchObject({ state: 'NOT_VERIFIED', reason: 'no gates were run for this step' });
  });

  it('should treat a missing gate result as NOT_VERIFIED and a failing one as FAILED', () => {
    const [gate, ...rest] = approved.steps[1]!.verification as [string, ...string[]];
    const partial = run([passAll(first), event('STEP_COMPLETED', { stepId: second, gates: [{ gate, status: 'PASS', reason: null }], evidence: [] })]);
    const failing = run([
      passAll(first),
      event('STEP_COMPLETED', { stepId: second, gates: [{ gate, status: 'FAIL', reason: 'exit 1' }, ...rest.map((other) => ({ gate: other, status: 'PASS', reason: null }))], evidence: ['evidence/log.txt'] }),
    ]);

    expect(partial.steps[second]!.state).toBe('NOT_VERIFIED');
    expect(partial.steps[second]!.reason).toContain('gate result missing');
    expect(failing.steps[second]).toMatchObject({ state: 'FAILED', reason: `${gate}: exit 1`, evidence: ['evidence/log.txt'] });
  });

  it('should keep failure evidence and block dependants', () => {
    const state = run([event('STEP_STARTED', { stepId: first }), event('STEP_FAILED', { stepId: first, reason: 'compile error', evidence: ['evidence/tsc.log'] })]);

    expect(state.steps[first]).toMatchObject({ state: 'FAILED', reason: 'compile error', evidence: ['evidence/tsc.log'] });
    expect(state.steps[second]).toMatchObject({ state: 'BLOCKED', reason: `dependency ${first} is FAILED` });
  });

  it('should pause for approval and resume only on a user decision', () => {
    const waiting = run([event('STEP_STARTED', { stepId: first }), event('APPROVAL_REQUIRED', { stepId: first, reason: 'runs a migration' })]);
    expect(waiting.steps[first]!.state).toBe('WAITING_FOR_APPROVAL');

    const byHost = applyEvent(approved, waiting, { ...event('APPROVAL_RESOLVED', { stepId: first, approved: true, by: 'agent' }), source: 'host' });
    expect(byHost.steps[first]!.state).toBe('WAITING_FOR_APPROVAL');

    const resumed = applyEvent(approved, waiting, { ...event('APPROVAL_RESOLVED', { stepId: first, approved: true, by: 'user' }), source: 'user' });
    expect(resumed.steps[first]!.state).toBe('RUNNING');

    const declined = applyEvent(approved, waiting, { ...event('APPROVAL_RESOLVED', { stepId: first, approved: false, by: 'user' }), source: 'user' });
    expect(declined.steps[first]!.state).toBe('SKIPPED');
  });

  it('should not complete a step that is waiting for approval', () => {
    const state = run([event('STEP_STARTED', { stepId: first }), event('APPROVAL_REQUIRED', { stepId: first, reason: 'deploy' }), passAll(first)]);

    expect(state.steps[first]!.state).toBe('WAITING_FOR_APPROVAL');
    expect(state.anomalies.at(-1)!.reason).toBe('step cannot complete without approval');
  });

  it('should ignore duplicate events', () => {
    const started = event('STEP_STARTED', { stepId: first });
    const once = run([started]);

    expect(applyEvent(approved, once, started)).toBe(once);
  });

  it('should tolerate out-of-order events without regressing a final state', () => {
    const state = run([event('STEP_STARTED', { stepId: first }), passAll(first), event('STEP_PROGRESS', { stepId: first, message: 'late' }), event('STEP_STARTED', { stepId: first })]);

    expect(state.steps[first]!.state).toBe('SUCCEEDED');
    expect(state.anomalies.map((item) => item.type)).toEqual(['STEP_PROGRESS', 'STEP_STARTED']);
  });

  it('should accept a completion that arrives before its start event', () => {
    expect(run([passAll(first)]).steps[first]!.state).toBe('SUCCEEDED');
  });

  it('should reject events for another run or another plan revision', () => {
    const state = run([{ ...event('STEP_STARTED', { stepId: first }), planDigest: 'sha256:other' }, { ...event('STEP_STARTED', { stepId: first }), runId: 'run-2' }]);

    expect(state.steps[first]!.state).toBe('READY');
    expect(state.anomalies.map((item) => item.reason)).toEqual(['event for a different plan revision', 'event for run run-2']);
  });

  it('should cancel open steps and never report a cancelled run as success', () => {
    const state = run([event('STEP_STARTED', { stepId: first }), passAll(first), event('RUN_CANCELLED', { reason: 'user stopped' }), passAll(second)]);
    const result = reconcile(approved, state, AT);

    expect(state.steps[second]!.state).toBe('CANCELLED');
    expect(result.status).toBe('CANCELLED');
  });

  it('should rebuild the same state from the event log (restart)', () => {
    const events = [event('RUN_STARTED'), event('STEP_STARTED', { stepId: first }), passAll(first)];
    const live = run(events);
    const restored = replayEvents(approved, JSON.parse(JSON.stringify(events)) as ExecutionEvent[]);

    expect(restored).toEqual(live);
  });
});

describe('reconcile', () => {
  it.each([
    ['succeeded', () => [event('RUN_STARTED'), hostStarted(first), passAll(first), hostStarted(second), passAll(second), event('RUN_COMPLETED')]],
    ['outcome verified', () => [passAll(first), passAll(second)]],
    ['failed', () => [event('STEP_FAILED', { stepId: first, reason: 'boom', evidence: ['e.log'] })]],
    ['not verified', () => [event('RUN_STARTED'), event('RUN_COMPLETED')]],
    ['cancelled', () => [passAll(first), event('RUN_CANCELLED', { reason: 'stop' })]],
    ['declined approval', () => [event('STEP_STARTED', { stepId: first }), event('APPROVAL_REQUIRED', { stepId: first, reason: 'x' }), { ...event('APPROVAL_RESOLVED', { stepId: first, approved: false, by: 'user' }), source: 'user' }]],
  ] as const)('should produce a result that satisfies the run-result contract (%s)', (_name, events) => {
    const result = reconcile(approved, run([...events()] as ExecutionEvent[]), AT);

    expect(schemas.validate(RUN_RESULT, result)).toEqual({ valid: true, errors: [] });
    expect(result).toMatchObject({ planId: base.id, profile: base.profile, generatedAt: AT, approval: { by: 'user', at: AT } });
  });

  it('should succeed only when every step was reported executed and passed its gates', () => {
    const state = run([event('RUN_STARTED'), hostStarted(first), passAll(first), hostStarted(second), passAll(second), event('RUN_COMPLETED')]);
    const result = reconcile(approved, state, AT);

    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      counts: { SUCCEEDED: 2 },
      verification: { stepsTotal: 2, stepsSucceeded: 2, stepsWithExecutionEvidence: 2, gates: { FAIL: 0, NOT_VERIFIED: 0 } },
    });
    expect(result.steps.map((step) => step.execution)).toEqual([
      { evidenced: true, reports: ['STEP_STARTED'] },
      { evidenced: true, reports: ['STEP_STARTED'] },
    ]);
  });

  it('should report OUTCOME_VERIFIED, not SUCCEEDED, when gates pass without execution evidence', () => {
    const result = reconcile(approved, run([hostStarted(first), passAll(first), passAll(second)]), AT);

    expect(result).toMatchObject({ status: 'OUTCOME_VERIFIED', reason: `every step passed its gates, but no execution was reported for: ${second}` });
    expect(result.steps[1]!.execution).toEqual({ evidenced: false, reports: [] });
  });

  it('should not count rejected or non-host reports as execution evidence', () => {
    const lateReport = { ...event('STEP_STARTED', { stepId: second }), source: 'host' as const };
    const state = run([hostStarted(first), passAll(first), passAll(second), lateReport, event('STEP_STARTED', { stepId: first })]);

    expect(state.steps[second]!.reports).toEqual([]);
    expect(state.anomalies.at(-2)).toMatchObject({ type: 'STEP_STARTED', reason: 'step already SUCCEEDED' });
    expect(reconcile(approved, state, AT).status).toBe('OUTCOME_VERIFIED');
  });

  it('should report a host "done" with open steps as NOT_VERIFIED', () => {
    const state = run([event('RUN_STARTED'), event('RUN_COMPLETED')]);
    const result = reconcile(approved, state, AT);

    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.steps.find((step) => step.id === first)).toMatchObject({ state: 'READY', final: 'NOT_VERIFIED', reason: 'no final result (state READY)' });
  });

  it('should fail the run when a step failed', () => {
    const state = run([event('STEP_FAILED', { stepId: first, reason: 'boom', evidence: [] })]);

    expect(reconcile(approved, state, AT)).toMatchObject({ status: 'FAILED', counts: { FAILED: 1, BLOCKED: 1 } });
  });
});

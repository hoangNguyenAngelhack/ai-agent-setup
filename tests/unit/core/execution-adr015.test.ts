import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  approveExecutionPlan,
  createExecutionState,
  reconcile,
  replayEvents,
  type ExecutionEvent,
  type ExecutionPlan,
  type ExecutionState,
  type ExecutionStep,
} from '../../../src/core/execution';

/** ADR-015 (accepted 2026-11-24): host-ready vs verified-ready, deferred events, pending approvals. */
const AT = '2026-11-24T10:00:00.000Z';

function step(id: string, dependsOn: string[] = []): ExecutionStep {
  return {
    id,
    capability: id,
    agent: 'agent.implementer',
    phase: 'build-core',
    dependsOn,
    inputs: ['objective'],
    expectedOutputs: [`work product for ${id}`],
    verification: ['gate.build'],
    permissions: { allow: [], approvalRequired: [], denied: [] },
    risk: 'low',
    approval: 'none',
  };
}

// a → b, and c independent of both.
const plan: ExecutionPlan = approveExecutionPlan(
  {
    schemaVersion: 'execution-plan/v1',
    runId: 'run-20261124T100000Z-abcdef',
    planId: 'plan-20261124T095900Z-123abc',
    revision: 1,
    supersedes: null,
    project: { name: 'demo', commit: null },
    profile: 'profile.standard',
    objective: 'ADR-015 scenarios',
    assumptions: [],
    domains: ['backend'],
    capabilities: ['a', 'b', 'c'],
    agents: ['agent.implementer'],
    skills: [],
    steps: [step('a'), step('b', ['a']), step('c')],
    permissions: { allow: [], approvalRequired: [], denied: [] },
    risk: { level: 'low', reasons: [] },
    approvals: { plan: 'required', steps: [] },
    estimatedCost: { contextBytes: 0, steps: 3, approxTokens: 0, label: 'estimated', basis: 'test' },
    approval: { status: 'pending', by: null, at: null, digest: null },
  },
  'user',
  AT,
);

let counter = 0;
function ev(type: ExecutionEvent['type'], extra: Record<string, unknown> = {}, source: ExecutionEvent['source'] = 'host'): ExecutionEvent {
  counter += 1;
  return { eventId: `e${counter}`, runId: plan.runId, planDigest: plan.approval.digest!, at: AT, source, type, ...extra } as ExecutionEvent;
}
const started = (stepId: string) => ev('STEP_STARTED', { stepId });
const completed = (stepId: string, evidence: string[] = [`${stepId}.log`]) => ev('STEP_COMPLETED', { stepId, gates: [], evidence });
const verified = (stepId: string, status: 'PASS' | 'FAIL' = 'PASS') =>
  ev('STEP_COMPLETED', { stepId, gates: [{ gate: 'gate.build', status, reason: status === 'FAIL' ? 'exit code 1' : null }], evidence: [] }, 'orchestrator');
const approvalRequired = (stepId: string) => ev('APPROVAL_REQUIRED', { stepId, reason: 'runs a migration' });
const approve = (stepId: string, approved = true) => ev('APPROVAL_RESOLVED', { stepId, approved, by: 'user' }, 'user');

const run = (events: ExecutionEvent[]): ExecutionState => events.reduce((state, item) => applyEvent(plan, state, item), createExecutionState(plan));
const result = (state: ExecutionState) => reconcile(plan, state, AT);

describe('ADR-015: host events before the dependency is verified', () => {
  it('should accept work on b once the host finished a, before a is verified', () => {
    const state = run([started('a'), completed('a'), started('b'), completed('b')]);

    expect(state.steps.a).toMatchObject({ state: 'NOT_VERIFIED', hostCompleted: true });
    expect(state.steps.b).toMatchObject({ state: 'NOT_VERIFIED', hostCompleted: true, reports: ['STEP_STARTED', 'STEP_COMPLETED'], evidence: ['b.log'] });
    expect(state.anomalies).toEqual([]);
    expect(state.deferred).toEqual([]);
  });

  it('should succeed after verification in dependency order, with execution evidence for every step', () => {
    const state = run([started('a'), completed('a'), started('b'), completed('b'), started('c'), completed('c'), verified('a'), verified('b'), verified('c')]);

    expect(result(state)).toMatchObject({ status: 'SUCCEEDED', verification: { stepsSucceeded: 3, stepsWithExecutionEvidence: 3 }, deferred: [] });
  });

  it('should hold a verification of b that arrives before a succeeded, and apply it after (replay)', () => {
    const early = run([started('a'), completed('a'), started('b'), completed('b'), verified('b')]);
    expect(early.steps.b!.state).toBe('NOT_VERIFIED');
    expect(early.deferred.map((item) => item.reason)).toEqual(['verification waits until a SUCCEEDED']);

    const after = applyEvent(plan, early, verified('a'));
    expect(after.steps.a!.state).toBe('SUCCEEDED');
    expect(after.steps.b!.state).toBe('SUCCEEDED');
    expect(after.deferred).toEqual([]);
  });

  it('should block b when a fails verification, keeping what the host reported for b', () => {
    const state = run([started('a'), completed('a'), started('b'), completed('b', ['b.log']), verified('a', 'FAIL')]);

    expect(state.steps.a!.state).toBe('FAILED');
    expect(state.steps.b).toMatchObject({ state: 'BLOCKED', reason: 'dependency a is FAILED', reports: ['STEP_STARTED', 'STEP_COMPLETED'], evidence: ['b.log'] });
    expect(result(state).steps[1]).toMatchObject({ final: 'BLOCKED', execution: { evidenced: true, reports: ['STEP_STARTED', 'STEP_COMPLETED'] }, evidence: ['b.log'] });
  });
});

describe('ADR-015: host starts b before it reported a finished', () => {
  const violation = () => run([started('a'), started('b'), completed('a')]);

  it('should keep b’s evidence, record DEPENDENCY_ORDER_VIOLATION and apply the event once a is finished', () => {
    const before = run([started('a'), started('b')]);
    expect(before.steps.b).toMatchObject({ state: 'PENDING', reports: ['STEP_STARTED'] });
    expect(before.deferred).toHaveLength(1);
    expect(before.anomalies).toEqual([expect.objectContaining({ type: 'STEP_STARTED', code: 'DEPENDENCY_ORDER_VIOLATION' })]);

    const after = violation();
    expect(after.steps.b!.state).toBe('RUNNING');
    expect(after.deferred).toEqual([]);
    expect(after.anomalies.filter((item) => item.code === 'DEPENDENCY_ORDER_VIOLATION')).toHaveLength(1);
  });

  it('should not make the whole run NOT_VERIFIED by itself', () => {
    const state = [completed('b'), started('c'), completed('c'), verified('a'), verified('b'), verified('c')].reduce((current, item) => applyEvent(plan, current, item), violation());

    expect(result(state)).toMatchObject({ status: 'SUCCEEDED', anomalies: [expect.objectContaining({ code: 'DEPENDENCY_ORDER_VIOLATION' })] });
  });

  it('should never verify b before a succeeded', () => {
    const state = run([started('b'), completed('b'), verified('b')]);

    expect(state.steps.b!.state).toBe('PENDING');
    expect(state.deferred.map((item) => item.event.type)).toEqual(['STEP_STARTED', 'STEP_COMPLETED', 'STEP_COMPLETED']);
    expect(result(state).deferred).toHaveLength(3);
  });
});

describe('ADR-015: approvals', () => {
  it('should keep an ad-hoc approval request on a step that is not ready yet', () => {
    const state = run([approvalRequired('b')]);

    expect(state.steps.b).toMatchObject({ state: 'PENDING', pendingApproval: { reason: 'runs a migration' } });
    expect(state.anomalies).toEqual([]);
    expect(result(state).steps[1]!.approval).toEqual({ required: false, approved: false, pending: true });
  });

  it('should hold the step at the approval until the user resolves it', () => {
    const waiting = run([approvalRequired('b'), started('a'), completed('a'), started('b')]);
    expect(waiting.steps.b!.state).toBe('WAITING_FOR_APPROVAL');

    const refused = applyEvent(plan, waiting, completed('b'));
    expect(refused.anomalies.at(-1)!.reason).toBe('step cannot complete without approval');

    const byHost = applyEvent(plan, waiting, { ...approve('b'), source: 'host' });
    expect(byHost.steps.b!.pendingApproval).not.toBeNull();

    const approved = applyEvent(plan, waiting, approve('b'));
    expect(approved.steps.b).toMatchObject({ state: 'RUNNING', pendingApproval: null, approved: true });
  });

  it('should let independent steps finish while another step waits for approval', () => {
    const state = run([approvalRequired('c'), started('a'), completed('a'), started('b'), completed('b'), verified('a'), verified('b')]);

    expect(state.steps.a!.state).toBe('SUCCEEDED');
    expect(state.steps.b!.state).toBe('SUCCEEDED');
    expect(state.steps.c!.pendingApproval).not.toBeNull();
  });

  it('should keep the run from SUCCEEDED while an approval is pending, and name it', () => {
    const state = run([approvalRequired('c'), started('a'), completed('a'), started('b'), completed('b'), verified('a'), verified('b')]);
    const report = result(state);

    expect(report.status).toBe('NOT_VERIFIED');
    expect(report.reason).toMatch(/^approval pending: c; /);
  });

  it('should skip a step whose approval is declined and block its dependants', () => {
    const state = run([approvalRequired('a'), approve('a', false)]);

    expect(state.steps.a).toMatchObject({ state: 'SKIPPED', pendingApproval: null });
    expect(state.steps.b!.state).toBe('BLOCKED');
  });
});

describe('ADR-015: replay', () => {
  const log = () => [started('a'), started('b'), approvalRequired('c'), completed('a'), completed('b'), verified('b'), verified('a')];

  it('should rebuild the same state from the log, deferred events and anomalies included', () => {
    const events = log();
    const live = run(events);
    const restarted = replayEvents(plan, JSON.parse(JSON.stringify(events)) as ExecutionEvent[]);

    expect(restarted).toEqual(live);
    expect(live.steps.b!.state).toBe('SUCCEEDED');
    expect(live.anomalies.filter((item) => item.code === 'DEPENDENCY_ORDER_VIOLATION')).toHaveLength(1);
  });

  it('should not duplicate events, reports or anomalies when events are delivered twice', () => {
    const events = log();
    const once = run(events);
    const twice = events.reduce((state, item) => applyEvent(plan, state, item), once);

    expect(twice).toEqual(once);
    expect(twice.steps.b!.reports).toEqual(['STEP_STARTED', 'STEP_COMPLETED']);
  });
});

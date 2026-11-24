import type { GateStatus } from '../contracts';
import type { ExecutionEvent, ExecutionPlan, ExecutionState, ExecutionStep, GateOutcome, RunResult, RunResultStep, StepRecord, StepState } from './contracts';
import { EXECUTION_EVENT_TYPES, RESULT_RULES_VERSION, STEP_STATES } from './contracts';
import { assertApproved } from './plan';

/** States a step does not leave, except NOT_VERIFIED, which the orchestrator may verify later. */
const FINAL: ReadonlySet<StepState> = new Set(['SUCCEEDED', 'FAILED', 'BLOCKED', 'SKIPPED', 'CANCELLED', 'NOT_VERIFIED']);
/** Host step events that count as execution evidence once accepted. */
const EXECUTION_REPORTS: ReadonlySet<string> = new Set(['STEP_STARTED', 'STEP_PROGRESS', 'STEP_COMPLETED', 'STEP_FAILED']);
const OPEN: ReadonlySet<StepState> = new Set(['PENDING', 'READY', 'RUNNING', 'WAITING_FOR_APPROVAL']);
/** States that end a step without success; dependants of such a step become BLOCKED. */
const STOPPED: ReadonlySet<StepState> = new Set(['FAILED', 'BLOCKED', 'SKIPPED', 'CANCELLED']);
/** Host step events that need the step to be host-ready (ADR-015). */
const HOST_WORK: ReadonlySet<string> = new Set(['STEP_STARTED', 'STEP_PROGRESS', 'STEP_COMPLETED']);

type StepEvent = Extract<ExecutionEvent, { stepId: string }>;

function emptyStep(id: string): StepRecord {
  return { id, state: 'PENDING', reason: null, approved: false, gates: [], evidence: [], lastProgress: null, reports: [], hostCompleted: false, pendingApproval: null, history: [] };
}

/**
 * ADR-015, two readiness levels. Host-ready: every dependency SUCCEEDED or reported completed by the
 * host (and not stopped since); host work is accepted. Verified-ready: every dependency SUCCEEDED;
 * only then may the orchestrator's gate results be applied.
 */
function hostReady(state: ExecutionState, spec: ExecutionStep): boolean {
  return spec.dependsOn.every((id) => {
    const dep = state.steps[id]!;
    return dep.state === 'SUCCEEDED' || (dep.hostCompleted && !STOPPED.has(dep.state));
  });
}

function verifiedReady(state: ExecutionState, spec: ExecutionStep): boolean {
  return spec.dependsOn.every((id) => state.steps[id]!.state === 'SUCCEEDED');
}

function unverifiedDependencies(state: ExecutionState, spec: ExecutionStep): string {
  return spec.dependsOn.filter((id) => state.steps[id]!.state !== 'SUCCEEDED').join(', ');
}

/** Why an event cannot be applied yet (it is parked), or null when it can. */
function parkReason(state: ExecutionState, spec: ExecutionStep, step: StepRecord, event: StepEvent): { reason: string; violation: boolean } | null {
  if (event.type === 'STEP_COMPLETED' && event.source === 'orchestrator' && !verifiedReady(state, spec)) {
    return { reason: `verification waits until ${unverifiedDependencies(state, spec)} SUCCEEDED`, violation: false };
  }
  if (event.source === 'host' && HOST_WORK.has(event.type) && step.state === 'PENDING' && !hostReady(state, spec)) {
    return { reason: `${event.type} for ${spec.id} before ${unverifiedDependencies(state, spec)} was reported finished`, violation: true };
  }
  return null;
}

/** Host reports and evidence paths are kept as soon as they arrive, even while the event waits. */
function keepEvidence(step: StepRecord, event: StepEvent): void {
  if (event.source === 'host' && EXECUTION_REPORTS.has(event.type) && !step.reports.includes(event.type)) step.reports.push(event.type);
  if ((event.type === 'STEP_COMPLETED' || event.type === 'STEP_FAILED') && event.evidence.length) step.evidence = [...new Set([...step.evidence, ...event.evidence])];
}

/** Initial state of an approved plan revision; refuses unapproved or modified plans. */
export function createExecutionState(plan: ExecutionPlan): ExecutionState {
  const digest = assertApproved(plan);
  const state: ExecutionState = {
    schemaVersion: 'execution-state/v1',
    runId: plan.runId,
    planDigest: digest,
    revision: plan.revision,
    run: 'PENDING',
    runReason: null,
    steps: Object.fromEntries(plan.steps.map((step) => [step.id, emptyStep(step.id)])),
    processed: [],
    anomalies: [],
    deferred: [],
  };
  return refreshReadiness(plan, state);
}

function clone(state: ExecutionState): ExecutionState {
  return structuredClone(state);
}

function move(step: StepRecord, to: StepState, eventId: string, reason: string | null = step.reason): void {
  if (step.state !== to) step.history.push({ eventId, from: step.state, to });
  step.state = to;
  step.reason = reason;
}

/**
 * PENDING steps become READY when every dependency SUCCEEDED. A step that has not succeeded becomes
 * BLOCKED when a dependency stopped (FAILED, BLOCKED, SKIPPED, CANCELLED), whatever the host already
 * reported for it; its reports and evidence are kept (ADR-015). A NOT_VERIFIED dependency blocks
 * nothing: it may still be verified.
 */
function refreshReadiness(plan: ExecutionPlan, state: ExecutionState): ExecutionState {
  let changed = true;
  while (changed) {
    changed = false;
    for (const spec of plan.steps) {
      const step = state.steps[spec.id]!;
      if (step.state === 'SUCCEEDED' || STOPPED.has(step.state)) continue;
      const stopped = spec.dependsOn.map((id) => state.steps[id]!).find((dep) => STOPPED.has(dep.state));
      if (stopped) {
        move(step, 'BLOCKED', 'readiness', `dependency ${stopped.id} is ${stopped.state}`);
        changed = true;
      } else if (step.state === 'PENDING' && verifiedReady(state, spec)) {
        move(step, 'READY', 'readiness', null);
        changed = true;
      }
    }
  }
  return state;
}

/**
 * Step outcome from orchestrator-run gates: any FAIL fails, any missing or unverified gate is
 * NOT_VERIFIED. A step without its own gates is judged on the gates the orchestrator ran for it;
 * attached evidence paths alone never make a step succeed.
 */
function verifiedOutcome(stepGates: string[], gates: GateOutcome[]): { state: StepState; reason: string } {
  const required = stepGates.length > 0 ? stepGates : gates.map((result) => result.gate);
  if (required.length === 0) return { state: 'NOT_VERIFIED', reason: 'no gates were run for this step' };
  const outcome = required.map((gate) => gates.find((result) => result.gate === gate) ?? { gate, status: 'NOT_VERIFIED' as const, reason: 'gate result missing' });
  const failed = outcome.filter((result) => result.status === 'FAIL');
  if (failed.length) return { state: 'FAILED', reason: failed.map((result) => `${result.gate}: ${result.reason ?? 'FAIL'}`).join('; ') };
  const open = outcome.filter((result) => result.status !== 'PASS');
  if (open.length) return { state: 'NOT_VERIFIED', reason: open.map((result) => `${result.gate}: ${result.reason ?? 'NOT_VERIFIED'}`).join('; ') };
  return { state: 'SUCCEEDED', reason: `all gates passed: ${required.join(', ')}` };
}

type Apply = (step: StepRecord, spec: ExecutionPlan['steps'][number]) => string | null;

function stepHandler(event: StepEvent): Apply {
  const id = event.eventId;
  switch (event.type) {
    case 'STEP_STARTED':
    case 'STEP_PROGRESS':
      return (step, spec) => {
        // A host event on a PENDING step reaches this point only when the step is host-ready.
        if (step.state === 'PENDING' && event.source !== 'host') return 'dependencies are not satisfied';
        if (step.state === 'READY' || step.state === 'PENDING') {
          const needsApproval = (spec.approval === 'required' && !step.approved) || step.pendingApproval !== null;
          move(step, needsApproval ? 'WAITING_FOR_APPROVAL' : 'RUNNING', id, needsApproval ? 'step requires approval' : null);
        }
        if (event.type === 'STEP_PROGRESS') {
          if (step.state !== 'RUNNING') return `progress ignored in state ${step.state}`;
          step.lastProgress = event.message;
        }
        return FINAL.has(step.state) ? `step already ${step.state}` : null;
      };
    case 'APPROVAL_REQUIRED':
      // Accepted in every open state, PENDING included (ADR-015): an approval request is never lost.
      return (step) => {
        if (!OPEN.has(step.state)) return `approval request ignored in state ${step.state}`;
        step.approved = false;
        step.pendingApproval = { eventId: id, reason: event.reason };
        if (step.state === 'READY' || step.state === 'RUNNING') move(step, 'WAITING_FOR_APPROVAL', id, event.reason);
        return null;
      };
    case 'APPROVAL_RESOLVED':
      return (step) => {
        if (event.source !== 'user') return 'approvals are resolved by the user only';
        if (!event.approved) {
          if (!OPEN.has(step.state)) return `decline ignored in state ${step.state}`;
          step.pendingApproval = null;
          move(step, 'SKIPPED', id, `approval declined by ${event.by}`);
          return null;
        }
        step.approved = true;
        step.pendingApproval = null;
        if (step.state === 'WAITING_FOR_APPROVAL') move(step, 'RUNNING', id, `approved by ${event.by}`);
        return null;
      };
    case 'STEP_COMPLETED':
      return (step, spec) => {
        const reverify = step.state === 'NOT_VERIFIED' && event.source === 'orchestrator';
        if (step.state === 'PENDING' && event.source !== 'host') return 'dependencies are not satisfied';
        if (step.state === 'WAITING_FOR_APPROVAL' || (spec.approval === 'required' && !step.approved) || step.pendingApproval) return 'step cannot complete without approval';
        if (FINAL.has(step.state) && !reverify) return `step already ${step.state}`;
        step.evidence = [...new Set([...step.evidence, ...event.evidence])];
        if (event.source !== 'orchestrator') {
          if (event.source === 'host') step.hostCompleted = true;
          move(step, 'NOT_VERIFIED', id, `${event.source} reported completion; awaiting orchestrator verification`);
          return null;
        }
        step.gates = event.gates;
        const outcome = verifiedOutcome(spec.verification, event.gates);
        move(step, outcome.state, id, outcome.reason);
        return null;
      };
    case 'STEP_FAILED':
      return (step) => {
        if (FINAL.has(step.state) && step.state !== 'NOT_VERIFIED') return `step already ${step.state}`;
        step.evidence = [...new Set([...step.evidence, ...event.evidence])];
        move(step, 'FAILED', id, event.reason);
        return null;
      };
    case 'STEP_BLOCKED':
      return (step) => {
        if (!OPEN.has(step.state)) return `step already ${step.state}`;
        move(step, 'BLOCKED', id, event.reason);
        return null;
      };
  }
}

function applyRunEvent(state: ExecutionState, event: Exclude<ExecutionEvent, { stepId: string }>): string | null {
  if (state.run === 'CANCELLED' || state.run === 'FAILED') return `run already ${state.run}`;
  switch (event.type) {
    case 'RUN_STARTED':
      if (state.run === 'PENDING') state.run = 'RUNNING';
      return null;
    case 'RUN_COMPLETED':
      state.run = 'HOST_COMPLETED';
      return null;
    case 'RUN_FAILED':
    case 'RUN_CANCELLED': {
      const cancelled = event.type === 'RUN_CANCELLED';
      state.run = cancelled ? 'CANCELLED' : 'FAILED';
      state.runReason = event.reason;
      for (const step of Object.values(state.steps)) {
        if (OPEN.has(step.state)) move(step, cancelled ? 'CANCELLED' : 'BLOCKED', event.eventId, `run ${cancelled ? 'cancelled' : 'failed'}: ${event.reason}`);
      }
      return null;
    }
  }
}

function isExecutionEvent(value: unknown): value is ExecutionEvent {
  const raw = value as Record<string, unknown> | null;
  return typeof raw === 'object' && raw !== null && typeof raw.eventId === 'string' && EXECUTION_EVENT_TYPES.includes(raw.type as ExecutionEvent['type']);
}

/** Best-effort id and type of something that is not a valid event, for the anomaly list. */
function anomalyIdentity(value: unknown): { eventId: string; type: string } {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const text = (field: unknown, fallback: string) => (typeof field === 'string' && field ? field : fallback);
  return { eventId: text(raw.eventId, 'unknown'), type: text(raw.type, 'UNKNOWN') };
}

/** Every step that did not succeed carries a reason, even when the reporter gave none. */
function finalReason(step: StepRecord, open: boolean): string | null {
  if (open) return `no final result (state ${step.state})`;
  if (step.state === 'SUCCEEDED') return step.reason;
  return step.reason || `${step.state} (no reason recorded)`;
}

/**
 * Applies one event (W2.1-09). Idempotent: a repeated event id is a no-op. Events for another plan
 * revision, unknown steps, or impossible transitions are recorded as anomalies and change nothing.
 */
export function applyEvent(plan: ExecutionPlan, current: ExecutionState, event: ExecutionEvent): ExecutionState {
  // Lines read from events.jsonl are untyped: anything that is not an event is recorded, never applied.
  if (!isExecutionEvent(event)) {
    const state = clone(current);
    state.anomalies.push({ ...anomalyIdentity(event), reason: 'not an execution event' });
    return state;
  }
  if (current.processed.includes(event.eventId)) return current;
  const state = clone(current);
  state.processed.push(event.eventId);
  const reject = (reason: string) => {
    state.anomalies.push({ eventId: event.eventId, type: event.type, reason });
    return state;
  };
  if (event.runId !== state.runId) return reject(`event for run ${event.runId}`);
  if (event.planDigest !== state.planDigest) return reject('event for a different plan revision');

  if (!('stepId' in event)) {
    const problem = applyRunEvent(state, event);
    return problem ? reject(problem) : drainDeferred(plan, refreshReadiness(plan, state));
  }
  const spec = plan.steps.find((step) => step.id === event.stepId);
  const step = state.steps[event.stepId];
  if (!spec || !step) return reject(`unknown step ${event.stepId}`);
  if (state.run === 'CANCELLED') return reject('run is cancelled');
  const park = parkReason(state, spec, step, event);
  if (park) {
    state.deferred.push({ event, reason: park.reason });
    if (park.violation) state.anomalies.push({ eventId: event.eventId, type: event.type, code: 'DEPENDENCY_ORDER_VIOLATION', reason: park.reason });
    keepEvidence(step, event);
    return state;
  }
  applyStepEvent(state, spec, step, event);
  return drainDeferred(plan, refreshReadiness(plan, state));
}

function applyStepEvent(state: ExecutionState, spec: ExecutionStep, step: StepRecord, event: StepEvent): void {
  const problem = stepHandler(event)(step, spec);
  if (problem) state.anomalies.push({ eventId: event.eventId, type: event.type, reason: problem });
  else keepEvidence(step, event);
}

/** A parked event can be applied once its step is still open-ended and no longer has a reason to wait. */
function readyToApply(plan: ExecutionPlan, state: ExecutionState, event: ExecutionEvent): event is StepEvent {
  if (!('stepId' in event)) return false;
  const step = state.steps[event.stepId]!;
  if (step.state === 'SUCCEEDED' || STOPPED.has(step.state)) return false;
  return parkReason(state, specOf(plan, event.stepId), step, event) === null;
}

/**
 * Retries parked events in log order after a state change and applies the first one that now can
 * be, until none can (ADR-015). Events for a step that already ended stay parked and are reported.
 */
function drainDeferred(plan: ExecutionPlan, state: ExecutionState): ExecutionState {
  while (state.run !== 'CANCELLED') {
    const index = state.deferred.findIndex(({ event }) => readyToApply(plan, state, event));
    if (index === -1) break;
    const event = state.deferred.splice(index, 1)[0]!.event as StepEvent;
    applyStepEvent(state, specOf(plan, event.stepId), state.steps[event.stepId]!, event);
    refreshReadiness(plan, state);
  }
  return state;
}

function specOf(plan: ExecutionPlan, stepId: string): ExecutionStep {
  return plan.steps.find((item) => item.id === stepId)!;
}

export function replayEvents(plan: ExecutionPlan, events: readonly ExecutionEvent[]): ExecutionState {
  return events.reduce((state, event) => applyEvent(plan, state, event), createExecutionState(plan));
}

/** Steps the orchestrator may start now. */
export function readySteps(state: ExecutionState): string[] {
  return Object.values(state.steps).filter((step) => step.state === 'READY').map((step) => step.id);
}

/**
 * Final report: every step is accounted for. A run SUCCEEDS only when every step SUCCEEDED;
 * cancelled is never success; open steps are reported as NOT_VERIFIED.
 */
export function reconcile(plan: ExecutionPlan, state: ExecutionState, generatedAt: string): RunResult {
  const steps = plan.steps.map((spec): RunResultStep => {
    const step = state.steps[spec.id]!;
    const open = OPEN.has(step.state);
    return {
      id: spec.id,
      capability: spec.capability,
      agent: spec.agent,
      state: step.state,
      final: open ? 'NOT_VERIFIED' : (step.state as RunResultStep['final']),
      reason: finalReason(step, open),
      approval: { required: spec.approval === 'required', approved: step.approved, pending: step.pendingApproval !== null },
      gates: step.gates,
      evidence: step.evidence,
      execution: { evidenced: step.reports.length > 0, reports: [...step.reports] },
    };
  });
  const counts = Object.fromEntries(STEP_STATES.map((name) => [name, steps.filter((step) => step.final === name).length])) as RunResult['counts'];
  const failed = steps.filter((step) => step.final === 'FAILED');
  let status: RunResult['status'];
  let reason: string;
  if (state.run === 'CANCELLED') [status, reason] = ['CANCELLED', `run cancelled: ${state.runReason}`];
  else if (failed.length || state.run === 'FAILED') [status, reason] = ['FAILED', state.runReason ?? `failed steps: ${failed.map((step) => step.id).join(', ')}`];
  else if (steps.every((step) => step.final === 'SUCCEEDED')) {
    const unevidenced = steps.filter((step) => !step.execution.evidenced).map((step) => step.id);
    [status, reason] = unevidenced.length
      ? ['OUTCOME_VERIFIED', `every step passed its gates, but no execution was reported for: ${unevidenced.join(', ')}`]
      : ['SUCCEEDED', 'every step was reported executed and passed its gates'];
  }
  else [status, reason] = ['NOT_VERIFIED', `unverified steps: ${steps.filter((step) => step.final !== 'SUCCEEDED').map((step) => `${step.id} (${step.final})`).join(', ')}`];
  // ADR-015: a pending approval anywhere keeps the run from SUCCEEDED and is always named.
  const pending = steps.filter((step) => step.approval.pending).map((step) => step.id);
  if (pending.length && (status === 'SUCCEEDED' || status === 'OUTCOME_VERIFIED')) status = 'NOT_VERIFIED';
  if (pending.length) reason = `approval pending: ${pending.join(', ')}; ${reason}`;
  const gates = { PASS: 0, FAIL: 0, NOT_VERIFIED: 0 } as Record<GateStatus, number>;
  for (const outcome of steps.flatMap((step) => step.gates)) gates[outcome.status] += 1;
  return {
    schemaVersion: 'run-result/v1',
    rulesVersion: RESULT_RULES_VERSION,
    runId: plan.runId,
    planId: plan.planId,
    planDigest: state.planDigest,
    revision: plan.revision,
    project: plan.project,
    profile: plan.profile,
    generatedAt,
    // assertApproved (createExecutionState) guarantees both are set.
    approval: { by: plan.approval.by!, at: plan.approval.at! },
    status,
    reason,
    run: state.run,
    steps,
    counts,
    verification: { stepsTotal: steps.length, stepsSucceeded: counts.SUCCEEDED, stepsWithExecutionEvidence: steps.filter((step) => step.execution.evidenced).length, gates },
    anomalies: state.anomalies,
    deferred: state.deferred.map(({ event, reason: why }) => ({ eventId: event.eventId, type: event.type, stepId: 'stepId' in event ? event.stepId : '', reason: why })),
  };
}

import type { ExecutionEvent, ExecutionPlan, ExecutionState, GateOutcome, RunResult, StepRecord, StepState } from './contracts';
import { STEP_STATES } from './contracts';
import { assertApproved } from './plan';

/** States a step does not leave, except NOT_VERIFIED, which the orchestrator may verify later. */
const FINAL: ReadonlySet<StepState> = new Set(['SUCCEEDED', 'FAILED', 'BLOCKED', 'SKIPPED', 'CANCELLED', 'NOT_VERIFIED']);
const OPEN: ReadonlySet<StepState> = new Set(['PENDING', 'READY', 'RUNNING', 'WAITING_FOR_APPROVAL']);

function emptyStep(id: string): StepRecord {
  return { id, state: 'PENDING', reason: null, approved: false, gates: [], evidence: [], lastProgress: null, history: [] };
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
 * PENDING steps become READY when every dependency SUCCEEDED and BLOCKED when one can no longer
 * succeed. A NOT_VERIFIED dependency keeps them PENDING: it may still be verified.
 */
function refreshReadiness(plan: ExecutionPlan, state: ExecutionState): ExecutionState {
  let changed = true;
  while (changed) {
    changed = false;
    for (const spec of plan.steps) {
      const step = state.steps[spec.id]!;
      if (step.state !== 'PENDING') continue;
      const deps = spec.dependsOn.map((id) => state.steps[id]!);
      const stopped = deps.find((dep) => FINAL.has(dep.state) && dep.state !== 'SUCCEEDED' && dep.state !== 'NOT_VERIFIED');
      if (stopped) {
        move(step, 'BLOCKED', 'readiness', `dependency ${stopped.id} is ${stopped.state}`);
        changed = true;
      } else if (deps.every((dep) => dep.state === 'SUCCEEDED')) {
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

function stepHandler(event: Extract<ExecutionEvent, { stepId: string }>): Apply {
  const id = event.eventId;
  switch (event.type) {
    case 'STEP_STARTED':
    case 'STEP_PROGRESS':
      return (step, spec) => {
        if (step.state === 'PENDING') return 'dependencies are not satisfied';
        if (step.state === 'READY') {
          const needsApproval = spec.approval === 'required' && !step.approved;
          move(step, needsApproval ? 'WAITING_FOR_APPROVAL' : 'RUNNING', id, needsApproval ? 'step requires approval' : null);
        }
        if (event.type === 'STEP_PROGRESS') {
          if (step.state !== 'RUNNING') return `progress ignored in state ${step.state}`;
          step.lastProgress = event.message;
        }
        return FINAL.has(step.state) ? `step already ${step.state}` : null;
      };
    case 'APPROVAL_REQUIRED':
      return (step) => {
        if (step.state !== 'READY' && step.state !== 'RUNNING') return `approval request ignored in state ${step.state}`;
        step.approved = false;
        move(step, 'WAITING_FOR_APPROVAL', id, event.reason);
        return null;
      };
    case 'APPROVAL_RESOLVED':
      return (step) => {
        if (event.source !== 'user') return 'approvals are resolved by the user only';
        if (!event.approved) {
          if (!OPEN.has(step.state)) return `decline ignored in state ${step.state}`;
          move(step, 'SKIPPED', id, `approval declined by ${event.by}`);
          return null;
        }
        step.approved = true;
        if (step.state === 'WAITING_FOR_APPROVAL') move(step, 'RUNNING', id, `approved by ${event.by}`);
        return null;
      };
    case 'STEP_COMPLETED':
      return (step, spec) => {
        const reverify = step.state === 'NOT_VERIFIED' && event.source === 'orchestrator';
        if (step.state === 'PENDING') return 'dependencies are not satisfied';
        if (step.state === 'WAITING_FOR_APPROVAL' || (spec.approval === 'required' && !step.approved)) return 'step cannot complete without approval';
        if (FINAL.has(step.state) && !reverify) return `step already ${step.state}`;
        step.evidence = [...new Set([...step.evidence, ...event.evidence])];
        if (event.source !== 'orchestrator') {
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

/**
 * Applies one event (W2.1-09). Idempotent: a repeated event id is a no-op. Events for another plan
 * revision, unknown steps, or impossible transitions are recorded as anomalies and change nothing.
 */
export function applyEvent(plan: ExecutionPlan, current: ExecutionState, event: ExecutionEvent): ExecutionState {
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
    return problem ? reject(problem) : refreshReadiness(plan, state);
  }
  const spec = plan.steps.find((step) => step.id === event.stepId);
  const step = state.steps[event.stepId];
  if (!spec || !step) return reject(`unknown step ${event.stepId}`);
  if (state.run === 'CANCELLED') return reject('run is cancelled');
  const problem = stepHandler(event)(step, spec);
  if (problem) reject(problem);
  return refreshReadiness(plan, state);
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
export function reconcile(plan: ExecutionPlan, state: ExecutionState): RunResult {
  const steps = plan.steps.map((spec) => {
    const step = state.steps[spec.id]!;
    const open = OPEN.has(step.state);
    return {
      id: spec.id,
      state: step.state,
      final: open ? ('NOT_VERIFIED' as const) : step.state,
      reason: open ? `no final result (state ${step.state})` : step.reason,
      gates: step.gates,
      evidence: step.evidence,
    };
  });
  const counts = Object.fromEntries(STEP_STATES.map((name) => [name, steps.filter((step) => step.final === name).length])) as RunResult['counts'];
  const failed = steps.filter((step) => step.final === 'FAILED');
  let status: RunResult['status'];
  let reason: string;
  if (state.run === 'CANCELLED') [status, reason] = ['CANCELLED', `run cancelled: ${state.runReason}`];
  else if (failed.length || state.run === 'FAILED') [status, reason] = ['FAILED', state.runReason ?? `failed steps: ${failed.map((step) => step.id).join(', ')}`];
  else if (steps.every((step) => step.final === 'SUCCEEDED')) [status, reason] = ['SUCCEEDED', 'every step succeeded with verified evidence'];
  else [status, reason] = ['NOT_VERIFIED', `unverified steps: ${steps.filter((step) => step.final !== 'SUCCEEDED').map((step) => `${step.id} (${step.final})`).join(', ')}`];
  return { schemaVersion: 'run-result/v1', runId: plan.runId, planDigest: state.planDigest, revision: plan.revision, status, reason, steps, counts, anomalies: state.anomalies };
}

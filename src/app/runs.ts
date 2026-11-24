import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeCodeDelivery } from '../adapters/claude-code';
import { codexDelivery } from '../adapters/codex';
import type { HostDelivery, Invocation } from '../adapters/common/delivery';
import {
  applyEvent,
  approveExecutionPlan,
  assertApproved,
  createExecutionPlan,
  createExecutionState,
  reconcile,
  renderExecutionPlan,
  type ExecutionEvent,
  type ExecutionPlan,
  type ExecutionState,
  type GateOutcome,
  type RunResult,
} from '../core/execution';
import { SchemaValidator } from '../registry';
import { redactValue } from '../shared/redact';
import { runQualityGates } from './gates';
import { readPlan } from './plan';
import { assertRunId, newRunId, projectIdentity, readJsonLines, RUNS_DIR, runDir, writeJson } from './run-files';

const PACKAGE_ROOT = join(__dirname, '..', '..');
const DELIVERIES: Record<string, HostDelivery> = { 'claude-code': claudeCodeDelivery, codex: codexDelivery };

function files(root: string, runId: string) {
  const dir = join(root, RUNS_DIR, assertRunId(runId));
  return {
    dir,
    plan: join(dir, 'execution-plan.json'),
    planMd: join(dir, 'execution-plan.md'),
    state: join(dir, 'execution-state.json'),
    events: join(dir, 'events.jsonl'),
    result: join(dir, 'result.json'),
  };
}

export function readExecutionPlan(root: string, runId: string): ExecutionPlan {
  const file = files(root, runId).plan;
  if (!existsSync(file)) throw new Error(`No run "${runId}" in ${RUNS_DIR}`);
  return JSON.parse(readFileSync(file, 'utf8')) as ExecutionPlan;
}

function writePlan(root: string, plan: ExecutionPlan): void {
  const paths = files(root, plan.runId);
  writeJson(paths.plan, plan);
  writeFileSync(paths.planMd, renderExecutionPlan(plan));
}

/** Creates a run from a saved plan: revision 1, pending approval. */
export function createRun(root: string, planId: string, now: Date = new Date()): ExecutionPlan {
  const runId = newRunId(now);
  runDir(root, runId);
  const identity = projectIdentity(root);
  const plan = createExecutionPlan(readPlan(root, planId), { runId, project: { name: identity.name, commit: identity.commit } });
  writePlan(root, plan);
  return plan;
}

/** Approves the current revision (immutable from now on) and starts an empty event log. */
export function approveRun(root: string, runId: string, by: string, now: Date = new Date()): ExecutionPlan {
  const plan = approveExecutionPlan(readExecutionPlan(root, runId), by, now.toISOString());
  writePlan(root, plan);
  const paths = files(root, runId);
  writeFileSync(paths.events, '');
  writeJson(paths.state, createExecutionState(plan));
  return plan;
}

/** State is rebuilt from the event log, so it survives restarts and a lost or stale state file. */
export function loadRun(root: string, runId: string): { plan: ExecutionPlan; state: ExecutionState } {
  const plan = readExecutionPlan(root, runId);
  assertApproved(plan);
  const { items, badLines } = readJsonLines<ExecutionEvent>(files(root, runId).events);
  const state = items.reduce((current, event) => applyEvent(plan, current, event), createExecutionState(plan));
  // Unreadable lines are surfaced in the report; they are never guessed into events.
  for (const line of badLines) state.anomalies.push({ eventId: `events.jsonl:${line}`, type: 'UNREADABLE', reason: 'line is not valid JSON' });
  return { plan, state };
}

export type EventInput = { type: ExecutionEvent['type']; source: ExecutionEvent['source'] } & Record<string, unknown>;

/** Appends one event (redacted) and rewrites the state snapshot. */
export function recordEvent(root: string, runId: string, input: EventInput, now: Date = new Date()): ExecutionState {
  const { plan, state } = loadRun(root, runId);
  const event = redactValue({
    eventId: `evt-${randomBytes(6).toString('hex')}`,
    runId,
    planDigest: state.planDigest,
    at: now.toISOString(),
    ...input,
  }) as ExecutionEvent;
  const next = applyEvent(plan, state, event);
  appendFileSync(files(root, runId).events, `${JSON.stringify(event)}\n`);
  writeJson(files(root, runId).state, next);
  return next;
}

const RUN_RESULT_SCHEMA = 'urn:ai-agent-setup:contracts:v1:run-result';

type Validate = (value: unknown) => { valid: boolean; errors: string[] };

/**
 * A result that fails the run-result contract is never reported as it stands: SUCCEEDED and
 * OUTCOME_VERIFIED become NOT_VERIFIED with the validation errors (FAILED and CANCELLED are kept: they are not success). If
 * the result is still invalid, nothing is written and the error is raised.
 */
/** What JSON Schema cannot express: totals that must agree with the step list. */
export function consistencyErrors(result: RunResult): string[] {
  const errors: string[] = [];
  const finals = result.steps.map((step) => step.final);
  for (const [state, count] of Object.entries(result.counts)) {
    const actual = finals.filter((final) => final === state).length;
    if (count !== actual) errors.push(`/counts/${state}: ${count} but ${actual} step(s) are ${state}`);
  }
  if (result.verification.stepsTotal !== result.steps.length) errors.push(`/verification/stepsTotal: ${result.verification.stepsTotal} but ${result.steps.length} step(s)`);
  if (result.verification.stepsSucceeded !== result.counts.SUCCEEDED) errors.push('/verification/stepsSucceeded: does not match counts.SUCCEEDED');
  const evidenced = result.steps.filter((step) => step.execution.evidenced).length;
  if (result.verification.stepsWithExecutionEvidence !== evidenced) errors.push(`/verification/stepsWithExecutionEvidence: ${result.verification.stepsWithExecutionEvidence} but ${evidenced} step(s) have execution evidence`);
  for (const [status, count] of Object.entries(result.verification.gates)) {
    const actual = result.steps.flatMap((step) => step.gates).filter((gate) => gate.status === status).length;
    if (count !== actual) errors.push(`/verification/gates/${status}: ${count} but ${actual} gate result(s)`);
  }
  return errors;
}

export function checkedRunResult(result: RunResult, validateSchema: Validate): RunResult {
  const validate: Validate = (value) => {
    const check = validateSchema(value);
    const errors = [...check.errors, ...(check.valid ? consistencyErrors(value as RunResult) : [])];
    return { valid: errors.length === 0, errors };
  };
  const check = validate(result);
  if (check.valid) return result;
  const status = result.status === 'SUCCEEDED' || result.status === 'OUTCOME_VERIFIED' ? 'NOT_VERIFIED' : result.status;
  const downgraded = { ...result, status, reason: `result failed contract validation: ${check.errors.join('; ')}` };
  const recheck = validate(downgraded);
  if (!recheck.valid) throw new Error(`Run result for ${result.runId} is invalid: ${recheck.errors.join('; ')}`);
  return downgraded;
}

/** Reconciles every step, checks the result against the contract and writes result.json. */
export function finishRun(root: string, runId: string, now: Date = new Date()): RunResult {
  return reportRun(root, runId, now).result;
}

export interface RunReport {
  result: RunResult;
  /** How the result differs from the previous result.json (for example after a rules change). */
  changes: string[];
}

/** What changed between the previous report and this one; an older file may use older rules. */
export function resultChanges(previous: unknown, next: RunResult): string[] {
  if (typeof previous !== 'object' || previous === null) return [];
  const old = previous as { rulesVersion?: number; status?: string; steps?: Array<{ id?: string; final?: string }> };
  const changes: string[] = [];
  const oldRules = old.rulesVersion ?? 1;
  if (oldRules !== next.rulesVersion) changes.push(`rules ${oldRules} → ${next.rulesVersion} (recomputed from the event log)`);
  if (old.status !== next.status) changes.push(`status ${old.status ?? 'none'} → ${next.status}`);
  for (const step of next.steps) {
    const before = old.steps?.find((item) => item.id === step.id)?.final;
    if (before !== undefined && before !== step.final) changes.push(`${step.id} ${before} → ${step.final}`);
  }
  return changes;
}

/** Reconciles every step, checks the result against the contract and writes result.json. */
export function reportRun(root: string, runId: string, now: Date = new Date()): RunReport {
  const { plan, state } = loadRun(root, runId);
  const validator = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas'));
  const result = checkedRunResult(reconcile(plan, state, now.toISOString()), (value) => validator.validate(RUN_RESULT_SCHEMA, value));
  const file = files(root, runId).result;
  let previous: unknown = null;
  try {
    previous = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as unknown) : null;
  } catch {
    previous = null; // An unreadable previous result is replaced; the event log is the source of truth.
  }
  writeJson(file, result);
  return { result, changes: resultChanges(previous, result) };
}

/**
 * Runs a step's verification gates and records the orchestrator's verdict (W2.1-09). A step
 * without its own gates is verified against the profile's required gates.
 */
export async function verifyStep(root: string, runId: string, stepId: string, now: () => Date = () => new Date()): Promise<{ state: ExecutionState; gates: GateOutcome[] }> {
  const { plan, state } = loadRun(root, runId);
  const step = plan.steps.find((item) => item.id === stepId);
  if (!step) throw new Error(`Run ${runId} has no step "${stepId}"`);
  // ADR-015: no gate runs for a step before its dependencies SUCCEEDED or while an approval is pending.
  const unverified = step.dependsOn.filter((id) => state.steps[id]!.state !== 'SUCCEEDED');
  if (unverified.length) throw new Error(`${stepId} depends on ${unverified.map((id) => `${id} (${state.steps[id]!.state})`).join(', ')}; verify the dependencies first`);
  const record = state.steps[stepId]!;
  if (record.pendingApproval || (step.approval === 'required' && !record.approved)) throw new Error(`${stepId} waits for the user's approval (run approve-step ${runId} ${stepId})`);
  const outcome = await runQualityGates({ root, runId, gates: step.verification, profileId: plan.profile, now });
  const verification = step.verification.length > 0 ? step.verification : outcome.report.required;
  const records = outcome.report.records.filter((record) => verification.includes(record.gate));
  const gates = records.map((record) => ({ gate: record.gate, status: record.status, reason: record.reason }));
  const evidence = records.map((record) => `${outcome.recordsDir}/${record.gate}.json`);
  const next = recordEvent(root, runId, { type: 'STEP_COMPLETED', source: 'orchestrator', stepId, gates, evidence }, now());
  return { state: next, gates };
}

export function hostAvailable(executable: string): boolean {
  const probe = process.platform === 'win32' ? spawnSync('where.exe', [executable], { stdio: 'ignore' }) : spawnSync('sh', ['-c', `command -v ${executable}`], { stdio: 'ignore' });
  return probe.status === 0;
}

export interface DeliveryOutcome {
  host: string;
  invocation: Invocation;
  /** NOT_VERIFIED when the host CLI is missing or its stream gave no run-level signal. */
  status: 'DELIVERED' | 'DRY_RUN' | 'NOT_VERIFIED';
  reason: string;
  signals: number;
}

/** Delivers the approved revision to a host CLI and records its run-level signals (W2.1-10). */
export async function deliverRun(root: string, runId: string, host: string, options: { dryRun?: boolean; eventCommand?: string } = {}): Promise<DeliveryOutcome> {
  const delivery = DELIVERIES[host];
  if (!delivery) throw new Error(`Unknown host "${host}"; use claude-code or codex`);
  const { plan, state } = loadRun(root, runId);
  if (state.run === 'CANCELLED' || state.run === 'FAILED') throw new Error(`Run ${runId} is ${state.run}; create a new run to deliver again`);
  const invocation = delivery.invocation(plan, {
    planPath: `${RUNS_DIR}/${runId}/execution-plan.json`,
    eventCommand: options.eventCommand ?? `npx create-ai-agent-setup run event ${runId}`,
  });
  if (options.dryRun) return { host, invocation, status: 'DRY_RUN', reason: 'not executed', signals: 0 };
  if (!hostAvailable(delivery.executable)) {
    return { host, invocation, status: 'NOT_VERIFIED', reason: `${delivery.executable} is not on PATH; install and sign in to ${host}, then deliver again`, signals: 0 };
  }
  recordEvent(root, runId, { type: 'RUN_STARTED', source: 'orchestrator' });
  const child = spawn(invocation.executable, invocation.args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  let signals = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const signal = delivery.parseLine(line);
    if (!signal) return;
    signals += 1;
    if (signal.kind === 'completed') recordEvent(root, runId, { type: 'RUN_COMPLETED', source: 'host' });
    if (signal.kind === 'failed') recordEvent(root, runId, { type: 'RUN_FAILED', source: 'host', reason: signal.reason });
  });
  const spawnError = await new Promise<string | null>((resolve) => {
    child.on('error', (error) => resolve(error.message));
    child.on('close', () => resolve(null));
  });
  const exitCode = child.exitCode;
  if (spawnError) {
    recordEvent(root, runId, { type: 'RUN_FAILED', source: 'orchestrator', reason: `could not start ${delivery.executable}: ${spawnError}` });
    return { host, invocation, status: 'NOT_VERIFIED', reason: `could not start ${delivery.executable}: ${spawnError}`, signals };
  }
  if (signals === 0) return { host, invocation, status: 'NOT_VERIFIED', reason: `no run-level events in the ${host} stream (exit code ${exitCode}); progress unknown`, signals };
  return { host, invocation, status: 'DELIVERED', reason: `exit code ${exitCode}; steps are verified separately`, signals };
}

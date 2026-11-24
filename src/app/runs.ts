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
import { redactValue } from '../shared/redact';
import { runQualityGates } from './gates';
import { readPlan } from './plan';
import { assertRunId, newRunId, projectIdentity, readJsonLines, RUNS_DIR, runDir, writeJson } from './run-files';

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

/** Reconciles every step and writes result.json. */
export function finishRun(root: string, runId: string): RunResult {
  const { plan, state } = loadRun(root, runId);
  const result = reconcile(plan, state);
  writeJson(files(root, runId).result, result);
  return result;
}

/**
 * Runs a step's verification gates and records the orchestrator's verdict (W2.1-09). A step
 * without its own gates is verified against the profile's required gates.
 */
export async function verifyStep(root: string, runId: string, stepId: string, now: () => Date = () => new Date()): Promise<{ state: ExecutionState; gates: GateOutcome[] }> {
  const { plan } = loadRun(root, runId);
  const step = plan.steps.find((item) => item.id === stepId);
  if (!step) throw new Error(`Run ${runId} has no step "${stepId}"`);
  const outcome = await runQualityGates({ root, runId, gates: step.verification, profileId: plan.profile, now });
  const verification = step.verification.length > 0 ? step.verification : outcome.report.required;
  const records = outcome.report.records.filter((record) => verification.includes(record.gate));
  const gates = records.map((record) => ({ gate: record.gate, status: record.status, reason: record.reason }));
  const evidence = records.map((record) => `${outcome.recordsDir}/${record.gate}.json`);
  const state = recordEvent(root, runId, { type: 'STEP_COMPLETED', source: 'orchestrator', stepId, gates, evidence }, now());
  return { state, gates };
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

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeCodeDelivery } from '../adapters/claude-code';
import { codexDelivery } from '../adapters/codex';
import type { HostDelivery, HostSignal, Invocation } from '../adapters/common/delivery';
import {
  applyEvent,
  approveExecutionPlan,
  assertApproved,
  createExecutionPlan,
  createExecutionState,
  reconcile,
  renderExecutionPlan,
  type Anomaly,
  type ExecutionEvent,
  type ExecutionPlan,
  type ExecutionState,
  type GateOutcome,
  type RunResult,
} from '../core/execution';
import { SchemaValidator } from '../registry';
import type { IsolationProfile, NetworkPolicy, PreparedLaunch } from '../core/isolation';
import { UsageMeter, type HostUsage } from '../core/evaluation';
import { ProcessTree, RUN_MARK_ENV } from '../isolation';
import { killTree } from '../quality';
import { redactText, redactValue } from '../shared/redact';
import {
  approvalPayload,
  eventPayload,
  INTEGRITY_SCHEME,
  keyDirectory,
  mac,
  macMatches,
  projectKey,
  readProjectKey,
  legacyRuns,
  readRunHead,
  sha256File,
  withRunLock,
  writeRunHead,
  type ProjectKey,
} from './integrity';
import { runQualityGates } from './gates';
import { INBOX_ENV, inboxEvent, prepareIsolatedLaunch, readInbox, resolveExecutable } from './isolation';
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
    integrity: join(dir, 'integrity.json'),
    signatures: join(dir, 'integrity.jsonl'),
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

/**
 * Approves the current revision (immutable from now on), signs the approval with the project key
 * (ADR-016) and starts an empty event log.
 */
export function approveRun(root: string, runId: string, by: string, now: Date = new Date()): ExecutionPlan {
  const plan = approveExecutionPlan(readExecutionPlan(root, runId), by, now.toISOString());
  const key = projectKey(root, now, approvedRunIds(root).filter((id) => id !== runId));
  const paths = files(root, runId);
  writePlan(root, plan);
  writeJson(paths.integrity, { scheme: INTEGRITY_SCHEME, keyId: key.keyId, approval: mac(key.key, approvalPayload(signedApproval(plan))) });
  writeFileSync(paths.events, '');
  writeFileSync(paths.signatures, '');
  writeRunHead(key, runId, { count: 0, last: null });
  writeJson(paths.state, createExecutionState(plan));
  return plan;
}

function signedApproval(plan: ExecutionPlan) {
  return { runId: plan.runId, revision: plan.revision, digest: plan.approval.digest!, by: plan.approval.by!, at: plan.approval.at! };
}

interface SignatureEntry {
  seq: number;
  eventId: string;
  mac: string;
  files?: Record<string, string>;
}

export interface RunSigning {
  signed: boolean;
  scheme: string | null;
}

/** Runs whose plan is approved, read from the project (used once, when the project key is created). */
function approvedRunIds(root: string): string[] {
  const dir = join(root, RUNS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    try {
      return /^run-/.test(name) && (JSON.parse(readFileSync(join(dir, name, 'execution-plan.json'), 'utf8')) as ExecutionPlan).approval.status === 'approved';
    } catch {
      return false;
    }
  });
}

/**
 * Once the project has a key, every run must be signed except the runs approved before the key
 * existed, whose list is kept with the key (outside the project). Nothing inside the project, such as
 * deleting integrity.json or choosing an old-looking run id, can make a run count as unsigned.
 */
function mustBeSigned(root: string, runId: string, key: ProjectKey | null): boolean {
  // integrity.json still counts: without the key (deleted or moved) a signed run must not pass as unsigned.
  return existsSync(files(root, runId).integrity) || (key !== null && !legacyRuns(key).includes(runId));
}

/**
 * State is rebuilt from the event log, so it survives restarts and a lost or stale state file. For a
 * signed run (ADR-016), only events with a valid signature are applied; anything unsigned, changed,
 * removed or truncated, and evidence that changed since it was recorded, becomes an
 * INTEGRITY_VIOLATION anomaly. A plan or approval changed outside the toolkit is refused.
 */
export function loadRun(root: string, runId: string): { plan: ExecutionPlan; state: ExecutionState; signing: RunSigning } {
  const plan = readExecutionPlan(root, runId);
  assertApproved(plan);
  const paths = files(root, runId);
  const key = readProjectKey(root);
  if (!mustBeSigned(root, runId, key)) {
    const { items, badLines } = readJsonLines<ExecutionEvent>(paths.events);
    const state = items.reduce((current, event) => applyEvent(plan, current, event), createExecutionState(plan));
    // Unreadable lines are surfaced in the report; they are never guessed into events.
    for (const line of badLines) state.anomalies.push({ eventId: `events.jsonl:${line}`, type: 'UNREADABLE', reason: 'line is not valid JSON' });
    return { plan, state, signing: { signed: false, scheme: null } };
  }
  if (!key) throw new Error(`Run ${runId} is signed but the project key is missing from ${keyDirectory()}; its events cannot be trusted`);
  const meta = existsSync(paths.integrity) ? (JSON.parse(readFileSync(paths.integrity, 'utf8')) as { approval?: unknown }) : null;
  if (!meta || !macMatches(key.key, approvalPayload(signedApproval(plan)), meta.approval)) {
    throw new Error(`The approval of run ${runId} has no valid signature: the plan or its approval was changed outside the toolkit`);
  }
  const { events, violations } = verifiedEvents(root, runId, key);
  const state = events.reduce((current, event) => applyEvent(plan, current, event), createExecutionState(plan));
  state.anomalies.push(...violations);
  return { plan, state, signing: { signed: true, scheme: INTEGRITY_SCHEME } };
}

function verifiedEvents(root: string, runId: string, key: ProjectKey): { events: ExecutionEvent[]; violations: Anomaly[] } {
  const paths = files(root, runId);
  const entries = readJsonLines<SignatureEntry>(paths.signatures).items;
  const byEventId = new Map(entries.map((entry) => [entry.eventId, entry]));
  const used = new Set<string>();
  const events: ExecutionEvent[] = [];
  const violations: Anomaly[] = [];
  const violation = (eventId: string, type: string, reason: string): void => {
    violations.push({ eventId, type, code: 'INTEGRITY_VIOLATION', reason });
  };
  const lines = existsSync(paths.events) ? readFileSync(paths.events, 'utf8').split('\n') : [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    let event: ExecutionEvent;
    try {
      event = JSON.parse(line) as ExecutionEvent;
    } catch {
      violation(`events.jsonl:${index + 1}`, 'UNREADABLE', 'line is not valid JSON');
      return;
    }
    const eventId = typeof event?.eventId === 'string' ? event.eventId : `events.jsonl:${index + 1}`;
    const entry = byEventId.get(eventId);
    if (!entry || used.has(eventId) || !macMatches(key.key, eventPayload(runId, entry.seq, line, entry.files), entry.mac)) {
      violation(eventId, typeof event?.type === 'string' ? event.type : 'UNKNOWN', 'event was not written by the toolkit or was changed');
      return;
    }
    // Signed events must appear in the order they were written: a reordered log could revive a
    // verification that was rejected the first time (ADR-016).
    if (entry.seq !== events.length + 1) {
      violation(eventId, event.type, `event out of order: written as #${entry.seq}, found as #${events.length + 1}`);
      return;
    }
    used.add(eventId);
    for (const [path, checksum] of Object.entries(entry.files ?? {})) {
      if (sha256File(join(root, path)) !== checksum) violation(eventId, event.type, `evidence changed or missing since it was recorded: ${path}`);
    }
    events.push(event);
  });
  for (const entry of entries.filter((item) => !used.has(item.eventId))) violation(entry.eventId, 'UNKNOWN', 'a signed event is missing from the log');
  const head = readRunHead(key, runId);
  if (!head || head.count !== entries.length || head.last !== (entries.at(-1)?.mac ?? null)) {
    violation('log', 'LOG', 'the event log was truncated, extended or rolled back outside the toolkit');
  }
  return { events, violations };
}

/**
 * Evidence files whose checksums were signed with an event of this run. They are proved unchanged
 * only when the run's integrity is VERIFIED (every signed checksum was checked on load).
 */
export function signedEvidence(root: string, runId: string): Set<string> {
  const entries = readJsonLines<SignatureEntry>(files(root, runId).signatures).items;
  return new Set(entries.flatMap((entry) => Object.keys(entry.files ?? {})));
}

export type EventInput = { type: ExecutionEvent['type']; source: ExecutionEvent['source'] } & Record<string, unknown>;

/**
 * Appends one event (redacted) and rewrites the state snapshot. In a signed run the event is signed
 * with its position and the checksums of `evidenceFiles`, under a cross-process lock.
 */
export function recordEvent(root: string, runId: string, input: EventInput, now: Date = new Date(), evidenceFiles: Record<string, string> = {}): ExecutionState {
  const append = (): ExecutionState => {
    const { plan, state, signing } = loadRun(root, runId);
    const event = redactValue({
      eventId: `evt-${randomBytes(6).toString('hex')}`,
      runId,
      planDigest: state.planDigest,
      at: now.toISOString(),
      ...input,
    }) as ExecutionEvent;
    const line = JSON.stringify(event);
    const next = applyEvent(plan, state, event);
    const paths = files(root, runId);
    appendFileSync(paths.events, `${line}\n`);
    if (signing.signed) appendSignature(paths.signatures, readProjectKey(root)!, runId, event.eventId, line, evidenceFiles);
    writeJson(paths.state, next);
    return next;
  };
  const key = readProjectKey(root);
  return key && mustBeSigned(root, runId, key) ? withRunLock(key, runId, append) : append();
}

/** Signs the line just appended: its position, its text and the evidence checksums recorded with it. */
function appendSignature(file: string, key: ProjectKey, runId: string, eventId: string, line: string, evidenceFiles: Record<string, string>): void {
  const seq = (readRunHead(key, runId)?.count ?? 0) + 1;
  const signedFiles = Object.keys(evidenceFiles).length ? { files: evidenceFiles } : {};
  const entry: SignatureEntry = { seq, eventId, mac: mac(key.key, eventPayload(runId, seq, line, evidenceFiles)), ...signedFiles };
  appendFileSync(file, `${JSON.stringify(entry)}\n`);
  writeRunHead(key, runId, { count: seq, last: entry.mac });
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

/** The run result from the event log, checked against the contract; nothing is written. */
export function computeRunResult(root: string, runId: string, now: Date = new Date(), validator = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas'))): RunResult {
  const { plan, state, signing } = loadRun(root, runId);
  return checkedRunResult(reconcile(plan, state, now.toISOString(), signing), (value) => validator.validate(RUN_RESULT_SCHEMA, value));
}

/** Reconciles every step, checks the result against the contract and writes result.json. */
export function reportRun(root: string, runId: string, now: Date = new Date()): RunReport {
  const result = computeRunResult(root, runId, now);
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
  // ADR-016: the checksums of the gate records and their logs are signed with the event.
  const checksums: Record<string, string> = {};
  for (const path of [...evidence, ...records.flatMap((record) => record.evidence.flatMap((item) => (item.artifact ? [item.artifact] : [])))]) {
    const sum = sha256File(join(root, path));
    if (sum) checksums[path] = sum;
  }
  const next = recordEvent(root, runId, { type: 'STEP_COMPLETED', source: 'orchestrator', stepId, gates, evidence }, now(), checksums);
  return { state: next, gates };
}

export function hostAvailable(executable: string): boolean {
  const probe = process.platform === 'win32' ? spawnSync('where.exe', [executable], { stdio: 'ignore' }) : spawnSync('sh', ['-c', `command -v ${executable}`], { stdio: 'ignore' });
  return probe.status === 0;
}

export interface DeliveryOutcome {
  host: string;
  invocation: Invocation;
  /**
   * DELIVERED: the host ran and reported an end of turn (the steps are verified separately).
   * NOT_VERIFIED: missing CLI, failed start, timeout, or a stream without run-level signals.
   * CANCELLED: stopped by the user.
   */
  status: 'DELIVERED' | 'DRY_RUN' | 'NOT_VERIFIED' | 'CANCELLED';
  reason: string;
  signals: number;
  /** Project-relative path of the redacted host transcript kept as evidence, if the host ran. */
  transcript: string | null;
  /** Isolation actually applied (W2.2-09); absent for profile none. */
  isolation?: DeliveryIsolation;
  /** Token usage the host reported in its stream (W2.2-04), kept as signed evidence next to the transcript. */
  usage?: { file: string } & HostUsage;
}

export interface DeliveryIsolation {
  requested: IsolationProfile;
  applied: IsolationProfile;
  provider: string;
  platform: string;
  network: NetworkPolicy['mode'];
  enforced: string[];
  notEnforced: Array<{ control: string; reason: string }>;
  /** Project-relative path of the signed isolation report. */
  report: string;
  /** Inbox requests the orchestrator refused (wrong type, run or shape). */
  refused: Array<{ request: string; reason: string }>;
}

export interface DeliveryOptions {
  dryRun?: boolean;
  eventCommand?: string;
  /** Stops the host after this long (default one hour). */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Runtime isolation (W2.2-09). Absent or profile none: today's behaviour, nothing claimed. */
  isolation?: { profile: IsolationProfile; network?: NetworkPolicy; allowRead?: string[]; allowWrite?: string[]; passEnv?: string[]; home?: string };
}

const DEFAULT_DELIVERY_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Delivers the approved revision to a host CLI (W2.1-10). Run-level signals from the host's native
 * stream become events; the end-of-run event carries the checksum of the redacted transcript, which
 * stays in this run's evidence and is never passed to another provider. A host reporting that it
 * finished is not verification: steps still need the orchestrator's gates.
 */
export async function deliverRun(root: string, runId: string, host: string, options: DeliveryOptions = {}): Promise<DeliveryOutcome> {
  const delivery = DELIVERIES[host];
  if (!delivery) throw new Error(`Unknown host "${host}"; use claude-code or codex`);
  const { plan, state } = loadRun(root, runId);
  if (state.run === 'CANCELLED' || state.run === 'FAILED') throw new Error(`Run ${runId} is ${state.run}; create a new run to deliver again`);
  const invocation = delivery.invocation(plan, {
    planPath: `${RUNS_DIR}/${runId}/execution-plan.json`,
    eventCommand: options.eventCommand ?? `npx create-ai-agent-setup run event ${runId}`,
  });
  const outcome = (status: DeliveryOutcome['status'], reason: string, signals = 0, transcript: string | null = null): DeliveryOutcome => ({ host, invocation, status, reason, signals, transcript });
  if (options.dryRun) return outcome('DRY_RUN', 'not executed');
  if (!hostAvailable(delivery.executable)) return outcome('NOT_VERIFIED', `${delivery.executable} is not on PATH; install and sign in to ${host}, then deliver again`);

  // W2.2-09: resolve, detect and validate isolation before anything starts (fail closed).
  const { profile = 'none', network = { mode: 'allow-all' }, ...access } = options.isolation ?? {};
  const launch = profile === 'none' ? null : prepareIsolatedLaunch(root, { profile, network, host, executable: resolveExecutable(delivery.executable)!, ...access }, invocation.args);
  try {
    return await runHost(root, runId, host, delivery, invocation, options, launch, outcome);
  } finally {
    launch?.cleanup();
  }
}

/** Refused inbox requests kept in the delivery outcome; the agent controls how many it sends. */
const MAX_REFUSED = 100;

async function runHost(
  root: string,
  runId: string,
  host: string,
  delivery: HostDelivery,
  invocation: Invocation,
  options: DeliveryOptions,
  launch: PreparedLaunch | null,
  outcome: (status: DeliveryOutcome['status'], reason: string, signals?: number, transcript?: string | null) => DeliveryOutcome,
): Promise<DeliveryOutcome> {
  const stamp = Date.now();
  const transcriptPath = `${RUNS_DIR}/${runId}/evidence/host-${host}-${stamp}.jsonl`;
  const usagePath = `${RUNS_DIR}/${runId}/evidence/usage-${host}-${stamp}.json`;
  mkdirSync(join(root, RUNS_DIR, runId, 'evidence'), { recursive: true });
  writeFileSync(join(root, transcriptPath), '');
  // The usage file is signed with the transcript: neither can be changed afterwards unnoticed.
  const deliveryEvidence = (): Record<string, string> => ({
    [transcriptPath]: sha256File(join(root, transcriptPath))!,
    [usagePath]: sha256File(join(root, usagePath))!,
  });
  const meter = new UsageMeter(host);
  let isolation: DeliveryIsolation | undefined;
  const startEvidence: Record<string, string> = {};
  if (launch) {
    const report = `${RUNS_DIR}/${runId}/evidence/isolation-${Date.now()}.json`;
    const { requested, applied, provider, platform, enforced, notEnforced } = launch;
    const summary = { requested, applied, provider, platform, network: options.isolation?.network?.mode ?? 'allow-all', enforced, notEnforced };
    // The report names what is enforced and what is not; environment values are never written.
    writeJson(join(root, report), { ...summary, environment: Object.keys(launch.env).sort() });
    startEvidence[report] = sha256File(join(root, report))!;
    isolation = { ...summary, report, refused: [] };
  }
  recordEvent(root, runId, { type: 'RUN_STARTED', source: 'orchestrator' }, new Date(), startEvidence);

  // Requests the sandboxed agent queued in its inbox: validated here, signed by the orchestrator.
  const inbox = launch?.env[INBOX_ENV];
  let inboxOffset = 0;
  const drainInbox = () => {
    if (!inbox) return;
    const read = readInbox(inbox, inboxOffset);
    inboxOffset = read.offset;
    for (const line of read.lines) {
      const checked = inboxEvent(runId, line);
      let refusal = 'refused' in checked ? checked.refused : null;
      if ('event' in checked) {
        try {
          recordEvent(root, runId, checked.event);
        } catch (error) {
          refusal = `not recorded: ${(error as Error).message}`;
        }
      }
      if (refusal && isolation!.refused.length < MAX_REFUSED) isolation!.refused.push({ request: redactText(line).text.slice(0, 200), reason: refusal });
    }
  };

  const command = launch?.command ?? invocation.executable;
  const args = launch?.args ?? invocation.args;
  const env = launch?.env ?? process.env;
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'inherit'], detached: process.platform !== 'win32' });
  // Isolated launches: every descendant is tracked so none outlives the run, even outside the group.
  const tree = launch && child.pid !== undefined ? new ProcessTree(child.pid, launch.env[RUN_MARK_ENV] ?? null) : null;
  tree?.scan();
  const poller = launch
    ? setInterval(() => {
        drainInbox();
        tree?.scan();
      }, 100)
    : null;
  let signals = 0;
  let terminal: HostSignal | null = null;
  createInterface({ input: child.stdout }).on('line', (line) => {
    const usage = delivery.parseUsage(line);
    if (usage) meter.add(usage);
    appendFileSync(join(root, transcriptPath), `${redactText(line).text}\n`);
    const signal = delivery.parseLine(line);
    if (!signal) return;
    signals += 1;
    if (signal.kind !== 'started') terminal = signal;
  });
  let stopped: 'timeout' | 'cancelled' | null = null;
  const stop = (why: 'timeout' | 'cancelled') => {
    if (stopped || child.pid === undefined || child.exitCode !== null) return;
    stopped = why;
    tree?.stop();
    killTree(child.pid, 'SIGTERM');
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_DELIVERY_TIMEOUT_MS;
  const timer = setTimeout(() => stop('timeout'), timeoutMs);
  const onAbort = () => stop('cancelled');
  if (options.signal?.aborted) onAbort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const spawnError = await new Promise<string | null>((resolve) => {
    child.on('error', (error) => resolve(error.message));
    child.on('close', () => resolve(null));
  });
  clearTimeout(timer);
  options.signal?.removeEventListener('abort', onAbort);
  if (poller) clearInterval(poller);
  // The host is gone; whatever it left running in the sandbox is stopped too.
  tree?.stop();
  drainInbox();
  const usage = meter.result();
  writeJson(join(root, usagePath), usage);
  const withRunData = (result: DeliveryOutcome): DeliveryOutcome => ({ ...result, ...(isolation ? { isolation } : {}), usage: { file: usagePath, ...usage } });

  if (spawnError) {
    recordEvent(root, runId, { type: 'RUN_FAILED', source: 'orchestrator', reason: `could not start ${delivery.executable}: ${spawnError}` });
    return withRunData(outcome('NOT_VERIFIED', `could not start ${delivery.executable}: ${spawnError}`, signals));
  }
  if (stopped === 'cancelled') {
    recordEvent(root, runId, { type: 'RUN_CANCELLED', source: 'user', reason: `delivery to ${host} cancelled by the user` }, new Date(), deliveryEvidence());
    return withRunData(outcome('CANCELLED', `delivery to ${host} cancelled; the host process was stopped`, signals, transcriptPath));
  }
  if (stopped === 'timeout') {
    recordEvent(root, runId, { type: 'RUN_FAILED', source: 'orchestrator', reason: `${host} did not finish within ${timeoutMs} ms` }, new Date(), deliveryEvidence());
    return withRunData(outcome('NOT_VERIFIED', `${host} timed out after ${timeoutMs} ms; the host process was stopped`, signals, transcriptPath));
  }
  const end = terminal as HostSignal | null;
  if (end?.kind === 'completed') recordEvent(root, runId, { type: 'RUN_COMPLETED', source: 'host' }, new Date(), deliveryEvidence());
  if (end?.kind === 'failed') recordEvent(root, runId, { type: 'RUN_FAILED', source: 'host', reason: end.reason }, new Date(), deliveryEvidence());
  if (!end) return withRunData(outcome('NOT_VERIFIED', `no end-of-run event in the ${host} stream (exit code ${child.exitCode}); progress unknown`, signals, transcriptPath));
  return withRunData(outcome('DELIVERED', `${host} reported ${end.kind} (exit code ${child.exitCode}); steps are verified separately`, signals, transcriptPath));
}

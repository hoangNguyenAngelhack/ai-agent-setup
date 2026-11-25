import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { actionsFromHookInput, strictestDecision } from '../../../src/adapters/hook-runtime/policy-check';
import { keyDirectory, mac, projectKey, projectKeyId, readProjectKey } from '../../../src/app/integrity';
import { approveRun, createRun, finishRun, loadRun, recordEvent, verifyStep } from '../../../src/app/runs';
import { approveExecutionPlan, planDigest, type ExecutionEvent, type ExecutionPlan } from '../../../src/core/execution';
import { PolicyEngine } from '../../../src/core/policy';
import { validateCatalog } from '../../../src/registry';
import { PLAN_ID, projectWithPlan } from '../../helpers/run-project';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

/**
 * ADR-016 threat model, one test per threat (T1–T10). The attacker edits files in the project the way
 * an agent's file tools or ad-hoc scripts would; it does not hold the key.
 */
const engine = new PolicyEngine(validateCatalog(join(REPO_ROOT, 'catalog')).policies);
const runDir = (root: string, runId: string) => join(root, '.ai-agent-setup', 'runs', runId);
const eventsFile = (root: string, runId: string) => join(runDir(root, runId), 'events.jsonl');

async function verifiedRun() {
  const root = projectWithPlan();
  const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
  for (const step of plan.steps) {
    recordEvent(root, plan.runId, { type: 'STEP_STARTED', source: 'host', stepId: step.id });
    recordEvent(root, plan.runId, { type: 'STEP_COMPLETED', source: 'host', stepId: step.id, gates: [], evidence: [] });
    await verifyStep(root, plan.runId, step.id);
  }
  return { root, plan };
}

function forged(plan: ExecutionPlan, stepId: string): ExecutionEvent {
  return {
    eventId: 'evt-forged0001',
    runId: plan.runId,
    planDigest: plan.approval.digest!,
    at: '2026-11-24T12:00:00.000Z',
    source: 'orchestrator',
    type: 'STEP_COMPLETED',
    stepId,
    gates: [{ gate: 'gate.build', status: 'PASS', reason: null }, { gate: 'gate.unit-tests', status: 'PASS', reason: null }],
    evidence: [],
  };
}

describe('ADR-016: signed runs', () => {
  it('should verify a run whose every event and piece of evidence was signed by the toolkit', async () => {
    const { root, plan } = await verifiedRun();
    const result = finishRun(root, plan.runId);

    expect(result).toMatchObject({ status: 'SUCCEEDED', integrity: { status: 'VERIFIED', scheme: 'hmac-sha256', violations: 0 } });
    expect(readFileSync(join(runDir(root, plan.runId), 'integrity.jsonl'), 'utf8').trim().split('\n')).toHaveLength(plan.steps.length * 3);
  }, 30000);

  it('T1: should ignore an orchestrator event appended to the log by hand', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, plan.runId, { type: 'STEP_STARTED', source: 'host', stepId: plan.steps[0]!.id });
    appendFileSync(eventsFile(root, plan.runId), `${JSON.stringify(forged(plan, plan.steps[0]!.id))}\n`);

    const { state } = loadRun(root, plan.runId);
    expect(state.steps[plan.steps[0]!.id]!.state).toBe('RUNNING');
    expect(state.anomalies).toEqual([expect.objectContaining({ eventId: 'evt-forged0001', code: 'INTEGRITY_VIOLATION', reason: 'event was not written by the toolkit or was changed' })]);
    expect(finishRun(root, plan.runId)).toMatchObject({ status: 'NOT_VERIFIED', integrity: { status: 'VIOLATED', violations: 1 } });
  });

  it('T2: should reject an event whose content was changed after it was signed', async () => {
    const { root, plan } = await verifiedRun();
    const file = eventsFile(root, plan.runId);
    writeFileSync(file, readFileSync(file, 'utf8').replace('"STEP_STARTED"', '"STEP_PROGRESS"'));

    const result = finishRun(root, plan.runId);
    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.anomalies.filter((item) => item.code === 'INTEGRITY_VIOLATION').map((item) => item.reason)).toContain('event was not written by the toolkit or was changed');
  }, 30000);

  it('T3: should refuse an approved plan edited together with a recomputed digest', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const widened = { ...plan, objective: 'and also deploy to production', approval: { ...plan.approval } };
    widened.approval.digest = planDigest(widened);
    writeFileSync(join(runDir(root, plan.runId), 'execution-plan.json'), JSON.stringify(widened));

    expect(() => loadRun(root, plan.runId)).toThrow(/approval of run .* has no valid signature/);
  });

  it('T4: should refuse an approval whose approver was changed', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'agent');
    writeFileSync(join(runDir(root, plan.runId), 'execution-plan.json'), JSON.stringify({ ...plan, approval: { ...plan.approval, by: 'user' } }));

    expect(() => loadRun(root, plan.runId)).toThrow(/has no valid signature/);
  });

  it('T5: should flag evidence replaced after the orchestrator recorded it', async () => {
    const { root, plan } = await verifiedRun();
    const record = join(runDir(root, plan.runId), 'gates', 'g1', 'gate.build.json');
    writeFileSync(record, readFileSync(record, 'utf8').replace('"PASS"', '"PASS" '));
    const log = join(runDir(root, plan.runId), 'evidence', 'g2', 'gate.build.log');
    writeFileSync(log, 'all good, trust me\n');

    const reasons = finishRun(root, plan.runId).anomalies.map((item) => item.reason);
    expect(reasons).toContain(`evidence changed or missing since it was recorded: .ai-agent-setup/runs/${plan.runId}/gates/g1/gate.build.json`);
    expect(reasons).toContain(`evidence changed or missing since it was recorded: .ai-agent-setup/runs/${plan.runId}/evidence/g2/gate.build.log`);
  }, 30000);

  it('T6: should detect a log truncated together with its signatures', async () => {
    const { root, plan } = await verifiedRun();
    for (const name of ['events.jsonl', 'integrity.jsonl']) {
      const file = join(runDir(root, plan.runId), name);
      const lines = readFileSync(file, 'utf8').trim().split('\n');
      writeFileSync(file, `${lines.slice(0, -1).join('\n')}\n`);
    }

    const result = finishRun(root, plan.runId);
    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.anomalies).toContainEqual(expect.objectContaining({ eventId: 'log', reason: 'the event log was truncated, extended or rolled back outside the toolkit' }));
  }, 30000);

  it('T7: should keep a run signed when integrity.json is deleted', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    renameSync(join(runDir(root, plan.runId), 'integrity.json'), join(root, 'moved-away.json'));

    expect(() => loadRun(root, plan.runId)).toThrow(/has no valid signature/);
  });

  it('T8: should not trust a signed run when the project key is gone', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const keyFile = join(keyDirectory(), `${projectKeyId(root)}.key`);
    renameSync(keyFile, `${keyFile}.moved`);
    try {
      expect(() => loadRun(root, plan.runId)).toThrow(/is signed but the project key is missing/);
    } finally {
      renameSync(`${keyFile}.moved`, keyFile);
    }
  });

  it('T9: should reject events signed with another key', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const line = JSON.stringify(forged(plan, plan.steps[0]!.id));
    appendFileSync(eventsFile(root, plan.runId), `${line}\n`);
    appendFileSync(join(runDir(root, plan.runId), 'integrity.jsonl'), `${JSON.stringify({ seq: 1, eventId: 'evt-forged0001', mac: mac(Buffer.alloc(32, 7), line) })}\n`);

    expect(finishRun(root, plan.runId).integrity.status).toBe('VIOLATED');
  });

  it('T10: should keep the key outside the project, private to the user', () => {
    const root = projectWithPlan();
    approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const key = readProjectKey(root)!;
    const file = join(keyDirectory(), `${key.keyId}.key`);

    expect(file.startsWith(root)).toBe(false);
    expect(readFileSync(join(runDir(root, readdirRun(root)), 'integrity.json'), 'utf8')).not.toContain(key.key.toString('hex'));
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('should create the project key once and keep it', () => {
    const root = writeTree({});
    const first = projectKey(root, new Date('2026-11-24T12:00:00Z'));

    expect(projectKey(root, new Date('2030-01-01T00:00:00Z'))).toEqual(first);
    expect(readProjectKey(root)!.createdAt).toBe('2026-11-24T12:00:00.000Z');
  });

  it('should take over a lock left behind by a crashed process', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const lock = join(keyDirectory(), projectKeyId(root), 'runs', `${plan.runId}.lock`);
    mkdirSync(lock);
    const old = new Date(Date.now() - 120_000);
    utimesSync(lock, old, old);

    recordEvent(root, plan.runId, { type: 'STEP_STARTED', source: 'host', stepId: plan.steps[0]!.id });
    expect(existsSync(lock)).toBe(false);
    expect(loadRun(root, plan.runId).state.anomalies).toEqual([]);
  });

  it('should take over at once a fresh lock whose owner process was killed, and wait for a live owner', () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const lock = join(keyDirectory(), projectKeyId(root), 'runs', `${plan.runId}.lock`);
    // A process that has exited: its pid no longer exists (an agent's `run event` killed on cancel).
    const dead = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout;
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner'), dead);

    const started = Date.now();
    recordEvent(root, plan.runId, { type: 'STEP_STARTED', source: 'host', stepId: plan.steps[0]!.id });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(existsSync(lock)).toBe(false);

    // A live owner (this test's parent process) is waited on, not taken over.
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner'), String(process.ppid));
    expect(() => recordEvent(root, plan.runId, { type: 'STEP_STARTED', source: 'host', stepId: plan.steps[1]!.id })).toThrow(/is locked by another process/);
    expect(existsSync(lock)).toBe(true);
  }, 20000);
});

describe('ADR-016: findings of the security review (2026-11-24)', () => {
  it('HIGH 1: should keep a run signed when it was created long before it was approved', () => {
    const root = projectWithPlan();
    const draft = createRun(root, PLAN_ID, new Date('2026-11-24T10:00:00Z'));
    const plan = approveRun(root, draft.runId, 'user', new Date('2026-11-24T10:05:00Z'));
    renameSync(join(runDir(root, plan.runId), 'integrity.json'), join(root, 'moved-away.json'));
    appendFileSync(eventsFile(root, plan.runId), `${JSON.stringify(forged(plan, plan.steps[0]!.id))}\n`);

    expect(() => loadRun(root, plan.runId)).toThrow(/has no valid signature/);
  });

  it('HIGH 1: should not accept a fabricated run with an old-looking id as unsigned', () => {
    const root = projectWithPlan();
    const real = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const fakeId = 'run-20200101T000000Z-abcdef';
    mkdirSync(runDir(root, fakeId), { recursive: true });
    writeFileSync(join(runDir(root, fakeId), 'execution-plan.json'), JSON.stringify({ ...real, runId: fakeId }));

    expect(() => loadRun(root, fakeId)).toThrow();
  });

  it('should keep runs approved before the key existed readable as UNSIGNED', () => {
    const root = projectWithPlan();
    const old = createRun(root, PLAN_ID, new Date('2020-01-01T00:00:00Z'));
    writeFileSync(join(runDir(root, old.runId), 'execution-plan.json'), JSON.stringify(approveExecutionPlan(old, 'user', '2020-01-01T00:01:00.000Z')));
    writeFileSync(eventsFile(root, old.runId), '');
    approveRun(root, createRun(root, PLAN_ID).runId, 'user');

    expect(finishRun(root, old.runId).integrity).toEqual({ status: 'UNSIGNED', scheme: null, violations: 0 });
  });

  it('HIGH 2: should not let a reordered log turn a failed verification into SUCCEEDED', async () => {
    const root = projectWithPlan();
    const gates = join(root, '.ai-agent-setup', 'gates.json');
    writeFileSync(gates, JSON.stringify({ gates: { 'gate.build': { command: 'node scripts/fail.js' }, 'gate.unit-tests': { command: 'node scripts/ok.js' } } }));
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const first = plan.steps[0]!.id;
    recordEvent(root, plan.runId, { type: 'STEP_STARTED', source: 'host', stepId: first });
    await verifyStep(root, plan.runId, first);
    expect(loadRun(root, plan.runId).state.steps[first]!.state).toBe('FAILED');
    writeFileSync(gates, JSON.stringify({ gates: { 'gate.build': { command: 'node scripts/ok.js' }, 'gate.unit-tests': { command: 'node scripts/ok.js' } } }));
    await verifyStep(root, plan.runId, first);

    const lines = readFileSync(eventsFile(root, plan.runId), 'utf8').trim().split('\n');
    writeFileSync(eventsFile(root, plan.runId), `${[lines[0], lines[2], lines[1]].join('\n')}\n`);
    const result = finishRun(root, plan.runId);

    expect(result.status).not.toBe('SUCCEEDED');
    expect(result.integrity.status).toBe('VIOLATED');
    expect(result.anomalies.map((item) => item.reason)).toContain('event out of order: written as #3, found as #2');
  }, 30000);

  it('MEDIUM 3: should deny the key directory itself, its parents and other spellings to the read tools', () => {
    const keys = keyDirectory();
    const cwd = writeTree({});
    const parent = join(keys, '..');
    const decide = (toolInput: Record<string, unknown>, tool = 'Grep') =>
      strictestDecision(engine, actionsFromHookInput({ cwd, tool_name: tool, tool_input: toolInput }, cwd), cwd).effect;

    expect(decide({ pattern: 'key', path: keys })).toBe('deny');
    expect(decide({ pattern: 'key', path: parent })).toBe('deny');
    expect(decide({ file_path: join(keys, 'x.key') }, 'Read')).toBe('deny');
    if (process.platform === 'darwin' || process.platform === 'win32') expect(decide({ file_path: join(keys, 'X.KEY').toUpperCase() }, 'Read')).toBe('deny');
    expect(decide({ file_path: join(cwd, 'src', 'a.ts') }, 'Read')).toBe('allow');
  });

  it('LOW 5: should refuse a key directory inside the project', () => {
    const root = writeTree({});
    const previous = process.env.AI_AGENT_SETUP_KEY_DIR;
    process.env.AI_AGENT_SETUP_KEY_DIR = join(root, 'keys');
    try {
      expect(() => projectKey(root)).toThrow(/is inside the project/);
      expect(existsSync(join(root, 'keys'))).toBe(false);
    } finally {
      process.env.AI_AGENT_SETUP_KEY_DIR = previous;
    }
  });

  it.skipIf(process.platform === 'linux')('LOW 6: should give one key to a project opened with different letter case', () => {
    const root = writeTree({});

    expect(projectKeyId(root.toUpperCase())).toBe(projectKeyId(root));
  });
});

describe('ADR-016: the key is off limits to agents', () => {
  const keyPath = '../../Library/Application Support/ai-agent-setup/keys/0123456789abcdef.key';

  it('should deny reading the key with the host file tools', () => {
    const cwd = '/Users/dev/project';
    const [action] = actionsFromHookInput({ cwd, tool_name: 'Read', tool_input: { file_path: '/Users/dev/.config/ai-agent-setup/keys/x.key' } });

    expect(action).toEqual({ type: 'read', path: '../.config/ai-agent-setup/keys/x.key' });
    expect(engine.evaluate(action!).effect).toBe('deny');
    expect(engine.evaluate({ type: 'read', path: keyPath }).effect).toBe('deny');
  });

  it('should deny shell access and writes to the key, and still allow reading the plan', () => {
    expect(engine.evaluate({ type: 'command', command: 'cat "$HOME/Library/Application Support/ai-agent-setup/keys/x.key"' }).effect).toBe('deny');
    expect(engine.evaluate({ type: 'write', path: keyPath, content: 'x' }).effect).toBe('deny');
    expect(engine.evaluate({ type: 'read', path: '.ai-agent-setup/runs/run-1/execution-plan.json' }).effect).toBe('allow');
  });
});

function readdirRun(root: string): string {
  return readdirSync(join(root, '.ai-agent-setup', 'runs')).find((name) => name.startsWith('run-'))!;
}

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { claudeCodeDelivery } from '../../../src/adapters/claude-code';
import { codexDelivery } from '../../../src/adapters/codex';
import { approveRun, checkedRunResult, createRun, deliverRun, finishRun, loadRun, recordEvent, reportRun, verifyStep } from '../../../src/app/runs';
import { approveExecutionPlan, type ExecutionPlan, type ExecutionStep, type RunResult } from '../../../src/core/execution';
import { SchemaValidator } from '../../../src/registry';
import { writeTree } from '../../helpers/fs-tree';
import { PLAN_ID, projectWithPlan } from '../../helpers/run-project';
import { REPO_ROOT } from '../../helpers/v1-cli';

const validator = new SchemaValidator(join(REPO_ROOT, 'catalog', 'schemas'));
const RUN_RESULT = 'urn:ai-agent-setup:contracts:v1:run-result';
const SECRET = `ghp_${'Qw8'.repeat(12)}`; // synthetic


/**
 * A run created before signing existed (ADR-016 backward compatibility): an old run id, approved
 * without integrity.json, in a project that has no key yet.
 */
function legacyRun(root: string): ExecutionPlan {
  const draft = createRun(root, PLAN_ID, new Date('2020-01-01T00:00:00Z'));
  const approved = approveExecutionPlan(draft, 'user', '2020-01-01T00:01:00.000Z');
  const dir = join(root, '.ai-agent-setup', 'runs', draft.runId);
  writeFileSync(join(dir, 'execution-plan.json'), JSON.stringify(approved));
  writeFileSync(join(dir, 'events.jsonl'), '');
  return approved;
}

describe('run artifacts (ADR-009)', () => {
  it('should write the plan files and refuse events before approval', () => {
    const root = projectWithPlan();
    const plan = createRun(root, PLAN_ID);
    const dir = join(root, '.ai-agent-setup', 'runs', plan.runId);

    expect(existsSync(join(dir, 'execution-plan.json'))).toBe(true);
    expect(readFileSync(join(dir, 'execution-plan.md'), 'utf8')).toContain(`# Execution plan ${plan.runId} (revision 1)`);
    expect(existsSync(join(dir, 'evidence'))).toBe(true);
    expect(readFileSync(join(root, '.ai-agent-setup', 'runs', '.gitignore'), 'utf8')).toContain('*');
    expect(() => recordEvent(root, plan.runId, { type: 'RUN_STARTED', source: 'orchestrator' })).toThrow(/not approved/);
  });

  it('should rebuild state from events.jsonl after a restart and redact stored events', () => {
    const root = projectWithPlan();
    const { runId, steps } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, runId, { type: 'RUN_STARTED', source: 'orchestrator' });
    recordEvent(root, runId, { type: 'STEP_FAILED', source: 'host', stepId: steps[0]!.id, reason: `push failed with ${SECRET}`, evidence: [] });
    writeFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'execution-state.json'), '{}');

    const { state } = loadRun(root, runId);
    expect(state.steps[steps[0]!.id]!.state).toBe('FAILED');
    expect(readFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), 'utf8')).not.toContain(SECRET);
  });

  const fixture = (name: string) => JSON.parse(readFileSync(join(REPO_ROOT, 'tests', 'contract', 'fixtures', 'run-result', `${name}.json`), 'utf8')) as RunResult;
  const check = (result: RunResult) => checkedRunResult(result, (value) => validator.validate(RUN_RESULT, value));

  it('should turn a SUCCEEDED result that breaks the contract into NOT_VERIFIED', () => {
    // Consistent totals, but a NOT_VERIFIED step under a SUCCEEDED run.
    const succeeded = fixture('valid-succeeded');
    const broken: RunResult = {
      ...succeeded,
      steps: [succeeded.steps[0]!, { ...succeeded.steps[1]!, state: 'NOT_VERIFIED', final: 'NOT_VERIFIED', reason: 'no gates were run for this step', gates: [] }],
      counts: { ...succeeded.counts, SUCCEEDED: 1, NOT_VERIFIED: 1 },
      verification: { stepsTotal: 2, stepsSucceeded: 1, stepsWithExecutionEvidence: 2, gates: { PASS: 2, FAIL: 0, NOT_VERIFIED: 0 } },
    };
    const result = check(broken);

    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.reason).toMatch(/^result failed contract validation: /);
  });

  it('should refuse a result whose totals disagree with its steps', () => {
    const tampered = { ...fixture('valid-failed'), counts: { ...fixture('valid-failed').counts, FAILED: 0, SUCCEEDED: 1 } };

    expect(() => check(tampered)).toThrow(/\/counts\/SUCCEEDED: 1 but 0 step\(s\) are SUCCEEDED/);
  });

  it('should refuse a result that stays invalid after the downgrade', () => {
    expect(() => check(fixture('invalid-bad-digest'))).toThrow(/is invalid: \/planDigest/);
  });

  it('should refuse an approval without an approver', () => {
    const root = projectWithPlan();

    expect(() => approveRun(root, createRun(root, PLAN_ID).runId, ' ')).toThrow(/needs the approver/);
  });

  it('should still produce a result for a failure logged without a reason', () => {
    const root = projectWithPlan();
    const { runId, steps } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, runId, { type: 'STEP_FAILED', source: 'host', stepId: steps[0]!.id, reason: '', evidence: [] });
    const result = finishRun(root, runId);

    expect(result).toMatchObject({ status: 'FAILED', steps: [{ final: 'FAILED', reason: 'FAILED (no reason recorded)' }, { final: 'BLOCKED' }] });
  });

  it('should record lines that are not events and still report the run (unsigned run)', () => {
    const root = projectWithPlan();
    const { runId } = legacyRun(root);
    writeFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), '{"foo":1}\nnull\n{"eventId":"e9","type":"STEP_EXPLODED"}\n');
    const result = finishRun(root, runId);

    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.anomalies).toEqual([
      { eventId: 'unknown', type: 'UNKNOWN', reason: 'not an execution event' },
      { eventId: 'unknown', type: 'UNKNOWN', reason: 'not an execution event' },
      { eventId: 'e9', type: 'STEP_EXPLODED', reason: 'not an execution event' },
    ]);
  });

  it('should skip an unreadable event line and report it (unsigned run)', () => {
    const root = projectWithPlan();
    const { runId, steps } = legacyRun(root);
    recordEvent(root, runId, { type: 'STEP_STARTED', source: 'host', stepId: steps[0]!.id });
    writeFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), '{"torn":', { flag: 'a' });

    const { state } = loadRun(root, runId);
    expect(state.steps[steps[0]!.id]!.state).toBe('RUNNING');
    expect(state.anomalies).toEqual([{ eventId: 'events.jsonl:2', type: 'UNREADABLE', reason: 'line is not valid JSON' }]);
  });

  it('should refuse a plan edited after approval', () => {
    const root = projectWithPlan();
    const { runId } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const file = join(root, '.ai-agent-setup', 'runs', runId, 'execution-plan.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"revision": 1', '"revision": 7'));

    expect(() => loadRun(root, runId)).toThrow(/changed after approval/);
  });

  it('should verify steps with the gate engine and reconcile the run', async () => {
    const root = projectWithPlan();
    const { runId, steps } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, runId, { type: 'RUN_STARTED', source: 'orchestrator' });
    for (const step of steps) {
      recordEvent(root, runId, { type: 'STEP_STARTED', source: 'host', stepId: step.id });
      recordEvent(root, runId, { type: 'STEP_COMPLETED', source: 'host', stepId: step.id, gates: [], evidence: ['notes.md'] });
      expect(loadRun(root, runId).state.steps[step.id]!.state).toBe('NOT_VERIFIED');
      await verifyStep(root, runId, step.id);
    }
    const result = finishRun(root, runId);

    expect(result.status).toBe('SUCCEEDED');
    expect(result.reason).not.toContain('contract validation');
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', runId, 'result.json'))).toBe(true);
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', runId, 'gates', 'g1', 'gate.build.json'))).toBe(true);
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', runId, 'gates', 'g2', 'gate.build.json'))).toBe(true);
  }, 30000);
});

describe('ADR-015 in the run store', () => {
  it('should refuse to run gates for a step whose dependency has not succeeded', async () => {
    const root = projectWithPlan();
    const { runId, steps } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const [first, second] = steps as [ExecutionStep, ExecutionStep];
    recordEvent(root, runId, { type: 'STEP_COMPLETED', source: 'host', stepId: first.id, gates: [], evidence: [] });

    await expect(verifyStep(root, runId, second.id)).rejects.toThrow(`${second.id} depends on ${first.id} (NOT_VERIFIED); verify the dependencies first`);
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', runId, 'gates'))).toBe(false);
  });

  it('should refuse to run gates while an approval is pending', async () => {
    const root = projectWithPlan();
    const { runId, steps } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, runId, { type: 'APPROVAL_REQUIRED', source: 'host', stepId: steps[0]!.id, reason: 'runs a migration' });

    await expect(verifyStep(root, runId, steps[0]!.id)).rejects.toThrow(/waits for the user's approval/);
  });

  it('should replay an old log under the new rules and say what changed', async () => {
    const root = projectWithPlan();
    const { runId, steps } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const [first, second] = steps as [ExecutionStep, ExecutionStep];
    // The shape of a log written before ADR-015: the host worked on the second step before the first was verified.
    for (const [type, stepId] of [['STEP_STARTED', first.id], ['STEP_COMPLETED', first.id], ['STEP_STARTED', second.id], ['STEP_COMPLETED', second.id]] as const) {
      recordEvent(root, runId, { type, source: 'host', stepId, ...(type === 'STEP_COMPLETED' ? { gates: [], evidence: [] } : {}) });
    }
    await verifyStep(root, runId, first.id);
    await verifyStep(root, runId, second.id);
    // The result an older version wrote for this log: no rulesVersion, the second step without execution evidence.
    const file = join(root, '.ai-agent-setup', 'runs', runId, 'result.json');
    writeFileSync(file, JSON.stringify({ status: 'OUTCOME_VERIFIED', steps: [{ id: first.id, final: 'SUCCEEDED' }, { id: second.id, final: 'SUCCEEDED' }] }));

    const { result, changes } = reportRun(root, runId);
    expect(result).toMatchObject({ status: 'SUCCEEDED', rulesVersion: 3, anomalies: [], deferred: [], integrity: { status: 'VERIFIED', violations: 0 } });
    expect(changes).toEqual(['rules 1 → 3 (recomputed from the event log)', 'status OUTCOME_VERIFIED → SUCCEEDED']);
    expect(reportRun(root, runId).changes).toEqual([]);
  }, 30000);
});

describe('plan delivery (W2.1-10)', () => {
  const originalPath = process.env.PATH;
  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it('should pass the exact approved revision and list unsupported capabilities', async () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    for (const host of ['claude-code', 'codex']) {
      const outcome = await deliverRun(root, plan.runId, host, { dryRun: true });
      const prompt = outcome.invocation.args.join(' ');

      expect(outcome.status).toBe('DRY_RUN');
      expect(prompt).toContain(plan.approval.digest!);
      expect(prompt).toContain(`.ai-agent-setup/runs/${plan.runId}/execution-plan.json`);
      expect(prompt).toContain(`The project root is your working directory: ${root}. Every path below is relative to it.`);
      expect(prompt).toContain(`run event ${plan.runId}`);
      expect(outcome.invocation.unsupported.length).toBeGreaterThan(0);
    }
  });

  it('should allow Claude Code to run only this run\'s event command', async () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const claude = await deliverRun(root, plan.runId, 'claude-code', { dryRun: true });
    const codex = await deliverRun(root, plan.runId, 'codex', { dryRun: true });

    expect(claude.invocation.args.slice(-2)).toEqual(['--allowedTools', `Bash(npx create-ai-agent-setup run event ${plan.runId} *)`]);
    expect(codex.invocation.args).not.toContain('--allowedTools');
  });

  it('should grant nothing when the event command cannot be held by a permission rule', async () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    for (const eventCommand of ['node "C:\\Program Files (x86)\\cli.js" run event', 'npx tool run event *', 'npx tool\nrm x']) {
      const outcome = await deliverRun(root, plan.runId, 'claude-code', { dryRun: true, eventCommand });

      expect(outcome.invocation.args, eventCommand).not.toContain('--allowedTools');
      expect(outcome.invocation.unsupported.join('\n')).toMatch(/cannot be held by a permission rule/);
    }
  });

  it('should not deliver a cancelled run', async () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, plan.runId, { type: 'RUN_CANCELLED', source: 'user', reason: 'stop' });

    await expect(deliverRun(root, plan.runId, 'codex', { dryRun: true })).rejects.toThrow(/is CANCELLED/);
  });

  it('should report NOT_VERIFIED when the host CLI is missing', async () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    process.env.PATH = writeTree({});

    const outcome = await deliverRun(root, plan.runId, 'codex');
    expect(outcome).toMatchObject({ status: 'NOT_VERIFIED', reason: expect.stringMatching(/codex is not on PATH/) as unknown });
  });

  it.skipIf(process.platform === 'win32')('should record run-level signals from a synthetic host stream without succeeding steps', async () => {
    const root = projectWithPlan();
    const plan = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    // Synthetic stand-in for the real CLI (W2.0-15 is not verified): prints two Codex-shaped events.
    const bin = writeTree({ codex: '#!/bin/sh\necho \'{"type":"thread.started","thread_id":"t"}\'\necho \'not json\'\necho \'{"type":"turn.completed"}\'\n' });
    chmodSync(join(bin, 'codex'), 0o755);
    process.env.PATH = `${bin}${delimiter}${originalPath}`;

    const outcome = await deliverRun(root, plan.runId, 'codex');
    const result = finishRun(root, plan.runId);

    expect(outcome).toMatchObject({ status: 'DELIVERED', signals: 2 });
    expect(loadRun(root, plan.runId).state.run).toBe('HOST_COMPLETED');
    expect(result.status).toBe('NOT_VERIFIED');
  });

  it('should map native stream lines to run-level signals', () => {
    expect(claudeCodeDelivery.parseLine('{"type":"system","subtype":"init"}')).toEqual({ kind: 'started' });
    expect(claudeCodeDelivery.parseLine('{"type":"result","subtype":"success","is_error":false}')).toEqual({ kind: 'completed' });
    expect(claudeCodeDelivery.parseLine('{"type":"result","subtype":"error_max_turns","is_error":true}')).toEqual({ kind: 'failed', reason: 'claude result error_max_turns' });
    expect(claudeCodeDelivery.parseLine('{"type":"assistant"}')).toBeNull();
    expect(codexDelivery.parseLine('{"type":"turn.failed","error":{"message":"quota"}}')).toEqual({ kind: 'failed', reason: 'codex turn.failed: quota' });
    expect(codexDelivery.parseLine('Done')).toBeNull();
  });
});

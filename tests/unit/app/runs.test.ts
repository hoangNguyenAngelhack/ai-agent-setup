import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { claudeCodeDelivery } from '../../../src/adapters/claude-code';
import { codexDelivery } from '../../../src/adapters/codex';
import { approveRun, createRun, deliverRun, finishRun, loadRun, recordEvent, verifyStep } from '../../../src/app/runs';
import { TaskClassifier } from '../../../src/core/planning';
import { routeTask } from '../../../src/core/routing';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../../../src/registry';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const registry = new Registry(report.entries);
const PLAN_ID = 'plan-20261124T100000Z-abcdef';
const SECRET = `ghp_${'Qw8'.repeat(12)}`; // synthetic

function projectWithPlan(): string {
  const task = 'Implement the orders API endpoint and build the orders page in the React app';
  const plan = routeTask({
    id: PLAN_ID,
    task,
    mode: 'hybrid',
    classification: new TaskClassifier(registry).classify(task),
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profile: registry.get('profile.starter') as ProfileEntry,
    policies: report.policies,
    project: null,
    overrides: { domains: ['backend', 'frontend'] },
    contextT0Bytes: 0,
  });
  const root = writeTree({
    'scripts/ok.js': 'console.log("ok")',
    '.ai-agent-setup/gates.json': JSON.stringify({ gates: { 'gate.build': { command: 'node scripts/ok.js' }, 'gate.unit-tests': { command: 'node scripts/ok.js' } } }),
  });
  mkdirSync(join(root, '.ai-agent-setup', 'runs', PLAN_ID), { recursive: true });
  writeFileSync(join(root, '.ai-agent-setup', 'runs', PLAN_ID, 'plan.json'), JSON.stringify(plan));
  return root;
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

  it('should skip an unreadable event line and report it', () => {
    const root = projectWithPlan();
    const { runId, steps } = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
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
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', runId, 'result.json'))).toBe(true);
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', runId, 'gates', 'g1', 'gate.build.json'))).toBe(true);
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', runId, 'gates', 'g2', 'gate.build.json'))).toBe(true);
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
      expect(prompt).toContain(`run event ${plan.runId}`);
      expect(outcome.invocation.unsupported.length).toBeGreaterThan(0);
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
    expect(outcome).toMatchObject({ status: 'NOT_VERIFIED', reason: expect.stringMatching(/codex is not on PATH/) });
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

import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approveRun, createRun, deliverRun, loadRun, recordEvent, reportRun, verifyStep } from '../../src/app/runs';
import { renderExecutionPlan, type ExecutionPlan } from '../../src/core/execution';
import { writeTree } from '../helpers/fs-tree';
import { PLAN_ID, projectWithPlan } from '../helpers/run-project';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * W2.0-15 / W2.1-10 end-to-end flow through real processes: plan → review → approve → dispatch to a
 * host → host events → dependencies and approvals → verification → result → evidence and replay.
 * The host is tests/helpers/fake-host.cjs installed as `codex` / `claude`; real host CLIs are not
 * used, so this proves the toolkit's side of the protocol only.
 */
const CLI = join(REPO_ROOT, 'bin', 'cli.js');
const originalPath = process.env.PATH;

function installFakeHosts(): void {
  const bin = writeTree({});
  for (const name of ['codex', 'claude']) {
    copyFileSync(join(REPO_ROOT, 'tests', 'helpers', 'fake-host.cjs'), join(bin, name));
    chmodSync(join(bin, name), 0o755);
  }
  process.env.PATH = `${bin}${delimiter}${originalPath}`;
}

function approvedRun(): { root: string; plan: ExecutionPlan } {
  const root = projectWithPlan();
  const draft = createRun(root, PLAN_ID);
  // Review: the human-readable plan the user approves.
  expect(readFileSync(join(root, '.ai-agent-setup', 'runs', draft.runId, 'execution-plan.md'), 'utf8')).toBe(renderExecutionPlan(draft));
  return { root, plan: approveRun(root, draft.runId, 'user') };
}

function deliver(root: string, plan: ExecutionPlan, host: 'codex' | 'claude-code', mode: string, extra: { timeoutMs?: number; signal?: AbortSignal } = {}) {
  process.env.FAKE_HOST_MODE = mode;
  return deliverRun(root, plan.runId, host, { eventCommand: `"${process.execPath}" "${CLI}" run event ${plan.runId}`, ...extra });
}

async function verifyAll(root: string, plan: ExecutionPlan): Promise<void> {
  for (const step of plan.steps) await verifyStep(root, plan.runId, step.id);
}

describe.skipIf(process.platform === 'win32')('host delivery end to end (fake host)', () => {
  beforeEach(installFakeHosts);
  afterEach(() => {
    process.env.PATH = originalPath;
    delete process.env.FAKE_HOST_MODE;
  });

  it.each(['codex', 'claude-code'] as const)('should run a plan to SUCCEEDED through %s, with signed evidence and a stable replay', async (host) => {
    const { root, plan } = approvedRun();

    const delivery = await deliver(root, plan, host, 'success');
    expect(delivery).toMatchObject({ status: 'DELIVERED', signals: 2 });
    // The host said it finished; nothing is verified yet.
    expect(reportRun(root, plan.runId).result).toMatchObject({ status: 'NOT_VERIFIED', run: 'HOST_COMPLETED' });

    await verifyAll(root, plan);
    const { result } = reportRun(root, plan.runId);
    expect(result).toMatchObject({ status: 'SUCCEEDED', integrity: { status: 'VERIFIED' }, verification: { stepsWithExecutionEvidence: 2 } });
    expect(result.steps.map((step) => step.evidence[0])).toEqual(plan.steps.map((step) => `notes/${step.id}.md`));
    expect(existsSync(join(root, delivery.transcript!))).toBe(true);
    expect(readFileSync(join(root, delivery.transcript!), 'utf8')).toMatch(/thread\.started|system/);
    expect(loadRun(root, plan.runId).state).toEqual(loadRun(root, plan.runId).state);
  }, 60000);

  it('should fail the run and block the dependant when the host reports a failed step', async () => {
    const { root, plan } = approvedRun();

    expect(await deliver(root, plan, 'codex', 'fail-first')).toMatchObject({ status: 'DELIVERED', reason: expect.stringContaining('reported failed') as unknown });
    const { result } = reportRun(root, plan.runId);
    expect(result).toMatchObject({ status: 'FAILED', run: 'FAILED' });
    expect(result.steps.map((step) => [step.final, step.execution.evidenced])).toEqual([
      ['FAILED', true],
      ['BLOCKED', false],
    ]);
  }, 60000);

  it('should keep the approval the agent asked for, refuse gates until the user decides, then resume', async () => {
    const { root, plan } = approvedRun();
    const first = plan.steps[0]!.id;

    await deliver(root, plan, 'codex', 'approval');
    expect(reportRun(root, plan.runId).result.reason).toMatch(/^approval pending: /);
    await expect(verifyStep(root, plan.runId, first)).rejects.toThrow(/waits for the user's approval/);

    recordEvent(root, plan.runId, { type: 'APPROVAL_RESOLVED', source: 'user', stepId: first, approved: true, by: 'user' });
    expect(loadRun(root, plan.runId).state.steps[first]).toMatchObject({ state: 'RUNNING', pendingApproval: null });
  }, 60000);

  it('should stop a host that runs past the timeout and keep its transcript', async () => {
    const { root, plan } = approvedRun();

    const delivery = await deliver(root, plan, 'codex', 'hang', { timeoutMs: 1500 });
    expect(delivery).toMatchObject({ status: 'NOT_VERIFIED', reason: expect.stringContaining('timed out after 1500 ms') as unknown });
    expect(reportRun(root, plan.runId).result).toMatchObject({ status: 'FAILED', integrity: { status: 'VERIFIED' } });
  }, 60000);

  it('should cancel a running host on request, and never report the run as success', async () => {
    const { root, plan } = approvedRun();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1500);

    expect(await deliver(root, plan, 'codex', 'hang', { signal: controller.signal })).toMatchObject({ status: 'CANCELLED' });
    expect(reportRun(root, plan.runId).result).toMatchObject({ status: 'CANCELLED', run: 'CANCELLED' });
  }, 60000);

  it('should stop the host and record RUN_CANCELLED when the user presses Ctrl-C in run deliver', async () => {
    const { root, plan } = approvedRun();
    const child = spawn(process.execPath, [CLI, 'run', 'deliver', plan.runId, '--host', 'codex', '--event-command', `"${process.execPath}" "${CLI}" run event ${plan.runId}`], {
      cwd: root,
      env: { ...process.env, FAKE_HOST_MODE: 'hang' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (let tries = 0; tries < 100 && !readFileSync(join(root, '.ai-agent-setup', 'runs', plan.runId, 'events.jsonl'), 'utf8').includes('STEP_STARTED'); tries += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    child.kill('SIGINT');
    const code = await new Promise<number | null>((resolveExit) => child.on('close', resolveExit));

    expect(code).toBe(2);
    expect(reportRun(root, plan.runId).result).toMatchObject({ status: 'CANCELLED', run: 'CANCELLED' });
  }, 60000);

  it('should record a dependency order violation and still succeed once verified', async () => {
    const { root, plan } = approvedRun();

    await deliver(root, plan, 'codex', 'order-violation');
    await verifyAll(root, plan);
    const { result } = reportRun(root, plan.runId);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.anomalies).toEqual([expect.objectContaining({ code: 'DEPENDENCY_ORDER_VIOLATION' })]);
  }, 60000);

  it('should report NOT_VERIFIED for a host that prints no run-level events', async () => {
    const { root, plan } = approvedRun();

    expect(await deliver(root, plan, 'codex', 'silent')).toMatchObject({ status: 'NOT_VERIFIED', reason: expect.stringContaining('no end-of-run event') as unknown });
  }, 60000);

  it('should redact credentials from the stored host transcript and keep it inside this run', async () => {
    const { root, plan } = approvedRun();
    const delivery = await deliver(root, plan, 'codex', 'leak');
    const transcript = readFileSync(join(root, delivery.transcript!), 'utf8');

    expect(delivery.transcript!.startsWith(`.ai-agent-setup/runs/${plan.runId}/evidence/host-codex-`)).toBe(true);
    expect(transcript).not.toContain('Zq7Zq7');
    expect(transcript).toContain('[REDACTED');
  }, 60000);

  it('should flag a transcript changed after the run', async () => {
    const { root, plan } = approvedRun();
    const delivery = await deliver(root, plan, 'codex', 'success');
    writeFileSync(join(root, delivery.transcript!), '{"type":"turn.completed"}\n');

    expect(reportRun(root, plan.runId).result.integrity.status).toBe('VIOLATED');
  }, 60000);
});

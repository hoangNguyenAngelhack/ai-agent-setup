import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildKpiReport } from '../../src/app/kpi-report';
import { buildExecutionReport } from '../../src/app/reports';
import { approveRun, createRun, deliverRun, loadRun, recordEvent, reportRun, signedEvidence, verifyStep } from '../../src/app/runs';
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
    delete process.env.FAKE_HOST_USAGE;
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

  it.each([
    ['claude-code', { input: 12, output: 50, cacheRead: 200, cacheWrite: 20 }, 0.0125],
    ['codex', { input: 300, output: 45, cacheRead: 120, cacheWrite: 0 }, null],
  ] as const)('should measure the token usage %s reports, sign it, and give the cost per accepted outcome (W2.2-04)', async (host, tokens, costUsd) => {
    const { root, plan } = approvedRun();
    process.env.FAKE_HOST_USAGE = '1';

    const delivery = await deliver(root, plan, host, 'success');
    // Claude repeats message msg_a on two lines: counted once. Its session total (999) is not used
    // because per-message usage was seen.
    // Two distinct tool calls; the repeated one (same id) is counted once, a non-tool item not at all.
    expect(delivery.usage).toMatchObject({ tokens, label: 'measured', toolCalls: 2, cost: costUsd === null ? null : { usd: costUsd, label: 'estimated' } });
    expect(signedEvidence(root, plan.runId)).toContain(delivery.usage!.file);
    // Why usage is read from the raw stream: the stored transcript has every *_tokens value redacted.
    const stored = readFileSync(join(root, delivery.transcript!), 'utf8');
    expect(stored).toContain('[REDACTED:assignment]');
    // The redacted transcript stays readable: every line is still JSON.
    for (const line of stored.trim().split('\n')) expect(() => JSON.parse(line) as unknown, line).not.toThrow();

    await verifyAll(root, plan);
    const [summary] = buildExecutionReport(root).usage.hosts;
    expect(summary).toMatchObject({ host, deliveries: 1, complete: true, acceptedOutcomes: 1, tokens, perAcceptedOutcome: tokens });
    expect(summary!.cost).toEqual(costUsd === null ? null : expect.objectContaining({ usd: costUsd, perAcceptedOutcomeUsd: costUsd }));

    // Lowering the recorded usage afterwards breaks the signature: the figure is withdrawn.
    writeFileSync(join(root, delivery.usage!.file), JSON.stringify({ ...delivery.usage, file: undefined, tokens: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } }));
    const tampered = buildExecutionReport(root);
    expect(tampered.runs.items[0]).toMatchObject({ integrity: 'VIOLATED', deliveries: [{ status: 'UNSIGNED', tokens: null }] });
    expect(tampered.usage.hosts[0]).toMatchObject({ complete: false, perAcceptedOutcome: null, cost: null, reason: expect.stringContaining('1 UNSIGNED') as unknown });
  }, 60000);

  it('should report every KPI from the runs, measured where proved and NOT_VERIFIED otherwise (W2.2-07)', async () => {
    const accepted = approvedRun();
    const root = accepted.root;
    process.env.FAKE_HOST_USAGE = '1';
    await deliver(root, accepted.plan, 'claude-code', 'success');
    await verifyAll(root, accepted.plan);
    const waiting = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    await deliver(root, waiting, 'codex', 'approval');

    const kpis = Object.fromEntries(buildKpiReport(root).kpis.map((item) => [item.id, item]));
    expect(kpis['task-acceptance-rate']).toMatchObject({ status: 'MEASURED', values: [{ scope: 'all runs', value: 0.5, unit: 'ratio', n: 2 }] });
    expect(kpis['median-completion-time']!.values.map((value) => [value.scope, value.n])).toEqual([
      ['delivered runs', 2],
      ['accepted runs', 1],
    ]);
    expect(kpis['tokens-per-accepted-task']).toMatchObject({ status: 'MEASURED', notes: ['codex: no accepted outcome (SUCCEEDED run) in the period'] });
    expect(kpis['tokens-per-accepted-task']!.values).toContainEqual({ scope: 'claude-code output', value: 50, unit: 'tokens', n: 1 });
    expect(kpis['cost-per-accepted-task']).toMatchObject({ status: 'ESTIMATED', label: 'estimated', values: [{ scope: 'claude-code', value: 0.0125, unit: 'USD', n: 1 }] });
    expect(kpis['tool-calls']).toMatchObject({ status: 'MEASURED', values: [{ value: 2, n: 2 }] });
    expect(kpis['human-intervention']).toMatchObject({ status: 'MEASURED', values: [{ scope: 'mean per run', value: 0.5, n: 2 }] });
    expect(kpis['regression-rate']).toMatchObject({ status: 'MEASURED', values: [{ value: 0 }] });
    expect(['test-pass-rate', 'security-findings', 'installation-reliability'].map((id) => kpis[id]!.status)).toEqual(['NOT_VERIFIED', 'NOT_VERIFIED', 'NOT_VERIFIED']);
  }, 60000);

  it('should print the measured usage in run deliver and the per-host table in report', () => {
    const { root, plan } = approvedRun();
    const cli = (args: string[]) =>
      spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, FAKE_HOST_MODE: 'success', FAKE_HOST_USAGE: '1' } }).stdout;
    const eventCommand = `"${process.execPath}" "${CLI}" run event ${plan.runId}`;

    expect(cli(['run', 'deliver', plan.runId, '--host', 'claude-code', '--event-command', eventCommand])).toContain(
      'usage: input 12, output 50, cache read 200, cache write 20 (measured); cost: 0.0125 USD (estimated: claude-code\'s own price calculation; not an invoice)',
    );
    expect(cli(['run', 'deliver', plan.runId, '--host', 'codex', '--event-command', eventCommand])).toContain('cost: not reported by the host');
    const report = cli(['report']);
    expect(report).toContain('## Token usage per host (measured)');
    expect(report).toContain('| claude-code | 1 | 1 | 12 / 50 / 200 / 20 | 0 | n/a | 0.0125 |');
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
    // Under a loaded machine the CLI can take seconds to start: wait for the host's first event
    // (so the SIGINT handler is installed) before pressing Ctrl-C, and fail clearly if it never comes.
    const started = () => readFileSync(join(root, '.ai-agent-setup', 'runs', plan.runId, 'events.jsonl'), 'utf8').includes('STEP_STARTED');
    for (let tries = 0; tries < 400 && !started(); tries += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    expect(started()).toBe(true);
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
    expect(transcript.trim().split('\n').every((line) => typeof JSON.parse(line) === 'object')).toBe(true);
    expect(transcript).toContain('[REDACTED');
  }, 60000);

  it('should flag a transcript changed after the run', async () => {
    const { root, plan } = approvedRun();
    const delivery = await deliver(root, plan, 'codex', 'success');
    writeFileSync(join(root, delivery.transcript!), '{"type":"turn.completed"}\n');

    expect(reportRun(root, plan.runId).result.integrity.status).toBe('VIOLATED');
  }, 60000);
});

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256File } from '../../../src/app/integrity';
import { buildExecutionReport, renderExecutionReport } from '../../../src/app/reports';
import { approveRun, createRun, recordEvent } from '../../../src/app/runs';
import { usageByHost, type ReportDelivery } from '../../../src/app/usage-report';
import { UsageMeter } from '../../../src/core/evaluation';
import { PLAN_ID, projectWithPlan } from '../../helpers/run-project';

/** One delivery's files, written the way runHost writes them; `sign` records their checksums. */
function delivery(root: string, runId: string, files: { transcript: string; usage?: unknown; sign?: boolean }, host = 'codex', stamp = 1): string {
  const dir = join('.ai-agent-setup', 'runs', runId, 'evidence');
  mkdirSync(join(root, dir), { recursive: true });
  const transcript = `${dir}/host-${host}-${stamp}.jsonl`;
  const usage = `${dir}/usage-${host}-${stamp}.json`;
  writeFileSync(join(root, transcript), files.transcript);
  if (files.usage !== undefined) writeFileSync(join(root, usage), typeof files.usage === 'string' ? files.usage : JSON.stringify(files.usage));
  if (files.sign) {
    const evidence = Object.fromEntries([transcript, usage].filter((path) => sha256File(join(root, path))).map((path) => [path, sha256File(join(root, path))!]));
    recordEvent(root, runId, { type: 'RUN_STARTED', source: 'orchestrator' }, new Date(), evidence);
  }
  return usage;
}

const measured = (input: number) => {
  const meter = new UsageMeter('codex');
  meter.add({ tokens: { input, output: 2 } });
  return meter.result();
};

const run = (root: string) => approveRun(root, createRun(root, PLAN_ID).runId, 'user').runId;
/** Delivery statuses of `runIds`, in that order (run ids made in the same second sort at random). */
const statuses = (root: string, runIds: string[]) => {
  const items = buildExecutionReport(root).runs.items;
  return runIds.map((runId) => items.find((item) => item.runId === runId)!.deliveries.map((entry) => entry.status));
};

describe('token usage in the execution report (W2.2-04)', () => {
  it('should prove usage only from a signed usage file', () => {
    const root = projectWithPlan();
    const id = run(root);
    delivery(root, id, { transcript: '{"type":"turn.completed"}\n', usage: measured(10), sign: true });
    const report = buildExecutionReport(root);
    expect(report.runs.items[0]!.deliveries).toEqual([{ host: 'codex', status: 'MEASURED', tokens: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0 }, costUsd: null, toolCalls: 0 }]);
    // Measured but no accepted outcome yet: no per-outcome figure.
    expect(report.usage.hosts[0]).toMatchObject({ complete: true, acceptedOutcomes: 0, perAcceptedOutcome: null, cost: null, reason: 'no accepted outcome (SUCCEEDED run) in the period' });
  });

  it('should give each unproved delivery its status and keep its figures out', () => {
    const root = projectWithPlan();
    const ids = Array.from({ length: 6 }, () => run(root));
    // Delivered before W2.2-04: a transcript and no usage file.
    delivery(root, ids[0]!, { transcript: 'line\n' });
    // Usage written but never signed (the host stopped without an end-of-run event).
    delivery(root, ids[1]!, { transcript: 'line\n', usage: measured(10) });
    // Signed, but the stream carried no usage.
    delivery(root, ids[2]!, { transcript: 'line\n', usage: new UsageMeter('codex').result(), sign: true });
    // Off-contract usage files.
    delivery(root, ids[3]!, { transcript: 'line\n', usage: '{ not json', sign: true });
    delivery(root, ids[4]!, { transcript: 'line\n', usage: { ...measured(1), samples: -1 }, sign: true });
    delivery(root, ids[5]!, { transcript: 'line\n', usage: { ...measured(1), host: 'claude-code' }, sign: true });

    expect(statuses(root, ids)).toEqual([['NOT_RECORDED'], ['UNSIGNED'], ['NOT_REPORTED'], ['INVALID'], ['INVALID'], ['INVALID']]);
    const [codex] = buildExecutionReport(root).usage.hosts;
    expect(codex).toMatchObject({ deliveries: 6, complete: false, tokens: { input: 0, output: 0 }, perAcceptedOutcome: null, cost: null });
    expect(codex!.byStatus).toEqual({ MEASURED: 0, NOT_STARTED: 0, NOT_REPORTED: 1, UNSIGNED: 1, NOT_RECORDED: 1, INVALID: 3 });
    expect(codex!.reason).toBe('6 of 6 deliveries have no proved usage (1 NOT_REPORTED, 1 UNSIGNED, 1 NOT_RECORDED, 3 INVALID); totals are a lower bound');
    expect(renderExecutionReport(buildExecutionReport(root))).toContain('| codex | 6 | 0 | 0 / 0 / 0 / 0 | 0 | n/a | not reported |');
  });

  it('should count a host that never printed anything as zero only in a verified run', () => {
    const root = projectWithPlan();
    const ids = [run(root), run(root)];
    delivery(root, ids[0]!, { transcript: '' });
    delivery(root, ids[1]!, { transcript: '', usage: new UsageMeter('codex').result() });
    expect(statuses(root, ids)).toEqual([['NOT_STARTED'], ['NOT_STARTED']]);
    expect(buildExecutionReport(root).usage.hosts[0]).toMatchObject({ complete: true, tokens: { input: 0 }, cost: null });

    // The same empty transcript in a run whose plan was changed proves nothing.
    const tampered = run(root);
    delivery(root, tampered, { transcript: '' });
    const planFile = join(root, '.ai-agent-setup', 'runs', tampered, 'execution-plan.json');
    writeFileSync(planFile, readFileSync(planFile, 'utf8').replace('"revision": 1', '"revision": 7'));
    expect(statuses(root, [tampered])).toEqual([['NOT_RECORDED']]);
    expect(buildExecutionReport(root).usage.hosts[0]!.complete).toBe(false);
  });

  it('should spread the tokens of every delivery, accepted or not, over the accepted outcomes', () => {
    const tokens = (input: number) => ({ input, output: 1, cacheRead: 0, cacheWrite: 0 });
    const measuredDelivery = (input: number, costUsd: number | null): ReportDelivery => ({ host: 'claude-code', status: 'MEASURED', tokens: tokens(input), costUsd, toolCalls: null });
    const [summary] = usageByHost([
      { status: 'SUCCEEDED', deliveries: [measuredDelivery(10, 0.1)] },
      { status: 'FAILED', deliveries: [measuredDelivery(20, 0.2)] },
      { status: 'SUCCEEDED', deliveries: [measuredDelivery(5, 0.05), measuredDelivery(5, 0.05)] },
      { status: 'SUCCEEDED', deliveries: [] },
    ]);
    expect(summary).toMatchObject({ deliveries: 4, complete: true, acceptedOutcomes: 2, tokens: { input: 40, output: 4, cacheRead: 0, cacheWrite: 0 }, perAcceptedOutcome: { input: 20, output: 2, cacheRead: 0, cacheWrite: 0 } });
    expect(summary!.cost).toEqual({ usd: 0.4, perAcceptedOutcomeUsd: 0.2, label: 'estimated', basis: "claude-code's own price calculation; not an invoice" });
    expect(summary!.reason).toBe('measured tokens of all 4 deliveries, accepted or not, divided by 2 SUCCEEDED run(s)');

    // One measured delivery without the host's cost figure: no money figure at all.
    expect(usageByHost([{ status: 'SUCCEEDED', deliveries: [measuredDelivery(1, 0.1), measuredDelivery(1, null)] }])[0]!.cost).toBeNull();
    // Rounded to one decimal; hosts are summarised separately.
    const split = usageByHost([{ status: 'SUCCEEDED', deliveries: [measuredDelivery(10, null), { ...measuredDelivery(7, null), host: 'codex' }] }, { status: 'SUCCEEDED', deliveries: [measuredDelivery(0, null)] }]);
    expect(split.map((host) => [host.host, host.perAcceptedOutcome?.input])).toEqual([
      ['claude-code', 5],
      ['codex', 7],
    ]);
    expect(usageByHost([{ status: 'SUCCEEDED', deliveries: [measuredDelivery(10, null)] }, { status: 'SUCCEEDED', deliveries: [measuredDelivery(0, null)] }, { status: 'SUCCEEDED', deliveries: [measuredDelivery(0, null)] }])[0]!.perAcceptedOutcome!.input).toBe(3.3);
  });
});

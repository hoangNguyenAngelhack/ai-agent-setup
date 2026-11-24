import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkedGateReport } from '../../../src/app/gates';
import { buildExecutionReport, renderExecutionReport } from '../../../src/app/reports';
import { approveRun, createRun, recordEvent } from '../../../src/app/runs';
import { gateReportErrors, type GateRecord, type GateReport } from '../../../src/quality';
import { SchemaValidator } from '../../../src/registry';
import { writeTree } from '../../helpers/fs-tree';
import { PLAN_ID, projectWithPlan } from '../../helpers/run-project';
import { REPO_ROOT } from '../../helpers/v1-cli';

const schemas = new SchemaValidator(join(REPO_ROOT, 'catalog', 'schemas'));
const validateReport = (value: unknown) => schemas.validate('urn:ai-agent-setup:contracts:v1:gate-report', value);

function record(gate: string, status: GateRecord['status']): GateRecord {
  return {
    schemaVersion: 'gate-record/v1',
    runId: 'run-20261124T100000Z-abcdef',
    gate,
    gateVersion: '1.0.0',
    category: 'build',
    project: { name: 'p', commit: null },
    command: status === 'NOT_VERIFIED' ? null : 'node ok.js',
    environment: { platform: 'darwin', arch: 'arm64', node: 'v24', ci: false },
    startedAt: '2026-11-24T10:00:00Z',
    endedAt: '2026-11-24T10:00:01Z',
    durationMs: 1000,
    exitCode: status === 'NOT_VERIFIED' ? null : status === 'PASS' ? 0 : 1,
    status,
    measured: status !== 'NOT_VERIFIED',
    reason: status === 'PASS' ? null : 'reason',
    evidence: status === 'NOT_VERIFIED' ? [] : [{ type: 'command', command: 'node ok.js', exitCode: status === 'PASS' ? 0 : 1 }],
    checksum: null,
  };
}

function gateReport(overrides: Partial<GateReport> = {}): GateReport {
  const records = [record('gate.build', 'PASS'), record('gate.lint', 'PASS')];
  return {
    schemaVersion: 'gate-report/v1',
    runId: 'run-20261124T100000Z-abcdef',
    project: { name: 'p', commit: null },
    startedAt: '2026-11-24T10:00:00Z',
    endedAt: '2026-11-24T10:00:02Z',
    status: 'PASS',
    reason: 'all 2 required gates passed',
    required: ['gate.build', 'gate.lint'],
    records,
    summary: { PASS: 2, FAIL: 0, NOT_VERIFIED: 0 },
    ...overrides,
  };
}

describe('gate report contract (W2.2-05)', () => {
  it('should accept a consistent report', () => {
    expect(validateReport(gateReport()).valid).toBe(true);
    expect(gateReportErrors(gateReport())).toEqual([]);
    expect(checkedGateReport(gateReport(), validateReport)).toEqual(gateReport());
  });

  it('should reject PASS with no required gate', () => {
    expect(validateReport(gateReport({ required: [] })).valid).toBe(false);
  });

  it('should find totals and a status that do not follow from the records', () => {
    expect(gateReportErrors(gateReport({ summary: { PASS: 3, FAIL: 0, NOT_VERIFIED: 0 } }))).toEqual(['/summary/PASS: 3 but 2 record(s)']);
    expect(gateReportErrors(gateReport({ required: ['gate.build', 'gate.typecheck'] }))).toEqual(expect.arrayContaining(['/required: no record for gate.typecheck', '/status: PASS but the required gates give NOT_VERIFIED']));
    expect(gateReportErrors(gateReport({ records: [record('gate.build', 'PASS'), { ...record('gate.lint', 'PASS'), runId: 'run-20261124T100000Z-ffffff' }] }))).toEqual(['/records: gate.lint belongs to run run-20261124T100000Z-ffffff']);
  });

  it('should store an inconsistent PASS as NOT_VERIFIED, and refuse to store anything else invalid', () => {
    const claimed = gateReport({ records: [record('gate.build', 'PASS'), record('gate.lint', 'NOT_VERIFIED')], summary: { PASS: 1, FAIL: 0, NOT_VERIFIED: 1 } });
    const downgraded = checkedGateReport(claimed, validateReport);
    expect(downgraded).toMatchObject({ status: 'NOT_VERIFIED', reason: expect.stringContaining('report failed contract validation') as unknown });
    expect(() => checkedGateReport(gateReport({ required: ['gate.build', 'gate.typecheck'] }), validateReport)).toThrow(/no record for gate.typecheck/);
    expect(() => checkedGateReport(gateReport({ status: 'FAIL', summary: { PASS: 9, FAIL: 0, NOT_VERIFIED: 0 } }), validateReport)).toThrow(/is invalid/);
    expect(() => checkedGateReport(gateReport({ summary: { PASS: 9, FAIL: 0, NOT_VERIFIED: 0 } }), validateReport)).toThrow(/summary\/PASS/);
  });
});

function history(root: string, entries: Array<Record<string, unknown>>): void {
  mkdirSync(join(root, '.ai-agent-setup', 'gates'), { recursive: true });
  for (const entry of entries) appendFileSync(join(root, '.ai-agent-setup', 'gates', 'history.jsonl'), `${JSON.stringify({ reason: null, ...entry })}\n`);
}

describe('execution report across runs (W2.2-05)', () => {
  it('should report an empty project without inventing anything', () => {
    const report = buildExecutionReport(writeTree({}), { now: new Date('2026-11-24T12:00:00Z') });
    expect(report.runs).toMatchObject({ total: 0, items: [] });
    expect(report.gates).toEqual({ invocations: 0, items: [] });
    expect(renderExecutionReport(report)).toContain('No gate history.');
  });

  it('should count runs by status and integrity, and list unreadable runs without counting them as success', () => {
    const root = projectWithPlan();
    const pending = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const cancelled = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, cancelled.runId, { type: 'RUN_CANCELLED', source: 'user', reason: 'stopped' });
    const tampered = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    const planFile = join(root, '.ai-agent-setup', 'runs', tampered.runId, 'execution-plan.json');
    writeFileSync(planFile, readFileSync(planFile, 'utf8').replace('"revision": 1', '"revision": 7'));

    const report = buildExecutionReport(root);
    expect(report.runs.total).toBe(3);
    expect(report.runs.byStatus).toMatchObject({ SUCCEEDED: 0, CANCELLED: 1, NOT_VERIFIED: 1, UNREADABLE: 1 });
    expect(report.runs.byIntegrity).toEqual({ VERIFIED: 2, UNSIGNED: 0, VIOLATED: 0 });
    expect(report.runs.items.find((run) => run.runId === tampered.runId)).toMatchObject({ status: 'UNREADABLE', integrity: null });
    expect(report.runs.items.find((run) => run.runId === pending.runId)).toMatchObject({ status: 'NOT_VERIFIED', steps: 2, stepsSucceeded: 0 });
    // Read-only: no result.json written.
    expect(() => readFileSync(join(root, '.ai-agent-setup', 'runs', pending.runId, 'result.json'))).toThrow();
  });

  it('should summarise gate history: verified pass rate, measured durations, mixed results on one commit', () => {
    const root = writeTree({});
    history(root, [
      { runId: 'run-20261120T100000Z-000001', gate: 'gate.unit-tests', status: 'PASS', at: '2026-11-20T10:00:01Z', durationMs: 100, commit: 'aaa' },
      { runId: 'run-20261121T100000Z-000002', gate: 'gate.unit-tests', status: 'FAIL', at: '2026-11-21T10:00:01Z', durationMs: 300, commit: 'aaa' },
      { runId: 'run-20261122T100000Z-000003', gate: 'gate.unit-tests', status: 'NOT_VERIFIED', at: '2026-11-22T10:00:01Z', durationMs: 5, commit: 'bbb' },
      { runId: 'run-20261122T100000Z-000003', gate: 'gate.build', status: 'NOT_VERIFIED', at: '2026-11-22T10:00:01Z', durationMs: 1, commit: null },
    ]);
    const report = buildExecutionReport(root);
    expect(report.gates.invocations).toBe(3);
    expect(report.gates.items).toEqual([
      { gate: 'gate.build', total: 1, PASS: 0, FAIL: 0, NOT_VERIFIED: 1, passRateOfVerified: null, last: { status: 'NOT_VERIFIED', at: '2026-11-22T10:00:01Z', runId: 'run-20261122T100000Z-000003' }, durationMs: null, mixedResultsOnCommit: [] },
      { gate: 'gate.unit-tests', total: 3, PASS: 1, FAIL: 1, NOT_VERIFIED: 1, passRateOfVerified: 0.5, last: { status: 'NOT_VERIFIED', at: '2026-11-22T10:00:01Z', runId: 'run-20261122T100000Z-000003' }, durationMs: { median: 200, max: 300 }, mixedResultsOnCommit: ['aaa'] },
    ]);
    const markdown = renderExecutionReport(report);
    expect(markdown).toContain('| gate.unit-tests | 3 | 1 | 1 | 1 | 50% | 200 | NOT_VERIFIED | aaa |');
    expect(markdown).toContain('nothing is estimated');

    const recent = buildExecutionReport(root, { since: '2026-11-21' });
    expect(recent.since).toBe('2026-11-21T00:00:00.000Z');
    expect(recent.gates.items.find((gate) => gate.gate === 'gate.unit-tests')).toMatchObject({ total: 2, mixedResultsOnCommit: [] });
  });

  it('should reject an unparseable date', () => {
    expect(() => buildExecutionReport(writeTree({}), { since: 'last tuesday' })).toThrow(/Invalid date/);
  });
});

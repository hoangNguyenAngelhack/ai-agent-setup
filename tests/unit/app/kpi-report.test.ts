import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildKpiReport, renderKpiReport } from '../../../src/app/kpi-report';
import { approveRun, createRun, recordEvent } from '../../../src/app/runs';
import { writeTree } from '../../helpers/fs-tree';
import { PLAN_ID, projectWithPlan } from '../../helpers/run-project';

const KPI_IDS = [
  'task-acceptance-rate',
  'test-pass-rate',
  'regression-rate',
  'security-findings',
  'median-completion-time',
  'tokens-per-accepted-task',
  'cost-per-accepted-task',
  'tool-calls',
  'human-intervention',
  'installation-reliability',
];

const byId = (root: string, since?: string) => Object.fromEntries(buildKpiReport(root, since ? { since } : {}).kpis.map((item) => [item.id, item]));

describe('KPI report (W2.2-07)', () => {
  it('should list every KPI of 09 §6 and give no figure for an empty project', () => {
    const report = buildKpiReport(writeTree({}), { now: new Date('2026-11-25T00:00:00Z') });
    expect(report.kpis.map((item) => item.id)).toEqual(KPI_IDS);
    for (const item of report.kpis) {
      expect(item).toMatchObject({ status: 'NOT_VERIFIED', label: null, values: [] });
      expect(item.notes.length).toBeGreaterThan(0);
    }
    // Every comparative hypothesis waits for the benchmark arms.
    expect(report.kpis.filter((item) => item.hypothesis).every((item) => item.hypothesis!.status === 'NOT_VERIFIED')).toBe(true);
    const markdown = renderKpiReport(report);
    expect(markdown).toContain('| Task acceptance rate | NOT_VERIFIED | - | ≥ +10 percentage points (NOT_VERIFIED) | no execution run in the period |');
    expect(markdown).toContain('NOT_VERIFIED means no figure');
  });

  it('should count an invocation that fails a gate whose previous verified result passed', () => {
    const root = writeTree({});
    mkdirSync(join(root, '.ai-agent-setup', 'gates'), { recursive: true });
    const entry = (runId: string, gate: string, status: string, at: string) => ({ runId, gate, status, at, durationMs: 1, commit: null, reason: null });
    for (const line of [
      entry('run-20261120T100000Z-000001', 'gate.unit-tests', 'PASS', '2026-11-20T10:00:00Z'),
      entry('run-20261120T100000Z-000001', 'gate.build', 'FAIL', '2026-11-20T10:00:00Z'),
      entry('run-20261121T100000Z-000002', 'gate.unit-tests', 'FAIL', '2026-11-21T10:00:00Z'),
      entry('run-20261122T100000Z-000003', 'gate.unit-tests', 'FAIL', '2026-11-22T10:00:00Z'),
      entry('run-20261123T100000Z-000004', 'gate.unit-tests', 'PASS', '2026-11-23T10:00:00Z'),
      entry('run-20261123T100000Z-000004', 'gate.build', 'FAIL', '2026-11-23T10:00:00Z'),
      entry('run-20261124T100000Z-000005', 'gate.lint', 'NOT_VERIFIED', '2026-11-24T10:00:00Z'),
    ]) {
      appendFileSync(join(root, '.ai-agent-setup', 'gates', 'history.jsonl'), `${JSON.stringify(line)}\n`);
    }
    // Only invocation 2 breaks a passing gate; a gate that keeps failing, or starts failing, is not a regression.
    expect(byId(root)['regression-rate']).toMatchObject({ status: 'MEASURED', values: [{ scope: 'gate invocations', value: 0.25, unit: 'ratio', n: 4 }], notes: ['1 breaking invocation(s)'] });
    expect(byId(root, '2026-11-22')['regression-rate']!.values[0]).toMatchObject({ value: 0, n: 2 });
  });

  it('should leave out the events of a run whose integrity is not VERIFIED', () => {
    const root = projectWithPlan();
    const ok = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, ok.runId, { type: 'RUN_STARTED', source: 'orchestrator' }, new Date('2026-11-24T10:00:00Z'));
    recordEvent(root, ok.runId, { type: 'RUN_COMPLETED', source: 'host' }, new Date('2026-11-24T10:00:30Z'));
    const changed = approveRun(root, createRun(root, PLAN_ID).runId, 'user');
    recordEvent(root, changed.runId, { type: 'RUN_STARTED', source: 'orchestrator' }, new Date('2026-11-24T10:00:00Z'));
    recordEvent(root, changed.runId, { type: 'RUN_COMPLETED', source: 'host' }, new Date('2026-11-24T10:00:01Z'));
    const events = join(root, '.ai-agent-setup', 'runs', changed.runId, 'events.jsonl');
    writeFileSync(events, readFileSync(events, 'utf8').replace('10:00:01', '10:00:02'));

    const kpis = byId(root);
    expect(kpis['median-completion-time']).toMatchObject({ values: [{ scope: 'delivered runs', value: 30000, unit: 'ms', n: 1 }] });
    expect(kpis['median-completion-time']!.notes).toEqual(['1 run(s) without VERIFIED integrity excluded: their events are not proved']);
    expect(kpis['human-intervention']).toMatchObject({ values: [{ value: 0, n: 1 }], notes: ['1 run(s) without VERIFIED integrity excluded: their events are not proved'] });
    expect(kpis['task-acceptance-rate']).toMatchObject({ values: [{ value: 0, n: 2 }] });
  });
});

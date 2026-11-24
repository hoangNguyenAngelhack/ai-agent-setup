import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { approveRun } from '../../src/app/runs';
import { REPO_ROOT } from '../helpers/v1-cli';

/** `gates` (V2.2) and `run` (ADR-009, W2.1-09/10) through bin/cli.js. */
const CLI = join(REPO_ROOT, 'bin', 'cli.js');
const cli = (cwd: string, args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

function installedProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'run-'));
  cpSync(join(REPO_ROOT, 'templates', 'backend'), root, { recursive: true });
  writeFileSync(join(root, 'ok.js'), 'console.log("ok")');
  writeFileSync(join(root, 'fail.js'), 'process.exit(1)');
  expect(cli(root, ['setup', '--yes']).status).toBe(0);
  return root;
}

const gatesConfig = (root: string, gates: Record<string, string>, required: string[] = []) =>
  writeFileSync(join(root, '.ai-agent-setup', 'gates.json'), JSON.stringify({ gates: Object.fromEntries(Object.entries(gates).map(([id, command]) => [id, { command }])), required }));

describe('gates CLI', () => {
  it('should exit 0 on PASS, 1 on FAIL and 2 on NOT_VERIFIED', () => {
    const root = installedProject();
    const starter = ['--profile', 'profile.starter'];

    gatesConfig(root, { 'gate.build': 'node ok.js', 'gate.unit-tests': 'node ok.js' });
    const pass = cli(root, ['gates', 'run', ...starter]);
    expect(pass.status).toBe(0);
    expect(pass.stdout).toContain(': PASS');

    gatesConfig(root, { 'gate.build': 'node ok.js', 'gate.unit-tests': 'node fail.js' });
    expect(cli(root, ['gates', 'run', ...starter]).status).toBe(1);

    expect(cli(root, ['gates', 'run', ...starter, '--skip', 'gate.unit-tests']).status).toBe(2);
    expect(JSON.parse(cli(root, ['gates', 'history', '--gate', 'gate.unit-tests', '--json']).stdout)).toHaveLength(3);
  });

  it('should list every gate with its support status', () => {
    const listing = JSON.parse(cli(installedProject(), ['gates', 'list', '--json']).stdout) as { gates: Array<{ id: string; support: string }> };

    expect(listing.gates.map((gate) => gate.id)).toContain('gate.deployment-readiness');
    expect(listing.gates.every((gate) => gate.support)).toBe(true);
  });
});

describe('run CLI', () => {
  it('should create, approve, record events and reconcile a run without claiming success', () => {
    const root = installedProject();
    const planOut = cli(root, ['plan', 'Implement the orders API endpoint', '--json']);
    const planId = (JSON.parse(planOut.stdout) as { id: string }).id;
    expect(existsSync(join(root, '.ai-agent-setup', 'runs', planId, 'plan.json'))).toBe(true);

    const created = cli(root, ['run', 'create', planId]);
    const runId = /Created (run-\S+)/.exec(created.stdout)![1]!;
    expect(cli(root, ['run', 'event', runId, '--type', 'STEP_STARTED', '--step', 'x']).status).toBe(1);
    // An agent's shell has no terminal: approving through the CLI is refused; the user approves.
    expect(cli(root, ['run', 'approve', runId]).stderr).toContain('needs an interactive terminal');
    approveRun(root, runId, 'user');

    const step = (JSON.parse(cli(root, ['run', 'status', runId, '--json']).stdout) as { steps: Array<{ id: string }> }).steps[0]!.id;
    expect(cli(root, ['run', 'event', runId, '--type', 'STEP_STARTED', '--step', step]).stdout).toBe('Recorded.\n');
    expect(cli(root, ['run', 'event', runId, '--type', 'STEP_COMPLETED', '--step', step, '--evidence', 'notes.md']).status).toBe(0);

    const status = cli(root, ['run', 'status', runId]);
    expect(status.status).toBe(2);
    expect(status.stdout).toContain(`${runId}: NOT_VERIFIED`);
    expect(status.stdout).toContain('awaiting orchestrator verification');

    expect(cli(root, ['run', 'cancel', runId, '--reason', 'stop']).status).toBe(0);
    expect(cli(root, ['run', 'status', runId]).stdout).toContain(`${runId}: CANCELLED`);
  });

  it('should print the delivery command for a host without running it', () => {
    const root = installedProject();
    const planId = (JSON.parse(cli(root, ['plan', 'Implement the orders API endpoint', '--json']).stdout) as { id: string }).id;
    const runId = /Created (run-\S+)/.exec(cli(root, ['run', 'create', planId]).stdout)![1]!;
    approveRun(root, runId, 'user');

    const result = cli(root, ['run', 'deliver', runId, '--host', 'claude-code', '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('$ claude -p <prompt> --output-format stream-json --verbose');
    expect(result.stdout).toContain('unsupported:');
  });
});

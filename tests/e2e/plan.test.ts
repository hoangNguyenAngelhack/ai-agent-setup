import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashTree } from '../helpers/fs-tree';
import { REPO_ROOT } from '../helpers/v1-cli';

/** `plan` and `explain` through bin/cli.js (W2.1-05/07). */
const CLI = join(REPO_ROOT, 'bin', 'cli.js');

function backendProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'plan-'));
  cpSync(join(REPO_ROOT, 'templates', 'backend'), root, { recursive: true });
  writeFileSync(join(root, '.gitconfig'), '');
  return root;
}

const cli = (cwd: string, args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

describe('plan and explain', () => {
  it('should print a plan without writing anything to a project that is not installed', () => {
    const root = backendProject();
    const before = hashTree(root);

    const result = cli(root, ['plan', 'Add a paginated GET /orders endpoint']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('backend.api-design → agent.implementer');
    expect(result.stdout).toContain('skill.nodejs-backend');
    expect(result.stdout).toContain('Not saved');
    expect(hashTree(root)).toEqual(before);
  });

  it('should save the plan in an installed project and explain it later', () => {
    const root = backendProject();
    expect(cli(root, ['setup', '--yes']).status).toBe(0);

    const planned = cli(root, ['plan', 'Fix the N+1 query in the GET /users endpoint', '--mode', 'automatic']);
    const id = /Saved: \.ai-agent-setup\/runs\/(plan-[^/]+)\/plan\.json/.exec(planned.stdout)?.[1];

    expect(id).toBeDefined();
    const explained = cli(root, ['explain', id!, '--json']);
    expect(explained.status).toBe(0);
    expect(JSON.parse(explained.stdout)).toMatchObject({ cost: { label: 'estimated' }, verification: expect.arrayContaining(['gate.build']) as unknown });
    expect(cli(root, ['doctor']).status).toBe(0);
  });

  it('should print valid JSON with --json', () => {
    const result = cli(backendProject(), ['plan', 'Write a PRD for a referral program', '--json']);

    expect(JSON.parse(result.stdout)).toMatchObject({ schema: 'plan/v1', classification: { type: 'analysis' }, gates: [] });
  });

  it('should honour manual selections and exit 1 for an invalid plan', () => {
    const root = backendProject();

    const manual = cli(root, ['plan', 'Add an endpoint', '--mode', 'manual', '--agent', 'agent.backend', '--approve-at', 'plan', '--json']);
    const invalid = cli(root, ['plan', 'Add an endpoint', '--exclude-agent', 'agent.implementer']);

    expect(JSON.parse(manual.stdout)).toMatchObject({ mode: 'manual', status: 'needs-approval', agents: ['agent.implementer'] });
    expect(invalid.status).toBe(1);
    expect(invalid.stdout).toContain('not re-added silently');
  });

  it('should reject a malformed plan id', () => {
    const result = cli(backendProject(), ['explain', '../../etc/passwd']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No saved plan');
  });
});

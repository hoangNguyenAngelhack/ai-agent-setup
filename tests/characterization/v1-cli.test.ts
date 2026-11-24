import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createV1Sandbox, fingerprintProject, runV1Cli, type V1Sandbox } from '../helpers/v1-cli';

/**
 * V1 characterization (docs/v2/09 §3.2). These tests freeze what V1 produces TODAY, including
 * known defects, so the V2 refactor has a regression baseline. Cases tagged `expected-change`
 * document a defect that a later work item fixes; update the snapshot in that work item.
 */
interface CharacterizationCase {
  id: string;
  args: string[];
  expectedChange?: string;
}

const CASES: CharacterizationCase[] = [
  { id: 'CH-1', args: ['ch1-backend', '-t', 'backend', '-y'] },
  { id: 'CH-2', args: ['ch2-nest', '-t', 'backend', '-f', 'nestjs', '-y'], expectedChange: 'F-04' },
  { id: 'CH-3', args: ['ch3-sqlite', '-t', 'backend', '--db', 'sqlite', '-y'], expectedChange: 'F-06' },
  { id: 'CH-4', args: ['ch4-strict', '-t', 'backend', '-T', 'strict', '-y'], expectedChange: 'F-05' },
  { id: 'CH-5', args: ['ch5-next-antd', '-t', 'frontend', '-f', 'nextjs', '-u', 'antd', '-y'], expectedChange: 'F-04' },
  { id: 'CH-6', args: ['ch6-vite', '-t', 'frontend', '-u', 'shadcn', '-y'] },
  { id: 'CH-7', args: ['ch7-mobile', '-t', 'mobile', '-y'] },
  { id: 'CH-8', args: ['ch8-fullstack', '-t', 'fullstack', '-y'] },
  { id: 'CH-9', args: ['ch9-honesty', '-t', 'backend', '-H', '-y'] },
];

describe.skipIf(process.platform === 'win32')('V1 CLI characterization', () => {
  let sandbox: V1Sandbox;

  beforeAll(() => {
    sandbox = createV1Sandbox();
  });

  afterAll(() => {
    if (sandbox) rmSync(sandbox.root, { recursive: true, force: true });
  });

  it.each(CASES)('$id produces a stable project tree', async ({ id, args }) => {
    const result = runV1Cli(sandbox, args);

    expect(result.status).toBe(0);
    const fingerprint = fingerprintProject(result.projectDir, sandbox.env);
    await expect(`${JSON.stringify(fingerprint, null, 2)}\n`).toMatchFileSnapshot(
      `./__snapshots__/${id}.json`,
    );
  });

  it('CH-10 --version reports the hard-coded V1 constant [expected-change F-02]', () => {
    const result = runV1Cli(sandbox, ['--version']);

    expect(result.stdout.trim()).toBe('create-ai-agent v1.5.1');
  });

  it('CH-2 ignores -f nestjs and produces Express [expected-change F-04]', () => {
    const { projectDir } = runV1Cli(sandbox, ['ch2b-nest', '-t', 'backend', '-f', 'nestjs', '-y']);

    expect(existsSync(join(projectDir, 'nest-cli.json'))).toBe(false);
    expect(fingerprintProject(projectDir, sandbox.env).commitMessage).toContain('backend/express');
  });

  it('CH-3 ignores --db sqlite in templates [expected-change F-06]', () => {
    const { projectDir } = runV1Cli(sandbox, ['ch3b-sqlite', '-t', 'backend', '--db', 'sqlite', '-y']);

    const schema = readFileSync(join(projectDir, 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toContain('provider = "postgresql"');
  });

  it('CH-4 does not write the selected tier into CLAUDE.md [expected-change F-05]', () => {
    const { projectDir } = runV1Cli(sandbox, ['ch4b-strict', '-t', 'backend', '-T', 'strict', '-y']);

    const claudeMd = readFileSync(join(projectDir, '.claude', 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('**Tier:** Standard');
    expect(fingerprintProject(projectDir, sandbox.env).commitMessage).toContain('strict');
  });

  it('CH-9 keeps honesty.md only when -H is given', () => {
    const withRule = runV1Cli(sandbox, ['ch9b-with', '-t', 'backend', '-H', '-y']);
    const withoutRule = runV1Cli(sandbox, ['ch9b-without', '-t', 'backend', '-y']);

    expect(existsSync(join(withRule.projectDir, '.claude', 'rules', 'honesty.md'))).toBe(true);
    expect(existsSync(join(withoutRule.projectDir, '.claude', 'rules', 'honesty.md'))).toBe(false);
  });

  it('refuses an existing directory (no setup flow in V1, F-10)', () => {
    runV1Cli(sandbox, ['ch-existing', '-t', 'backend', '-y']);
    const second = runV1Cli(sandbox, ['ch-existing', '-t', 'backend', '-y']);

    expect(second.status).toBe(1);
    expect(second.stdout).toContain('already exists');
  });
});

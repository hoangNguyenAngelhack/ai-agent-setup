import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main, type CliIO } from '../../../src/cli/main';
import { REPO_ROOT } from '../../helpers/v1-cli';

/**
 * The CLI run in-process through `main()` (tests/e2e covers the same flows through bin/cli.js in a
 * child process). Each case checks the exit code and what the user reads.
 */
interface Captured {
  code: number;
  out: string;
  err: string;
}

async function cli(cwd: string, argv: string[], answers: string[] = []): Promise<Captured> {
  let out = '';
  let err = '';
  const queue = [...answers];
  const io: CliIO = {
    cwd,
    write: (text) => {
      out += text;
    },
    error: (text) => {
      err += text;
    },
    ask: answers.length ? () => Promise.resolve(queue.shift() ?? '') : null,
  };
  const code = await main(argv, io);
  return { code, out, err };
}

function backend(): string {
  const root = mkdtempSync(join(tmpdir(), 'main-'));
  cpSync(join(REPO_ROOT, 'templates', 'backend'), root, { recursive: true });
  writeFileSync(join(root, 'ok.js'), 'console.log("ok")');
  writeFileSync(
    join(root, 'cov.cjs'), // .cjs: the template package is an ES module
    'const fs=require("fs");fs.mkdirSync("coverage",{recursive:true});fs.writeFileSync("coverage/coverage-summary.json",JSON.stringify({total:{statements:{pct:90},branches:{pct:90},functions:{pct:90},lines:{pct:90}}}))',
  );
  return root;
}

function gitRepo(root: string): string {
  const git = (...args: string[]) => spawnSync('git', ['-C', root, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], { encoding: 'utf8' });
  git('init', '-q');
  git('add', '.');
  git('commit', '-qm', 'init');
  return root;
}

describe('main — general', () => {
  it('should print help and version', async () => {
    expect((await cli(REPO_ROOT, ['--help'])).out).toContain('Usage:');
    expect((await cli(REPO_ROOT, ['--version'])).out).toMatch(/^create-ai-agent-setup \d+\.\d+\.\d+\n$/);
  });

  it('should report usage errors with exit 1 and a pointer to --help', async () => {
    const result = await cli(REPO_ROOT, ['plan', '--nope']);

    expect(result).toMatchObject({ code: 1, out: '' });
    expect(result.err).toContain('Unknown option --nope');
    expect(result.err).toContain('--help for usage');
  });

  it.each([
    [['catalog'], 'catalog validate'],
    [['plan'], 'plan "<task description>"'],
    [['explain'], 'explain <plan-id>'],
    [['gates', 'nope'], 'gates list|run|history'],
    [['run'], 'run create <plan-id>'],
    [['run', 'nope', 'x'], 'Unknown run action'],
    [['plan', 'x', '--budget', 'lots'], '--budget must be a number'],
    [['plan', 'x', '--mode', 'auto'], 'Invalid --mode'],
  ])('should reject %j', async (argv, message) => {
    const result = await cli(REPO_ROOT, argv);

    expect(result.code).toBe(1);
    expect(result.err).toContain(message);
  });

  it('should validate the bundled catalog', async () => {
    const result = await cli(REPO_ROOT, ['catalog', 'validate']);

    expect(result.code).toBe(0);
    expect(result.out).toContain('Context T0 profile.standard');
  });
});

describe('main — create', () => {
  it('should create a project non-interactively with flags', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'create-'));
    const result = await cli(cwd, ['api', '-t', 'backend', '-f', 'nestjs', '-T', 'strict', '-d', 'sqlite', '-a', 'codex', '-H', '-y']);

    expect(result.code).toBe(0);
    expect(result.out).toContain('Creating api (backend/nestjs, strict, adapters: codex)');
    expect(existsSync(join(cwd, 'api', 'AGENTS.md'))).toBe(true);
    expect(readFileSync(join(cwd, 'api', 'prisma', 'schema.prisma'), 'utf8')).toContain('sqlite');
  });

  it('should ask every question when not given flags', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'create-'));
    // name, type (2 = frontend), framework (2 = vite), ui (1), tier (1 = starter), author, email, host (3 = both), codegraph, honesty
    const result = await cli(cwd, [], ['web', '2', '2', '1', '1', 'Ada', 'ada@example.invalid', '3', 'n', 'y']);

    expect(result.code).toBe(0);
    expect(result.out).toContain('Creating web (frontend/vite/shadcn, starter, adapters: claude-code, codex)');
    expect(existsSync(join(cwd, 'web', 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(cwd, 'web', '.claude'))).toBe(true);
  });

  it.each([
    [['x', '-t', 'mobile', '-u', 'antd', '-y'], '--ui is only used for frontend projects'],
    [['x', '-t', 'fullstack', '-f', 'vite', '-y'], '--framework is not used for fullstack projects'],
    [['x', '-t', 'desktop', '-y'], 'Invalid --type'],
  ])('should reject inconsistent create flags %j', async (argv, message) => {
    const result = await cli(mkdtempSync(join(tmpdir(), 'create-')), argv);

    expect(result.code).toBe(1);
    expect(result.err).toContain(message);
  });
});

describe('main — setup, diff, doctor, rollback', () => {
  it('should plan, apply, check and roll back an install', async () => {
    const root = backend();

    const diff = await cli(root, ['diff', '--adapter', 'claude-code,codex']);
    expect(diff.code).toBe(0);
    expect(diff.out).toContain('Adapters: claude-code, codex');
    expect(diff.out).toContain('+++ ');

    const dry = await cli(root, ['setup', '--dry-run']);
    expect(dry.out).toMatch(/\d+ change\(s\), 0 unchanged/);

    const refused = await cli(root, ['setup']);
    expect(refused.code).toBe(1);

    expect((await cli(root, ['setup', '--yes', '--enable-tool', 'tool.mcp-github'])).code).toBe(0);
    expect((await cli(root, ['setup', '--yes'])).out).toContain('0 change(s)');
    expect((await cli(root, ['doctor'])).out).toContain('Healthy:');

    writeFileSync(join(root, '.claude', 'CLAUDE.md'), 'edited by hand\n');
    const unhealthy = await cli(root, ['doctor']);
    expect(unhealthy.code).toBe(1);
    expect(unhealthy.out).toContain('.claude/CLAUDE.md');

    const rolledBack = await cli(root, ['rollback', '--force']);
    expect(rolledBack.code).toBe(0);
    expect(rolledBack.out).toMatch(/Rolled back \S+: restored \d+ file\(s\), removed \d+ file\(s\)/);
  });

  it('should keep a user file and write the generated one next to it', async () => {
    const root = backend();
    writeFileSync(join(root, 'AGENTS.md'), '# Mine\n');

    const result = await cli(root, ['setup', '--yes', '--adapter', 'codex', '--strategy', 'write-new']);
    expect(result.code).toBe(0);
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toContain('# Mine');
  });

  it('should reject an unknown strategy and adapter', async () => {
    expect((await cli(backend(), ['setup', '--strategy', 'force'])).err).toContain('Invalid --strategy');
    expect((await cli(backend(), ['setup', '--adapter', 'cursor'])).err).toContain('Invalid --adapter');
  });
});

describe('main — plan, explain, impact', () => {
  it('should print a plan in text and JSON and explain a saved plan', async () => {
    const root = backend();
    const unsaved = await cli(root, ['plan', 'Add a paginated GET /orders endpoint']);
    expect(unsaved.out).toContain('Not saved: the project has no ai-agent-setup install');

    await cli(root, ['setup', '--yes']);
    const saved = await cli(root, ['plan', 'Add a paginated GET /orders endpoint', '--mode', 'manual', '--approve-at', 'plan,gates', '--budget', '999999']);
    expect(saved.code).toBe(0);
    const id = /explain (plan-\S+)/.exec(saved.out)![1]!;

    expect((await cli(root, ['explain', id])).out).toContain('backend.api-design');
    expect(JSON.parse((await cli(root, ['explain', id, '--json'])).out)).toHaveProperty('cost');
    expect(JSON.parse((await cli(root, ['plan', 'Write the README', '--json'])).out)).toHaveProperty('steps');
  });

  it('should apply overrides and exit 1 on an invalid plan', async () => {
    const root = backend();
    const result = await cli(root, ['plan', 'Add a modal component', '--domain', 'frontend', '--agent', 'agent.implementer', '--skill', 'skill.react-frontend', '--workflow', 'wf.build', '--allow-tools', 'fs.read']);
    expect(result.out).toContain('Overrides');

    const invalid = await cli(root, ['plan', 'Add a modal component', '--exclude-agent', 'agent.implementer']);
    expect(invalid.code).toBe(1);
  });

  it('should analyse given files, uncommitted changes and changes since a ref', async () => {
    const root = gitRepo(backend());
    const given = await cli(root, ['impact', 'src/index.ts', 'docs/notes.md']);
    expect(given.out).toContain('Impact of 2 file(s) (given files)');

    writeFileSync(join(root, 'src', 'new-file.ts'), 'export const a = 1;\n');
    expect((await cli(root, ['impact'])).out).toContain('uncommitted changes');
    expect((await cli(root, ['impact', '--since', 'HEAD'])).out).toContain('changes since the given ref');
    expect(JSON.parse((await cli(root, ['impact', 'src/index.ts', '--json'])).out)).toHaveProperty('risk');
    expect((await cli(root, ['plan', 'Fix the orders bug', '--files', 'src/index.ts'])).out).toContain('applies to src/index.ts (path-scoped)');
    expect((await cli(root, ['plan', 'Fix the orders bug', '--changed'])).out).toContain('src/new-file.ts');
    expect((await cli(root, ['plan', 'Fix the orders bug', '--since', 'HEAD'])).out).toContain('Task: Fix the orders bug');
  });
});

describe('main — gates and runs', () => {
  function configure(root: string, gates: Record<string, string>): void {
    writeFileSync(join(root, '.ai-agent-setup', 'gates.json'), JSON.stringify({ gates: Object.fromEntries(Object.entries(gates).map(([id, command]) => [id, { command }])) }));
  }

  it('should list, run and show the history of gates', async () => {
    const root = backend();
    await cli(root, ['setup', '--yes', '--profile', 'profile.starter']);
    configure(root, { 'gate.build': 'node ok.js', 'gate.unit-tests': 'node ok.js' });

    const listing = await cli(root, ['gates', 'list']);
    expect(listing.out).toContain('Profile profile.starter');
    expect(listing.out).toMatch(/\* gate\.build\s+build\s+project-command\s+node ok\.js/);
    expect(JSON.parse((await cli(root, ['gates', 'list', '--json'])).out)).toHaveProperty('gates');

    const run = await cli(root, ['gates', 'run']);
    expect(run.code).toBe(0);
    expect(run.out).toContain(': PASS');
    expect(JSON.parse((await cli(root, ['gates', 'run', '--json', '--skip', 'gate.build'])).out)).toMatchObject({ status: 'NOT_VERIFIED' });
    expect((await cli(root, ['gates', 'history'])).out).toContain('gate.build PASS');
    expect(JSON.parse((await cli(root, ['gates', 'history', '--gate', 'gate.build', '--json'])).out)).toHaveLength(2);
    expect((await cli(root, ['gates', 'list', '--profile', 'profile.standard'])).out).toMatch(/\* gate\.lint/);
  });

  it('should drive a run from creation to reconciliation', async () => {
    const root = backend();
    await cli(root, ['setup', '--yes']);
    // Plans use the standard profile; every one of its gates gets a passing command here.
    configure(root, { 'gate.build': 'node ok.js', 'gate.unit-tests': 'node ok.js', 'gate.lint': 'node ok.js', 'gate.security-scan': 'node ok.js', 'gate.coverage-80': 'node cov.cjs' });
    const plan = JSON.parse((await cli(root, ['plan', 'Implement the orders API endpoint', '--json'])).out) as { id: string; steps: Array<{ id: string }> };
    const runId = /Created (run-\S+)/.exec((await cli(root, ['run', 'create', plan.id])).out)![1]!;
    const unattended = await cli(root, ['run', 'approve', runId]);
    expect(unattended).toMatchObject({ code: 1, err: expect.stringContaining('needs an interactive terminal') as unknown });
    expect((await cli(root, ['run', 'approve', runId], ['wrong'])).err).toContain(`not confirmed (expected ${runId})`);
    expect((await cli(root, ['run', 'approve', runId, '--by', 'tester'], [runId])).out).toContain('immutable');

    const step = plan.steps[0]!.id;
    expect((await cli(root, ['run', 'event', runId, '--type', 'STEP_STARTED', '--step', step])).out).toBe('Recorded.\n');
    expect((await cli(root, ['run', 'event', runId, '--type', 'STEP_PROGRESS', '--step', step, '--message', 'half way, almost'])).out).toBe('Recorded.\n');
    expect((await cli(root, ['run', 'event', runId, '--type', 'STEP_STARTED', '--step', 'nope'])).out).toContain('Recorded but not applied: unknown step nope');
    expect((await cli(root, ['run', 'event', runId, '--type', 'RUN_STARTED', '--step', step])).err).toContain('run event needs --type');
    expect((await cli(root, ['run', 'event', runId, '--type', 'STEP_STARTED'])).err).toContain('needs --step');
    for (const type of ['STEP_FAILED', 'STEP_BLOCKED', 'APPROVAL_REQUIRED']) {
      expect((await cli(root, ['run', 'event', runId, '--type', type, '--step', step])).err).toContain(`--type ${type} needs --reason`);
      expect((await cli(root, ['run', 'event', runId, '--type', type, '--step', step, '--reason', ','])).err).toContain('needs --reason');
    }

    const verify = await cli(root, ['run', 'verify', runId, step]);
    expect(verify.out).toContain('gate.build: PASS');
    expect(verify.out).toContain(`${step}: SUCCEEDED`);
    expect((await cli(root, ['run', 'verify', runId])).err).toContain('Usage: run verify');

    const status = await cli(root, ['run', 'status', runId]);
    expect(status.out).toContain(`${runId}: `);
    expect(status.out).toContain('ignored STEP_STARTED');
    expect(JSON.parse((await cli(root, ['run', 'status', runId, '--json'])).out)).toHaveProperty('steps');

    const dry = await cli(root, ['run', 'deliver', runId, '--host', 'codex', '--dry-run']);
    expect(dry.out).toContain('DRY_RUN');
    expect(JSON.parse((await cli(root, ['run', 'deliver', runId, '--host', 'claude-code', '--dry-run', '--json'])).out)).toMatchObject({ status: 'DRY_RUN' });
    expect((await cli(root, ['run', 'deliver', runId])).err).toContain('needs --host');

    expect((await cli(root, ['run', 'cancel', runId])).out).toContain('Cancelled');
    expect((await cli(root, ['run', 'status', runId])).code).toBe(2);
  });

  it('should record step approvals and declines from the user', async () => {
    const root = backend();
    await cli(root, ['setup', '--yes', '--profile', 'profile.starter']);
    const plan = JSON.parse((await cli(root, ['plan', 'Implement the orders API endpoint', '--approve-at', 'each-step', '--json'])).out) as { id: string; steps: Array<{ id: string }> };
    const runId = /Created (run-\S+)/.exec((await cli(root, ['run', 'create', plan.id])).out)![1]!;
    await cli(root, ['run', 'approve', runId], [runId]);
    const step = plan.steps[0]!.id;

    await cli(root, ['run', 'event', runId, '--type', 'STEP_STARTED', '--step', step]);
    expect((await cli(root, ['run', 'approve-step', runId, step])).err).toContain('needs an interactive terminal');
    expect((await cli(root, ['run', 'approve-step', runId, step], [step])).out).toBe(`Approved ${step}.\n`);
    await cli(root, ['run', 'event', runId, '--type', 'APPROVAL_REQUIRED', '--step', step, '--reason', 'runs a migration']);
    expect((await cli(root, ['run', 'approve-step', runId, step, '--decline'], [step])).out).toBe(`Declined ${step}.\n`);
    expect((await cli(root, ['run', 'approve-step', runId])).err).toContain('Usage: run approve-step');
    expect((await cli(root, ['run', 'event', runId, '--type', 'STEP_FAILED', '--step', step, '--reason', 'boom', '--evidence', 'a.log'])).out).toContain('not applied');
    expect((await cli(root, ['run', 'event', runId, '--type', 'STEP_BLOCKED', '--step', step, '--reason', 'no access'])).out).toContain('not applied');

    expect((await cli(root, ['run', 'status', runId])).out).toContain('SKIPPED');
  });

  it('should show order violations, waiting events and pending approvals in run status (ADR-015)', async () => {
    const root = backend();
    await cli(root, ['setup', '--yes']);
    const plan = JSON.parse((await cli(root, ['plan', 'Implement the orders API endpoint and build the orders page in the React app', '--domain', 'backend,frontend', '--json'])).out) as { id: string; steps: Array<{ id: string }> };
    const runId = /Created (run-\S+)/.exec((await cli(root, ['run', 'create', plan.id])).out)![1]!;
    await cli(root, ['run', 'approve', runId], [runId]);
    const [first, second] = plan.steps.map((item) => item.id) as [string, string];

    await cli(root, ['run', 'event', runId, '--type', 'STEP_STARTED', '--step', second]);
    await cli(root, ['run', 'event', runId, '--type', 'APPROVAL_REQUIRED', '--step', second, '--reason', 'needs a schema change']);
    const status = await cli(root, ['run', 'status', runId]);

    expect(status.code).toBe(2);
    expect(status.out).toContain('approval pending: ');
    expect(status.out).toContain(`${second}: NOT_VERIFIED (approval pending)`);
    expect(status.out).toContain('DEPENDENCY_ORDER_VIOLATION STEP_STARTED');
    expect(status.out).toContain(`waiting STEP_STARTED for ${second}`);
    expect((await cli(root, ['run', 'verify', runId, second])).err).toContain(`depends on ${first}`);
  });
});

describe('isolation check and deliver options (W2.2-09)', () => {
  it('should show the platform matrix and refuse isolated with exit 2', async () => {
    const root = mkdtempSync(join(tmpdir(), 'iso-cli-'));
    const isolated = await cli(root, ['isolation', 'check', '--isolation', 'isolated']);
    expect(isolated.code).toBe(2);
    expect(isolated.out).toContain('Platforms:');
    expect(isolated.out).toMatch(/Linux\s+UNSUPPORTED/);
    expect(isolated.out).toContain('Cannot start with this profile (nothing would run)');
    expect(isolated.out).not.toMatch(/\bSecure\b/);

    const json = await cli(root, ['isolation', 'check', '--isolation', 'restricted', '--network', 'deny', '--host', 'codex', '--json']);
    const report = JSON.parse(json.out) as { profile: string; network: { mode: string }; problems: string[] };
    expect(report).toMatchObject({ profile: 'restricted', network: { mode: 'deny-all' } });
    expect(json.code).toBe(process.platform === 'darwin' ? 0 : 2);

    const allowlist = await cli(root, ['isolation', 'check', '--network', 'allow:api.example.com']);
    expect(allowlist.code).toBe(2);
    expect(allowlist.out).toContain('network allowlist cannot be enforced');
  });

  it('should reject invalid isolation options before anything runs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'iso-cli-'));
    expect((await cli(root, ['isolation', 'list'])).code).toBe(1);
    expect((await cli(root, ['isolation', 'check', '--isolation', 'sandboxed'])).err).toContain('--isolation must be one of');
    expect((await cli(root, ['isolation', 'check', '--network', 'sometimes'])).code).toBe(1);
    expect((await cli(root, ['run', 'deliver', 'run-20261124T100000Z-abcdef', '--host', 'codex', '--network', 'deny'])).err).toContain('--network and --pass-env need --isolation');
    expect((await cli(root, ['run', 'deliver', 'run-20261124T100000Z-abcdef', '--host', 'codex', '--isolation', 'airgap'])).err).toContain('--isolation must be one of');
  });
});

describe('report (W2.2-05)', () => {
  it('should print the execution report as Markdown or JSON, read-only', async () => {
    const root = mkdtempSync(join(tmpdir(), 'report-cli-'));
    const markdown = await cli(root, ['report']);
    expect(markdown.code).toBe(0);
    expect(markdown.out).toContain('## Execution runs (0)');
    const json = await cli(root, ['report', '--json', '--since', '2026-11-01']);
    expect(JSON.parse(json.out)).toMatchObject({ schemaVersion: 'execution-report/v1', since: '2026-11-01T00:00:00.000Z' });
    expect(existsSync(join(root, '.ai-agent-setup'))).toBe(false);
    expect((await cli(root, ['report', '--since', 'soon'])).code).toBe(1);
  });
});

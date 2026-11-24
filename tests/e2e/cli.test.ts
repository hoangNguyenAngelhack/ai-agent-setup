import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashTree } from '../helpers/fs-tree';
import { REPO_ROOT } from '../helpers/v1-cli';

/** The V2 CLI through bin/cli.js, as a user runs it (W2.0-13; V1 compatibility per docs/v2/07 §3). */
const CLI = join(REPO_ROOT, 'bin', 'cli.js');

function workdir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cli-'));
  writeFileSync(join(dir, '.gitconfig'), '');
  return dir;
}

function cli(cwd: string, args: string[], input = '') {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: join(cwd, '.gitconfig'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

const read = (path: string) => readFileSync(path, 'utf8');
const manifestOf = (project: string) => JSON.parse(read(join(project, '.ai-agent-setup', 'manifest.json')));
const lastCommit = (project: string) => spawnSync('git', ['-C', project, 'log', '-1', '--format=%s'], { encoding: 'utf8' }).stdout.trim();

describe('V2 CLI — basics', () => {
  it('should report the package version (fixes F-02) under the published name (fixes F-03)', () => {
    const { version } = JSON.parse(read(join(REPO_ROOT, 'package.json')));

    expect(cli(workdir(), ['--version']).stdout.trim()).toBe(`create-ai-agent-setup ${version}`);
  });

  it('should reject invalid option values with a clear message', () => {
    const result = cli(workdir(), ['app', '-t', 'backend', '-f', 'vite', '-y']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid --framework "vite". Valid: express, nestjs');
  });
});

describe('V2 CLI — create (V1 flags)', () => {
  it('should honour -f nestjs (fixes F-04) and install a managed, path-free configuration', () => {
    const cwd = workdir();

    const result = cli(cwd, ['api', '-t', 'backend', '-f', 'nestjs', '-y']);

    expect(result.status, result.stderr).toBe(0);
    const project = join(cwd, 'api');
    expect(existsSync(join(project, 'nest-cli.json'))).toBe(true);
    expect(existsSync(join(project, '.claude', 'agents', 'backend.md'))).toBe(true);
    expect(read(join(project, '.claude', 'settings.json'))).not.toMatch(/\/Users\//);
    expect(manifestOf(project).profile).toBe('profile.standard');
    expect(lastCommit(project)).toBe('feat: initial project setup (backend/nestjs, standard)');
    expect(cli(project, ['doctor']).status).toBe(0);
  });

  it('should honour --db sqlite (fixes F-06)', () => {
    const cwd = workdir();

    cli(cwd, ['lite', '-t', 'backend', '--db', 'sqlite', '-y']);

    expect(read(join(cwd, 'lite', 'prisma', 'schema.prisma'))).toContain('provider = "sqlite"');
    expect(read(join(cwd, 'lite', '.env.example'))).toContain('DATABASE_URL="file:./dev.db"');
  });

  it('should apply -T strict as the profile (fixes F-05)', () => {
    const cwd = workdir();

    cli(cwd, ['strict-app', '-t', 'backend', '-T', 'strict', '-y']);

    expect(manifestOf(join(cwd, 'strict-app')).profile).toBe('profile.strict');
    expect(read(join(cwd, 'strict-app', '.claude', 'CLAUDE.md'))).toContain('`profile.strict`');
  });

  it('should include the honesty rule only with -H', () => {
    const cwd = workdir();

    cli(cwd, ['with', '-t', 'backend', '-H', '-y']);
    cli(cwd, ['without', '-t', 'backend', '-y']);

    expect(existsSync(join(cwd, 'with', '.claude', 'rules', 'honesty.md'))).toBe(true);
    expect(existsSync(join(cwd, 'without', '.claude', 'rules', 'honesty.md'))).toBe(false);
  });

  it('should generate for Codex with --adapter codex', () => {
    const cwd = workdir();

    cli(cwd, ['cx', '-t', 'frontend', '-f', 'vite', '-u', 'antd', '-y', '--adapter', 'codex']);

    expect(existsSync(join(cwd, 'cx', 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(cwd, 'cx', '.codex', 'config.toml'))).toBe(true);
    expect(existsSync(join(cwd, 'cx', '.claude'))).toBe(false);
    expect(read(join(cwd, 'cx', 'package.json'))).toContain('"antd"');
  });

  it('should point to setup when the directory already exists', () => {
    const cwd = workdir();
    cli(cwd, ['dup', '-t', 'backend', '-y']);

    const second = cli(cwd, ['dup', '-t', 'backend', '-y']);

    expect(second.status).toBe(1);
    expect(second.stderr).toContain('create-ai-agent-setup setup dup');
  });

  it('should run the interactive prompts in V1 order from piped answers', () => {
    const cwd = workdir();
    // name, type=frontend, framework=vite, ui=chakra, tier=starter, author, email, host=both, codegraph=n, honesty=y
    const answers = ['piped', '2', '2', '3', '1', 'Ann', 'ann@example.com', '3', 'n', 'y'].join('\n');

    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(join(REPO_ROOT, 'dist', 'cli', 'main.js'))}).main([], { cwd: ${JSON.stringify(cwd)}, write: (t) => process.stdout.write(t), error: (t) => process.stderr.write(t), ask: (() => { const lines = ${JSON.stringify(answers)}.split('\\n'); return async () => lines.shift() ?? ''; })() }).then((code) => { process.exitCode = code; })`], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: join(cwd, '.gitconfig'), GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e.com' },
    });

    expect(result.status, result.stderr).toBe(0);
    const project = join(cwd, 'piped');
    expect(read(join(project, 'package.json'))).toContain('@chakra-ui/react');
    expect(manifestOf(project)).toMatchObject({ profile: 'profile.starter', adapters: { 'claude-code': {}, codex: {} } });
    expect(existsSync(join(project, '.claude', 'rules', 'honesty.md'))).toBe(true);
    expect(read(join(project, 'package.json'))).toContain('Ann');
  });
});

describe('V2 CLI — setup, diff, doctor, rollback on an existing project', () => {
  function existingProject(): string {
    const root = mkdtempSync(join(tmpdir(), 'cli-existing-'));
    cpSync(join(REPO_ROOT, 'templates', 'backend'), root, { recursive: true });
    writeFileSync(join(root, '.gitconfig'), '');
    return root;
  }

  it('should show a plan without writing on diff and --dry-run', () => {
    const root = existingProject();
    const before = hashTree(root);

    const diff = cli(root, ['diff']);
    const dryRun = cli(root, ['setup', '--dry-run']);

    expect(diff.status).toBe(0);
    expect(diff.stdout).toContain('create    .claude/settings.json');
    expect(diff.stdout).toContain('+++ b/.claude/settings.json');
    expect(dryRun.status).toBe(0);
    expect(hashTree(root)).toEqual(before);
  });

  it('should refuse to apply without --yes when not interactive', () => {
    const root = existingProject();
    const before = hashTree(root);

    const result = cli(root, ['setup']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('re-run with --yes');
    expect(hashTree(root)).toEqual(before);
  });

  it('should apply with --yes, pass doctor, then roll back to the original bytes', () => {
    const root = existingProject();
    const before = hashTree(root);

    expect(cli(root, ['setup', '--yes', '--adapter', 'claude-code,codex']).status).toBe(0);
    expect(cli(root, ['doctor']).stdout).toContain('Healthy');
    expect(cli(root, ['setup', '--yes', '--adapter', 'claude-code,codex']).stdout).toContain('Already up to date');

    const rolledBack = cli(root, ['rollback']);
    expect(rolledBack.status).toBe(0);
    expect(hashTree(root)).toEqual(before);
  });

  it('should report doctor problems with a non-zero exit code', () => {
    const root = existingProject();
    cli(root, ['setup', '--yes']);
    writeFileSync(join(root, '.claude', 'rules', 'security.md'), 'tampered');

    const result = cli(root, ['doctor']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('MODIFIED .claude/rules/security.md');
  });
});

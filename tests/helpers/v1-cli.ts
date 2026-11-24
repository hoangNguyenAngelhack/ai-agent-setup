import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

export const REPO_ROOT = join(__dirname, '..', '..');

// Characterization runs the V1 CLI exactly as released at the audited baseline commit (bin/,
// templates/ and the .claude/ it downloads from GitHub HEAD, F-07), extracted with git archive.
// This keeps V1 behaviour frozen after bin/cli.js becomes the V2 launcher, offline and reproducible.
export const V1_BASELINE_COMMIT = '51bfc3a';

export interface V1Sandbox {
  root: string;
  env: NodeJS.ProcessEnv;
  /** bin/cli.js of the baseline commit. */
  cli: string;
}

export interface V1RunResult {
  status: number | null;
  stdout: string;
  projectDir: string;
}

export interface ProjectFingerprint {
  commitMessage: string | null;
  files: Array<{ path: string; sha256: string }>;
}

export function createV1Sandbox(): V1Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'v1-char-'));
  const baselineDir = join(root, 'baseline');
  const shimDir = join(root, 'shim');
  mkdirSync(baselineDir);
  mkdirSync(shimDir);

  const archive = join(root, 'v1-baseline.tar');
  execFileSync('git', ['-C', REPO_ROOT, 'archive', `--output=${archive}`, V1_BASELINE_COMMIT, '.claude', 'bin', 'templates']);
  execFileSync('tar', ['-x', '-f', archive, '-C', baselineDir]);

  // `npx degit <repo>/.claude <dest> --force` → copy the pinned baseline instead.
  const shim = [
    '#!/bin/sh',
    'if [ "$1" = "degit" ]; then',
    `  rm -rf "$3" && cp -R "${join(baselineDir, '.claude')}" "$3"`,
    '  exit 0',
    'fi',
    'echo "npx shim: unsupported command $*" >&2',
    'exit 1',
    '',
  ].join('\n');
  const shimPath = join(shimDir, 'npx');
  writeFileSync(shimPath, shim);
  chmodSync(shimPath, 0o755);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${shimDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
    GIT_CONFIG_GLOBAL: join(root, 'gitconfig-empty'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Characterization',
    GIT_AUTHOR_EMAIL: 'characterization@example.com',
    GIT_COMMITTER_NAME: 'Characterization',
    GIT_COMMITTER_EMAIL: 'characterization@example.com',
  };
  writeFileSync(join(root, 'gitconfig-empty'), '');
  mkdirSync(join(root, 'work'));
  return { root, env, cli: join(baselineDir, 'bin', 'cli.js') };
}

export function runV1Cli(sandbox: V1Sandbox, args: string[]): V1RunResult {
  const cwd = join(sandbox.root, 'work');
  const result = spawnSync(process.execPath, [sandbox.cli, ...args], {
    cwd,
    env: sandbox.env,
    encoding: 'utf8',
    input: '',
  });
  const projectName = args.find((arg) => !arg.startsWith('-')) ?? '';
  return { status: result.status, stdout: result.stdout, projectDir: join(cwd, projectName) };
}

export function fingerprintProject(projectDir: string, env: NodeJS.ProcessEnv): ProjectFingerprint {
  const files = listFiles(projectDir)
    .map((file) => ({
      path: relative(projectDir, file).split(sep).join('/'),
      sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const log = spawnSync('git', ['-C', projectDir, 'log', '-1', '--format=%s'], { env, encoding: 'utf8' });
  return { commitMessage: log.status === 0 ? log.stdout.trim() : null, files };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git') return [];
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

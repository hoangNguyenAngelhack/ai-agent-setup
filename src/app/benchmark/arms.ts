import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AdapterId } from '../../registry';
import { matchesAnyGlob } from '../../shared/glob';
import { runSetup } from '../setup';

/**
 * The three arms of docs/v2/09 §5.1, prepared once per benchmark run and copied onto each trial's
 * fixture. Arm A gets the V2 permissions and policy hook only, so that permission differences do not
 * confound the comparison (09 §5.2); B is the pinned V1 configuration; C is the V2 default profile.
 */
export type Arm = 'A' | 'B' | 'C';
export const ARMS: readonly Arm[] = ['A', 'B', 'C'];
export type BenchmarkHost = Extract<AdapterId, 'claude-code' | 'codex'>;

/** The audited V1 1.6.1 baseline (F-07): its configuration is read from git history, never downloaded. */
export const V1_BASELINE_COMMIT = '51bfc3a';

export const ARM_DESCRIPTION: Record<Arm, string> = {
  A: 'baseline: V2 permissions and policy hook only, no instructions, skills or agents',
  B: `V1 1.6.1 configuration pinned at ${V1_BASELINE_COMMIT}`,
  C: 'V2 default profile (profile.standard), as `setup` writes it',
};

const PERMISSION_FILES: Record<BenchmarkHost, string[]> = {
  'claude-code': ['.claude/settings.json', '.claude/hooks/ai-agent-setup/**'],
  codex: ['.codex/config.toml', '.codex/hooks.json', '.codex/hooks/**'],
};

/** V1 had no Codex adapter: for Codex, arm B is the agent skills V1 shipped. */
const V1_PATHS: Record<BenchmarkHost, string[]> = { 'claude-code': ['.claude'], codex: ['.agents'] };

export function listFiles(root: string, dir = ''): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(root, path) : [path];
  });
}

function v1Configuration(packageRoot: string, host: BenchmarkHost, target: string): void {
  const archive = join(target, '..', `v1-${host}.tar`);
  try {
    execFileSync('git', ['-C', packageRoot, 'archive', `--output=${archive}`, V1_BASELINE_COMMIT, ...V1_PATHS[host]], { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`V1 baseline ${V1_BASELINE_COMMIT} is not available (arm B needs the git history): ${(error as Error).message.split('\n')[0]}`);
  }
  execFileSync('tar', ['-x', '-f', archive, '-C', target], { stdio: 'pipe' });
}

/** Directories holding each arm's configuration for `host`. */
export function prepareArms(packageRoot: string, host: BenchmarkHost): Record<Arm, string> {
  const base = mkdtempSync(join(tmpdir(), 'bench-arms-'));
  const dirs = Object.fromEntries(ARMS.map((arm) => [arm, join(base, arm)])) as Record<Arm, string>;
  for (const dir of Object.values(dirs)) mkdirSync(dir);
  runSetup({ root: dirs.C, adapters: [host] });
  for (const file of listFiles(dirs.C).filter((path) => matchesAnyGlob(path, PERMISSION_FILES[host]))) {
    mkdirSync(dirname(join(dirs.A, file)), { recursive: true });
    copyFileSync(join(dirs.C, file), join(dirs.A, file));
  }
  v1Configuration(packageRoot, host, dirs.B);
  return dirs;
}

/** A trial workspace: the task fixture with the arm configuration on top. */
export function prepareWorkspace(fixtureDir: string, armDir: string): string {
  const workspace = mkdtempSync(join(tmpdir(), 'bench-trial-'));
  cpSync(fixtureDir, workspace, { recursive: true });
  cpSync(armDir, workspace, { recursive: true });
  // Codex runs only in a Git repository or trusted directory (verified on 0.172.0); a committed tree
  // also gives every host the same starting point.
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=benchmark', '-c', 'user.email=benchmark@localhost', '-c', 'commit.gpgsign=false', ...args], { cwd: workspace, stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'fixture');
  return workspace;
}

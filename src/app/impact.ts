import { spawnSync } from 'node:child_process';
import type { ImpactReport, ProjectModel } from '../core/contracts';
import { detectProject } from '../core/project-detection';
import { analyzeImpact, buildProjectModel } from '../core/project-intelligence';

export interface ImpactOptions {
  root: string;
  /** Explicit changed files (relative to root). */
  files?: string[];
  /** Git ref to diff the working tree against; untracked files are included. */
  since?: string;
}

export interface ImpactOutcome {
  source: 'files' | 'since' | 'working-tree';
  model: ProjectModel;
  impact: ImpactReport;
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot read changes with git (${(result.stderr || result.error?.message || '').trim() || 'not a git repository'}); pass the changed files instead`);
  }
  return result.stdout;
}

/** Parses `git status --porcelain=v1 -z`; renames contribute their new path. */
function statusPaths(output: string): string[] {
  const records = output.split('\0').filter(Boolean);
  const paths: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    paths.push(record.slice(3));
    if (record[0] === 'R' || record[0] === 'C') index += 1;
  }
  return paths;
}

export function changedFiles(root: string, since?: string): string[] {
  const untrackedAndChanged = statusPaths(git(root, ['status', '--porcelain=v1', '-uall', '-z']));
  if (!since) return untrackedAndChanged;
  const diffed = git(root, ['diff', '--name-only', '-z', since]).split('\0').filter(Boolean);
  return [...new Set([...diffed, ...untrackedAndChanged])];
}

function sourceOf(options: ImpactOptions): ImpactOutcome['source'] {
  if (options.files && options.files.length > 0) return 'files';
  return options.since ? 'since' : 'working-tree';
}

/** Impact use case (W2.1-02): explicit files, changes since a ref, or uncommitted changes. */
export function runImpact(options: ImpactOptions): ImpactOutcome {
  const source = sourceOf(options);
  const files = source === 'files' ? options.files! : changedFiles(options.root, options.since);
  const model = buildProjectModel(options.root, detectProject(options.root));
  return { source, model, impact: analyzeImpact(model, files) };
}

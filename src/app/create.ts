import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AdapterId } from '../registry';
import { runSetup, type SetupOutcome } from './setup';
import {
  applyDatabase,
  copyTemplate,
  mergeUiLibrary,
  templateName,
  type Database,
  type Framework,
  type ProjectType,
  type Tier,
  type UiLibrary,
} from './templates';

const PACKAGE_ROOT = join(__dirname, '..', '..');
const PROJECT_NAME = /^[a-z0-9-_]+$/i;
const CODEGRAPH_INSTALL = ['@colbymchenry/codegraph', 'init', '-i'];

export interface CreateOptions {
  cwd: string;
  projectName: string;
  type: ProjectType;
  framework: Framework | null;
  ui: UiLibrary | null;
  tier: Tier;
  db: Database;
  author: string;
  email: string;
  adapters: AdapterId[];
  honesty: boolean;
  codegraph: boolean;
  templatesDir?: string;
  distDir?: string;
  now?: () => Date;
}

export interface CreateOutcome {
  projectDir: string;
  template: string;
  setup: SetupOutcome;
  committed: boolean;
  warnings: string[];
}

export function validateProjectName(cwd: string, name: string): string | null {
  if (!name) return 'Project name is required';
  if (!PROJECT_NAME.test(name)) return 'Project name can only contain letters, numbers, hyphens, and underscores';
  if (existsSync(resolve(cwd, name))) return `Directory "${name}" already exists. To add AI configuration to an existing project, run: create-ai-agent-setup setup ${name}`;
  return null;
}

function commitLabel(options: CreateOptions): string {
  if (options.type === 'frontend') return [options.type, options.framework, options.ui].filter(Boolean).join('/');
  return options.type === 'fullstack' ? options.type : `${options.type}/${options.framework}`;
}

function git(projectDir: string, args: string[]): boolean {
  return spawnSync('git', args, { cwd: projectDir, stdio: 'pipe' }).status === 0;
}

/**
 * `create` use case (W2.0-13, docs/v2/07 §3): V1 project creation with the V1 defects fixed and the
 * AI configuration generated from the bundled catalog through the safe installer (no download).
 */
export function createProject(options: CreateOptions): CreateOutcome {
  const nameError = validateProjectName(options.cwd, options.projectName);
  if (nameError) throw new Error(nameError);

  const projectDir = resolve(options.cwd, options.projectName);
  const templatesDir = options.templatesDir ?? join(PACKAGE_ROOT, 'templates');
  const template = templateName(options.type, options.framework);
  const values = { projectName: options.projectName, author: options.author, email: options.email, tier: options.tier, db: options.db };
  const warnings: string[] = [];

  mkdirSync(projectDir, { recursive: true });
  copyTemplate(templatesDir, template, projectDir, values);
  if (options.type === 'frontend' && options.ui) mergeUiLibrary(templatesDir, options.ui, projectDir, values);
  warnings.push(...applyDatabase(projectDir, options.db, options.projectName));

  const setup = runSetup({
    root: projectDir,
    adapters: options.adapters,
    profileId: `profile.${options.tier}`,
    includeIds: options.honesty ? ['rule.honesty'] : [],
    ...(options.distDir ? { distDir: options.distDir } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  // V1 aborted with a partly created project when git failed (F-11); now it only warns.
  const committed =
    git(projectDir, ['init', '-q']) &&
    git(projectDir, ['add', '-A']) &&
    git(projectDir, ['commit', '-q', '-m', `feat: initial project setup (${commitLabel(options)}, ${options.tier})`]);
  if (!committed) warnings.push('Could not create the initial git commit (is git installed and user.name/user.email set?). The project files are complete.');

  if (options.codegraph) {
    const result = spawnSync('npx', CODEGRAPH_INSTALL, { cwd: projectDir, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) warnings.push(`CodeGraph setup failed; run it later with: npx ${CODEGRAPH_INSTALL.join(' ')}`);
  }

  return { projectDir, template, setup, committed, warnings };
}

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measureContext, selectProfileEntries } from '../core/context';
import type { ImpactReport, Plan, PlanMode, PlanOverrides, ProjectProfile } from '../core/contracts';
import { TaskClassifier } from '../core/planning';
import { runImpact } from './impact';
import { ensureIgnoredDir, RUNS_DIR } from './run-files';
import { detectProject } from '../core/project-detection';
import { routeTask } from '../core/routing';
import { MANIFEST_PATH } from '../installer';
import { KnowledgeIndex, Registry, validateCatalog } from '../registry';

const PACKAGE_ROOT = join(__dirname, '..', '..');

export interface PlanOptions {
  root: string;
  task: string;
  mode?: PlanMode;
  overrides?: PlanOverrides;
  profileId?: string;
  /** Changed files to analyse (W2.1-02); `changed` uses uncommitted changes, `since` a git ref. */
  files?: string[];
  since?: string;
  changed?: boolean;
  catalogDir?: string;
  now?: () => Date;
}

export interface PlanOutcome {
  plan: Plan;
  /** Relative path of the saved plan, or null when the project has no ai-agent-setup install. */
  savedTo: string | null;
}

function planId(task: string, date: Date): string {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `plan-${stamp}-${createHash('sha256').update(task).digest('hex').slice(0, 6)}`;
}

/** Impact of the changed files when the caller gave files, a ref or asked for uncommitted changes. */
function impactFor(options: PlanOptions): ImpactReport | null {
  const wanted = (options.files && options.files.length > 0) || options.since || options.changed;
  if (!wanted) return null;
  return runImpact({ root: options.root, ...(options.files ? { files: options.files } : {}), ...(options.since ? { since: options.since } : {}) }).impact;
}

function detectedProject(root: string): ProjectProfile | null {
  const profile = detectProject(root);
  return profile.languages.length === 0 && profile.frameworks.length === 0 ? null : profile;
}

/** Plan use case (W2.1-05/07): classify, route, explain; save under .ai-agent-setup/runs when installed. */
export function runPlan(options: PlanOptions): PlanOutcome {
  const report = validateCatalog(options.catalogDir ?? join(PACKAGE_ROOT, 'catalog'));
  if (!report.ok) throw new Error('Bundled catalog is invalid; run catalog validate');
  const registry = new Registry(report.entries);
  const knowledge = new KnowledgeIndex(report.loaded);
  const profileId = options.profileId ?? 'profile.standard';
  const profile = registry.get(profileId);
  if (profile?.kind !== 'Profile') throw new Error(`Unknown profile "${profileId}"`);

  const plan = routeTask({
    id: planId(options.task, (options.now ?? (() => new Date()))()),
    task: options.task,
    mode: options.mode ?? 'hybrid',
    classification: new TaskClassifier(registry).classify(options.task),
    registry,
    knowledge,
    profile,
    policies: report.policies,
    project: detectedProject(options.root),
    overrides: options.overrides ?? {},
    contextT0Bytes: measureContext(selectProfileEntries(registry, profile), knowledge).tiers.T0.bytes,
    impact: impactFor(options),
  });

  if (!existsSync(join(options.root, MANIFEST_PATH))) return { plan, savedTo: null };
  const savedTo = `${RUNS_DIR}/${plan.id}/plan.json`;
  mkdirSync(join(ensureIgnoredDir(options.root, RUNS_DIR), plan.id), { recursive: true });
  writeFileSync(join(options.root, savedTo), `${JSON.stringify(plan, null, 2)}\n`);
  return { plan, savedTo };
}

export function readPlan(root: string, id: string): Plan {
  const file = join(root, RUNS_DIR, id, 'plan.json');
  if (!/^plan-[0-9TZ]+-[0-9a-f]{6}$/.test(id) || !existsSync(file)) throw new Error(`No saved plan "${id}" in ${RUNS_DIR}`);
  return JSON.parse(readFileSync(file, 'utf8')) as Plan;
}

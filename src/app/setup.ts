import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, GenerationResult } from '../adapters/adapter';
import { claudeCodeAdapter } from '../adapters/claude-code';
import { codexAdapter } from '../adapters/codex';
import type { HostConfigDetection, ProjectProfile } from '../core/contracts';
import { detectProject } from '../core/project-detection';
import {
  applyPlan,
  planInstall,
  readManifest,
  resolveConflicts,
  type ApplyResult,
  type ConflictStrategy,
  type InstallPlan,
  type ManifestMeta,
} from '../installer';
import {
  catalogDigest,
  KnowledgeIndex,
  Registry,
  validateCatalog,
  type AdapterId,
  type Diagnostic,
  type ProfileEntry,
} from '../registry';
import { loadPolicyHookAssets } from './policy-hook-assets';

const ADAPTERS: Record<AdapterId, Adapter> = { 'claude-code': claudeCodeAdapter, codex: codexAdapter };
const DEFAULT_ADAPTER: AdapterId = 'claude-code';
const DEFAULT_PROFILE = 'profile.standard';
const PACKAGE_ROOT = join(__dirname, '..', '..');

export interface SetupOptions {
  root: string;
  /** Default: the hosts already configured in the project, else Claude Code. */
  adapters?: AdapterId[];
  profileId?: string;
  /** Entries to include even though the profile excludes them (e.g. `rule.honesty` for V1 `-H`). */
  includeIds?: string[];
  enabledTools?: string[];
  conflictStrategy?: ConflictStrategy;
  dryRun?: boolean;
  catalogDir?: string;
  distDir?: string;
  now?: () => Date;
}

export interface SetupOutcome {
  project: ProjectProfile;
  hosts: HostConfigDetection[];
  adapters: AdapterId[];
  generation: GenerationResult[];
  plan: InstallPlan;
  /** null on dry-run or when nothing needs to change. */
  applied: ApplyResult | null;
  /** True when the project already matches the generated configuration (idempotency). */
  upToDate: boolean;
  diagnostics: Diagnostic[];
}

function chooseAdapters(requested: AdapterId[] | undefined, hosts: HostConfigDetection[]): AdapterId[] {
  if (requested && requested.length > 0) return requested;
  const present = hosts.filter((host) => host.present).map((host) => host.adapter as AdapterId);
  return present.length > 0 ? present : [DEFAULT_ADAPTER];
}

/** V1 shipped broad allow rules (TD-01); setup never deletes user config, so it says so instead. */
function permissionWarnings(root: string, hosts: HostConfigDetection[]): Diagnostic[] {
  let settings: { permissions?: { allow?: unknown[] } };
  try {
    settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8')) as typeof settings;
  } catch {
    return [];
  }
  const allow = settings.permissions?.allow ?? [];
  if (allow.length === 0) return [];
  const v1 = hosts.some((host) => host.v1Fingerprint);
  return [
    {
      code: 'W_V1_PERMISSIONS',
      severity: 'warning',
      message: `.claude/settings.json keeps ${allow.length} existing allow rule(s)${v1 ? ' from V1 (they include Bash(rm *), Bash(curl *) and machine-specific paths)' : ''}; review and remove the ones you do not need. The policy hook still checks every command.`,
    },
  ];
}

/**
 * Setup use case (W2.0-14 core, docs/v2/05 §11.1): validate the bundled catalog, detect the project
 * and existing host config, generate for each adapter, plan, resolve conflicts, then apply as one
 * transaction (or stop after planning on dry-run).
 */
export function runSetup(options: SetupOptions): SetupOutcome {
  const catalogDir = options.catalogDir ?? join(PACKAGE_ROOT, 'catalog');
  const report = validateCatalog(catalogDir);
  if (!report.ok) throw new Error(`Bundled catalog is invalid: ${report.diagnostics.map((diagnostic) => diagnostic.code).join(', ')}`);

  const registry = new Registry(report.entries);
  const profileId = options.profileId ?? DEFAULT_PROFILE;
  const found = registry.get(profileId);
  if (found?.kind !== 'Profile') throw new Error(`Unknown profile "${profileId}"`);
  const includeIds = new Set(options.includeIds ?? []);
  const profile: ProfileEntry = { ...found, excludes: { ids: (found.excludes?.ids ?? []).filter((id) => !includeIds.has(id)) } };

  const project = detectProject(options.root);
  const hosts = Object.values(ADAPTERS).map((adapter) => adapter.detectExistingConfig(options.root));
  const adapters = chooseAdapters(options.adapters, hosts);
  const hookFiles = loadPolicyHookAssets(options.distDir).files;
  const toolkitVersion = (JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;

  const generation = adapters.map((id) =>
    ADAPTERS[id].generate({
      registry,
      knowledge: new KnowledgeIndex(report.loaded),
      profile,
      policies: report.policies,
      hookFiles,
      toolkitVersion,
      enabledTools: options.enabledTools ?? [],
    }),
  );
  const diagnostics = [...generation.flatMap((result) => result.diagnostics), ...permissionWarnings(options.root, hosts)];
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length > 0) throw new Error(`Generation failed: ${errors.map((diagnostic) => `${diagnostic.code} ${diagnostic.message}`).join('; ')}`);

  const meta: ManifestMeta = {
    toolkitVersion,
    catalogDigest: catalogDigest(catalogDir),
    adapters: Object.fromEntries(
      adapters.map((id) => [id, { version: ADAPTERS[id].version, hostCompat: 'unverified' as const, ...(id === 'codex' ? { trustRequired: true } : {}) }]),
    ),
    profile: profileId,
  };
  const plan = resolveConflicts(
    planInstall({ root: options.root, operations: generation.flatMap((result) => result.operations), meta }),
    options.conflictStrategy ?? 'write-new',
  );
  const upToDate = plan.changes.every((change) => change.action === 'unchanged' || change.action === 'skip');
  const applied =
    options.dryRun || upToDate
      ? null
      : applyPlan(plan, { op: readManifest(options.root) ? 'update' : 'setup', ...(options.now ? { now: options.now } : {}) });

  return { project, hosts, adapters, generation, plan, applied, upToDate, diagnostics };
}

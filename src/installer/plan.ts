import { compareCodeUnits } from '../shared/compare';
import { sectionMarkers, type FileOperation } from '../shared/file-operations';
import { applyInMemory } from './apply-in-memory';
import { unifiedDiff } from './diff';
import { readManifest, readText, sha256, type Manifest, type ManifestMeta } from './manifest';

export type ChangeAction = 'create' | 'update' | 'merge' | 'unchanged' | 'conflict' | 'skip';
/** Ownership classes from docs/v2/05 §11.2. */
export type Ownership = 'new' | 'managed' | 'managed-modified' | 'unmanaged' | 'shared';
export type ConflictStrategy = 'skip' | 'write-new' | 'backup-overwrite';

export const NEW_FILE_SUFFIX = '.ai-agent-setup.new';

export interface PlannedChange {
  path: string;
  /** Where the content is written: `path`, or `path` + NEW_FILE_SUFFIX for write-new. */
  target: string;
  action: ChangeAction;
  ownership: Ownership;
  before: string | null;
  after: string;
  reason: string;
  diff: string;
  operations: FileOperation[];
}

export interface InstallPlan {
  root: string;
  meta: ManifestMeta;
  manifest: Manifest | null;
  changes: PlannedChange[];
}

export interface PlanInput {
  root: string;
  operations: readonly FileOperation[];
  meta: ManifestMeta;
}

/** Inner text of a managed section in either marker style, or null when absent. */
export function extractSection(content: string, marker: string): string | null {
  for (const style of ['html', 'hash'] as const) {
    const { begin, end } = sectionMarkers(marker, style);
    const start = content.indexOf(begin);
    const stop = content.indexOf(end, start);
    if (start !== -1 && stop !== -1) return content.slice(start + begin.length + 1, stop - 1);
  }
  return null;
}

function computeAfter(path: string, operations: FileOperation[], before: string | null): { after: string; error: string | null } {
  try {
    const base = before === null ? new Map<string, string>() : new Map([[path, before]]);
    return { after: applyInMemory(operations, base).get(path)!, error: null };
  } catch (error) {
    // The only failure is unparsable JSON: overwriting would start from an empty document.
    return { after: applyInMemory(operations).get(path)!, error: `existing file is not valid JSON (${(error as Error).message})` };
  }
}

function sectionEditedByHand(path: string, operations: FileOperation[], before: string, manifest: Manifest | null): boolean {
  return operations.some((op) => {
    if (op.kind !== 'section') return false;
    const recorded = manifest?.sections.find((section) => section.path === path && section.marker === op.marker);
    const current = extractSection(before, op.marker);
    return recorded !== undefined && current !== null && sha256(current) !== recorded.sha256;
  });
}

function classify(path: string, operations: FileOperation[], before: string | null, manifest: Manifest | null) {
  const { after, error } = computeAfter(path, operations, before);
  const hasWrite = operations.some((op) => op.kind === 'write');
  const recorded = manifest?.files.find((file) => file.path === path);
  const decide = (action: ChangeAction, ownership: Ownership, reason: string) => ({ action, ownership, after, reason });

  if (error) return decide('conflict', 'shared', error);
  if (before === null) return decide('create', 'new', 'new file');
  if (after === before) return decide('unchanged', recorded ? 'managed' : hasWrite ? 'unmanaged' : 'shared', 'already up to date');
  if (hasWrite) {
    if (!recorded) return decide('conflict', 'unmanaged', 'file exists and is not managed by ai-agent-setup');
    if (recorded.sha256 !== sha256(before)) return decide('conflict', 'managed-modified', 'managed file was modified since it was installed');
    return decide('update', 'managed', 'managed file, unchanged since install');
  }
  if (sectionEditedByHand(path, operations, before, manifest)) {
    return decide('conflict', 'shared', 'a managed section was edited by hand');
  }
  return decide('merge', 'shared', 'managed content merged; everything else in the file is kept');
}

/**
 * Read-only install planning (docs/v2/05 §11.1): classifies every touched path by ownership and
 * computes its new content and diff. Never writes to disk, so it is the dry-run.
 */
export function planInstall({ root, operations, meta }: PlanInput): InstallPlan {
  const manifest = readManifest(root);
  const byPath = new Map<string, FileOperation[]>();
  for (const op of operations) byPath.set(op.path, [...(byPath.get(op.path) ?? []), op]);

  const changes = [...byPath.entries()]
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([path, pathOperations]): PlannedChange => {
      const before = readText(root, path);
      const { action, ownership, after, reason } = classify(path, pathOperations, before, manifest);
      return { path, target: path, action, ownership, before, after, reason, diff: unifiedDiff(path, before, after), operations: pathOperations };
    });
  return { root, meta, manifest, changes };
}

/** Applies one strategy to every conflict; nothing is overwritten without one (safety.no-silent-overwrite). */
export function resolveConflicts(plan: InstallPlan, strategy: ConflictStrategy): InstallPlan {
  const changes = plan.changes.map((change): PlannedChange => {
    if (change.action !== 'conflict') return change;
    switch (strategy) {
      case 'skip':
        return { ...change, action: 'skip', reason: `${change.reason}; skipped` };
      case 'write-new':
        return {
          ...change,
          target: `${change.path}${NEW_FILE_SUFFIX}`,
          action: 'create',
          diff: unifiedDiff(`${change.path}${NEW_FILE_SUFFIX}`, null, change.after),
          reason: `${change.reason}; new version written next to it for review`,
        };
      case 'backup-overwrite':
        return { ...change, action: change.ownership === 'shared' ? 'merge' : 'update', reason: `${change.reason}; overwritten after backup` };
    }
  });
  return { ...plan, changes };
}

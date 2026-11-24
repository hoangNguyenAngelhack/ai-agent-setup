import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  JSON_SECTION_MARKER,
  MANIFEST_PATH,
  readText,
  serializeManifest,
  sha256,
  STATE_GITIGNORE,
  STATE_GITIGNORE_PATH,
  type Manifest,
  type ManifestFile,
  type ManifestSection,
  type ManifestTransaction,
} from './manifest';
import { compareCodeUnits } from '../shared/compare';
import type { InstallPlan, PlannedChange } from './plan';
import { atomicWrite, backupFile, ensureParentDirs, newTransactionId, restoreJournal, saveJournal, type Journal } from './transaction';

export interface ApplyOptions {
  op: ManifestTransaction['op'];
  now?: () => Date;
}

export interface ApplyResult {
  transactionId: string;
  created: string[];
  modified: string[];
  skipped: string[];
}

const WRITING_ACTIONS = new Set(['create', 'update', 'merge']);

function recordsOwnPath(change: PlannedChange): boolean {
  return change.target === change.path && change.action !== 'skip';
}

/** Manifest after the transaction: previous records, updated for every path this plan manages. */
function nextManifest(plan: InstallPlan, transaction: ManifestTransaction): Manifest {
  const files = new Map<string, ManifestFile>((plan.manifest?.files ?? []).map((file) => [file.path, file]));
  const sections = new Map<string, ManifestSection>((plan.manifest?.sections ?? []).map((section) => [`${section.path}#${section.marker}`, section]));

  for (const change of plan.changes.filter(recordsOwnPath)) {
    for (const op of change.operations) {
      if (op.kind === 'write') files.set(change.path, { path: change.path, sha256: sha256(change.after), source: op.source, class: 'managed' });
      if (op.kind === 'section') sections.set(`${op.path}#${op.marker}`, { path: op.path, marker: op.marker, sha256: sha256(op.content) });
      if (op.kind === 'merge-json') {
        sections.set(`${op.path}#${JSON_SECTION_MARKER}`, { path: op.path, marker: JSON_SECTION_MARKER, sha256: sha256(JSON.stringify(op.value)) });
      }
    }
  }
  const byPath = <T extends { path: string }>(a: T, b: T) => compareCodeUnits(a.path, b.path);
  return {
    schema: 'manifest/v1',
    ...plan.meta,
    files: [...files.values()].sort(byPath),
    sections: [...sections.values()].sort(byPath),
    transactions: [...(plan.manifest?.transactions ?? []), transaction],
  };
}

/**
 * Applies a resolved plan as one transaction (docs/v2/05 §11.1): write-ahead journal, backup of
 * every existing file before it changes, atomic writes with verification, then the manifest. Any
 * failure rolls the whole transaction back.
 */
export function applyPlan(plan: InstallPlan, { op, now = () => new Date() }: ApplyOptions): ApplyResult {
  const conflicts = plan.changes.filter((change) => change.action === 'conflict');
  if (conflicts.length > 0) {
    throw new Error(`Plan has unresolved conflict(s): ${conflicts.map((change) => change.path).join(', ')}`);
  }

  const root = plan.root;
  const stale = plan.changes.filter((change) => change.target === change.path && WRITING_ACTIONS.has(change.action) && readText(root, change.path) !== change.before);
  if (stale.length > 0) {
    throw new Error(`File(s) changed after the plan was made; plan again: ${stale.map((change) => change.path).join(', ')}`);
  }

  const transactionId = newTransactionId(root, now());
  const transaction: ManifestTransaction = { id: transactionId, op, backup: `backups/${transactionId}` };
  const writes = plan.changes
    .filter((change) => WRITING_ACTIONS.has(change.action))
    .map((change) => ({ path: change.target, content: change.after }));
  writes.push({ path: MANIFEST_PATH, content: serializeManifest(nextManifest(plan, transaction)) });
  if (readText(root, STATE_GITIGNORE_PATH) !== STATE_GITIGNORE) writes.push({ path: STATE_GITIGNORE_PATH, content: STATE_GITIGNORE });

  const journal: Journal = { id: transactionId, op, status: 'pending', startedAt: now().toISOString(), created: [], modified: [], createdDirs: [] };
  saveJournal(root, journal);
  try {
    for (const { path, content } of writes) {
      const entry = { path, sha256: sha256(content) };
      if (existsSync(join(root, path))) journal.modified.push({ ...entry, backup: backupFile(root, transactionId, path) });
      else {
        journal.createdDirs.push(...ensureParentDirs(root, path));
        journal.created.push(entry);
      }
      saveJournal(root, journal);
      atomicWrite(root, path, content, transactionId);
    }
  } catch (error) {
    restoreJournal(root, journal, true);
    saveJournal(root, { ...journal, status: 'rolled-back' });
    throw new Error(`Install failed and was rolled back (${transactionId}): ${(error as Error).message}`);
  }
  saveJournal(root, { ...journal, status: 'committed' });

  return {
    transactionId,
    created: journal.created.map((entry) => entry.path),
    modified: journal.modified.map((entry) => entry.path),
    skipped: plan.changes.filter((change) => change.action === 'skip').map((change) => change.path),
  };
}

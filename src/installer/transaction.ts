import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sha256, STATE_DIR } from './manifest';

export interface JournalEntry {
  path: string;
  /** Hash of the content this transaction wrote. */
  sha256: string;
  /** Backup location relative to the state directory (modified files only). */
  backup?: string;
}

/** Write-ahead journal of one transaction (`.ai-agent-setup/transactions/<id>.json`). */
export interface Journal {
  id: string;
  op: string;
  status: 'pending' | 'committed' | 'rolled-back';
  startedAt: string;
  created: JournalEntry[];
  modified: JournalEntry[];
  createdDirs: string[];
}

const TRANSACTIONS_DIR = `${STATE_DIR}/transactions`;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function newTransactionId(root: string, date: Date): string {
  const base = `txn-${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  let id = base;
  for (let suffix = 1; existsSync(join(root, TRANSACTIONS_DIR, `${id}.json`)); suffix += 1) id = `${base}-${suffix}`;
  return id;
}

export function saveJournal(root: string, journal: Journal): void {
  mkdirSync(join(root, TRANSACTIONS_DIR), { recursive: true });
  writeFileSync(join(root, TRANSACTIONS_DIR, `${journal.id}.json`), `${JSON.stringify(journal, null, 2)}\n`);
}

/** Journals newest first. */
export function listJournals(root: string): Journal[] {
  const dir = join(root, TRANSACTIONS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Journal);
}

/** Creates missing parent directories of `path`; returns the ones created, shallowest first. */
export function ensureParentDirs(root: string, path: string): string[] {
  const missing: string[] = [];
  for (let dir = dirname(path); dir !== '.' && !existsSync(join(root, dir)); dir = dirname(dir)) missing.unshift(dir);
  if (missing.length > 0) mkdirSync(join(root, missing.at(-1)!), { recursive: true });
  return missing;
}

/** Writes through a temporary file and a rename so a file is never half-written. */
export function atomicWrite(root: string, path: string, content: string, transactionId: string): void {
  const full = join(root, path);
  const temporary = `${full}.ai-agent-setup.tmp-${transactionId}`;
  try {
    writeFileSync(temporary, content);
    renameSync(temporary, full);
  } finally {
    rmSync(temporary, { force: true });
  }
  if (sha256(readFileSync(full, 'utf8')) !== sha256(content)) throw new Error(`Verification failed after writing ${path}`);
}

export function backupFile(root: string, transactionId: string, path: string): string {
  const backup = `backups/${transactionId}/${path}`;
  mkdirSync(dirname(join(root, STATE_DIR, backup)), { recursive: true });
  copyFileSync(join(root, path), join(root, STATE_DIR, backup));
  return backup;
}

function currentHash(root: string, path: string): string | null {
  const full = join(root, path);
  return existsSync(full) ? sha256(readFileSync(full, 'utf8')) : null;
}

/**
 * Undoes a journal: restores backups, deletes created files and empty created directories.
 * Without `force`, refuses when a file was changed after the transaction wrote it.
 */
export function restoreJournal(root: string, journal: Journal, force: boolean): { restored: string[]; removed: string[] } {
  if (!force) {
    const changed = [...journal.created, ...journal.modified].filter((entry) => {
      const hash = currentHash(root, entry.path);
      return hash !== null && hash !== entry.sha256;
    });
    if (changed.length > 0) {
      throw new Error(
        `${changed.map((entry) => entry.path).join(', ')} modified after the transaction ${journal.id}; roll back with force to discard those changes`,
      );
    }
  }
  const restored = journal.modified.map((entry) => {
    copyFileSync(join(root, STATE_DIR, entry.backup!), join(root, entry.path));
    return entry.path;
  });
  const removed = journal.created.filter((entry) => existsSync(join(root, entry.path))).map((entry) => {
    rmSync(join(root, entry.path));
    return entry.path;
  });
  for (const dir of [...journal.createdDirs].reverse()) {
    const full = join(root, dir);
    if (existsSync(full) && readdirSync(full).length === 0) rmdirSync(full);
  }
  return { restored, removed };
}

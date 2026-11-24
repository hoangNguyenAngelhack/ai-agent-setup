import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalPath, isWithin, keyDirectory } from '../shared/key-location';

export { keyDirectory };

/**
 * Local integrity of run artifacts (ADR-016). A per-project HMAC key lives outside the project, in
 * the user's configuration directory, so files the agent edits in the project cannot carry a valid
 * signature. It is a guard against tampering through the host's tools and ordinary scripts; code run
 * under the same OS account can still read the key (see the ADR's residual risks).
 */
export const INTEGRITY_SCHEME = 'hmac-sha256';
const KEY_BYTES = 32;
const LOCK_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 30_000;

/**
 * Stable id of a project, from its real path; the key and run heads are stored under it. Case-folded
 * where the file system is case-insensitive, so `/Users/x/Proj` and `/users/x/proj` share one key.
 */
export function projectKeyId(root: string): string {
  return createHash('sha256').update(canonicalPath(root)).digest('hex').slice(0, 16);
}

/** The key must never be readable as a project file (ADR-016). */
function assertKeyOutside(root: string): void {
  if (isWithin(keyDirectory(), root)) throw new Error(`The key directory ${keyDirectory()} is inside the project; set AI_AGENT_SETUP_KEY_DIR outside it`);
}

export interface ProjectKey {
  keyId: string;
  key: Buffer;
  /** When the key was created: runs created later must be signed. */
  createdAt: string;
}

function ensurePrivateDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') chmodSync(dir, 0o700);
}

export function readProjectKey(root: string): ProjectKey | null {
  assertKeyOutside(root);
  const keyId = projectKeyId(root);
  const file = join(keyDirectory(), `${keyId}.key`);
  if (!existsSync(file)) return null;
  const { key, createdAt } = JSON.parse(readFileSync(file, 'utf8')) as { key: string; createdAt: string };
  return { keyId, key: Buffer.from(key, 'hex'), createdAt };
}

/**
 * Creates the project key on first use (random, mode 0600), never inside the project. `legacyRunIds`
 * are the runs approved before the key existed: they stay readable unsigned. The list is kept with
 * the key, so no file in the project can make a newer run count as unsigned.
 */
export function projectKey(root: string, now: Date = new Date(), legacyRunIds: string[] = []): ProjectKey {
  const existing = readProjectKey(root);
  if (existing) return existing;
  ensurePrivateDir(keyDirectory());
  const keyId = projectKeyId(root);
  const key = randomBytes(KEY_BYTES);
  const createdAt = now.toISOString();
  ensurePrivateDir(join(keyDirectory(), keyId));
  writeFileSync(join(keyDirectory(), keyId, 'legacy-runs.json'), JSON.stringify([...legacyRunIds].sort()), { mode: 0o600 });
  writeFileSync(join(keyDirectory(), `${keyId}.key`), JSON.stringify({ key: key.toString('hex'), createdAt }), { mode: 0o600, flag: 'wx' });
  return { keyId, key, createdAt };
}

/** Runs approved before the project key existed (recorded when the key was created). */
export function legacyRuns(key: ProjectKey): string[] {
  const file = join(keyDirectory(), key.keyId, 'legacy-runs.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as string[]) : [];
}

export function mac(key: Buffer, data: string): string {
  return `${INTEGRITY_SCHEME}:${createHmac('sha256', key).update(data).digest('hex')}`;
}

export function macMatches(key: Buffer, data: string, expected: unknown): boolean {
  if (typeof expected !== 'string') return false;
  const actual = Buffer.from(mac(key, data));
  const given = Buffer.from(expected);
  return actual.length === given.length && timingSafeEqual(actual, given);
}

/** What an approval signature covers: the exact revision and who approved it when. */
export function approvalPayload(approval: { runId: string; revision: number; digest: string; by: string; at: string }): string {
  return ['approval', approval.runId, approval.revision, approval.digest, approval.by, approval.at].join('\n');
}

/**
 * What an event signature covers: its position, the exact line written to events.jsonl, and the
 * checksums of evidence files recorded with it (gate records and their logs).
 */
export function eventPayload(runId: string, seq: number, line: string, files: Record<string, string> = {}): string {
  const evidence = Object.keys(files)
    .sort()
    .map((path) => `${path}=${files[path]}`)
    .join('\n');
  return ['event', runId, seq, line, evidence].join('\n');
}

/** Head of a run's log, kept with the key (outside the project) to detect truncation or rollback. */
export interface RunHead {
  count: number;
  last: string | null;
}

function headFile(key: ProjectKey, runId: string): string {
  return join(keyDirectory(), key.keyId, 'runs', `${runId}.head`);
}

export function readRunHead(key: ProjectKey, runId: string): RunHead | null {
  const file = headFile(key, runId);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RunHead) : null;
}

export function writeRunHead(key: ProjectKey, runId: string, head: RunHead): void {
  const file = headFile(key, runId);
  ensurePrivateDir(join(keyDirectory(), key.keyId, 'runs'));
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, JSON.stringify(head), { mode: 0o600 });
  renameSync(temporary, file);
}

/**
 * Serialises appends to one run across processes (the orchestrator and the agent's `run event`
 * can write at the same time): an exclusive directory under the key directory.
 */
export function withRunLock<T>(key: ProjectKey, runId: string, action: () => T): T {
  const lock = join(keyDirectory(), key.keyId, 'runs', `${runId}.lock`);
  ensurePrivateDir(join(keyDirectory(), key.keyId, 'runs'));
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) {
        rmdirSync(lock);
        continue;
      }
      if (Date.now() > deadline) throw new Error(`Run ${runId} is locked by another process`);
      const until = Date.now() + 20;
      while (Date.now() < until) {
        // Short busy wait: the CLI is synchronous and appends take milliseconds.
      }
    }
  }
  try {
    return action();
  } finally {
    rmdirSync(lock);
  }
}

export function sha256File(path: string): string | null {
  return existsSync(path) ? `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}` : null;
}

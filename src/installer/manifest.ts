import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Installer state lives in one directory per project (docs/v2/05 §11.3). */
export const STATE_DIR = '.ai-agent-setup';
export const MANIFEST_PATH = `${STATE_DIR}/manifest.json`;
export const STATE_GITIGNORE_PATH = `${STATE_DIR}/.gitignore`;
/** Backups and journals are machine-local; the manifest is committed for the team. */
export const STATE_GITIGNORE = 'backups/\ntransactions/\nruns/\n';
export const JSON_SECTION_MARKER = 'json';

export interface ManifestMeta {
  toolkitVersion: string;
  catalogDigest: string;
  adapters: Record<string, { version: string; hostCompat: 'verified' | 'unverified'; trustRequired?: boolean }>;
  profile: string;
}

export interface ManifestFile {
  path: string;
  sha256: string;
  source: string | null;
  class: 'managed' | 'unmanaged-v1' | 'pristine-v1';
}

export interface ManifestSection {
  path: string;
  marker: string;
  sha256: string;
}

export interface ManifestTransaction {
  id: string;
  op: 'create' | 'setup' | 'adopt' | 'update' | 'rollback';
  backup: string | null;
}

/** Contract: `urn:ai-agent-setup:contracts:v1:manifest`. */
export interface Manifest extends ManifestMeta {
  schema: 'manifest/v1';
  files: ManifestFile[];
  sections: ManifestSection[];
  transactions: ManifestTransaction[];
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function readText(root: string, path: string): string | null {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

export function readManifest(root: string): Manifest | null {
  const text = readText(root, MANIFEST_PATH);
  if (text === null) return null;
  const value = JSON.parse(text) as Manifest;
  if (value.schema !== 'manifest/v1') throw new Error(`Unsupported manifest schema in ${MANIFEST_PATH}: ${String(value.schema)}`);
  return value;
}

export function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

import { JSON_SECTION_MARKER, MANIFEST_PATH, readManifest, readText, sha256, type Manifest } from './manifest';
import { extractSection } from './plan';
import { listJournals } from './transaction';

export type DoctorIssueCode =
  | 'NOT_INSTALLED'
  | 'MISSING'
  | 'MODIFIED'
  | 'SECTION_MISSING'
  | 'SECTION_MODIFIED'
  | 'INVALID_JSON'
  | 'PENDING_TRANSACTION';

export interface DoctorIssue {
  code: DoctorIssueCode;
  path?: string;
  message: string;
}

export interface DoctorReport {
  healthy: boolean;
  manifest: Manifest | null;
  issues: DoctorIssue[];
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Integrity check of an install against its manifest (docs/v2/05 §11.4). */
export function doctor(root: string): DoctorReport {
  const manifest = readManifest(root);
  if (!manifest) {
    return { healthy: false, manifest, issues: [{ code: 'NOT_INSTALLED', message: `No ${MANIFEST_PATH}; run setup first` }] };
  }
  const issues: DoctorIssue[] = [];

  for (const file of manifest.files) {
    const content = readText(root, file.path);
    if (content === null) issues.push({ code: 'MISSING', path: file.path, message: 'managed file is missing' });
    else if (sha256(content) !== file.sha256) issues.push({ code: 'MODIFIED', path: file.path, message: 'managed file was changed since install' });
  }

  for (const section of manifest.sections) {
    const content = readText(root, section.path);
    if (content === null) {
      issues.push({ code: 'MISSING', path: section.path, message: 'file with managed content is missing' });
    } else if (section.marker === JSON_SECTION_MARKER) {
      if (!isJson(content)) issues.push({ code: 'INVALID_JSON', path: section.path, message: 'file is no longer valid JSON' });
    } else {
      const inner = extractSection(content, section.marker);
      if (inner === null) issues.push({ code: 'SECTION_MISSING', path: section.path, message: `managed section "${section.marker}" was removed` });
      else if (sha256(inner) !== section.sha256) {
        issues.push({ code: 'SECTION_MODIFIED', path: section.path, message: `managed section "${section.marker}" was edited` });
      }
    }
  }

  for (const journal of listJournals(root).filter((candidate) => candidate.status === 'pending')) {
    issues.push({ code: 'PENDING_TRANSACTION', message: `transaction ${journal.id} did not finish; run rollback to recover` });
  }

  return { healthy: issues.length === 0, manifest, issues };
}

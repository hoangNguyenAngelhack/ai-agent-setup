export { applyInMemory, mergeJson } from './apply-in-memory';
export { applyPlan, type ApplyOptions, type ApplyResult } from './apply';
export { unifiedDiff } from './diff';
export { doctor, type DoctorIssue, type DoctorIssueCode, type DoctorReport } from './doctor';
export {
  MANIFEST_PATH,
  readManifest,
  sha256,
  STATE_DIR,
  type Manifest,
  type ManifestMeta,
} from './manifest';
export {
  extractSection,
  NEW_FILE_SUFFIX,
  planInstall,
  resolveConflicts,
  type ChangeAction,
  type ConflictStrategy,
  type InstallPlan,
  type Ownership,
  type PlannedChange,
} from './plan';
export { rollback, type RollbackResult } from './rollback';

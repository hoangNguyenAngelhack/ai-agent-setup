import type { HostConfigDetection } from '../core/contracts';
import type { AdapterId, Diagnostic, KnowledgeIndex, PolicyDocument, ProfileEntry, Registry } from '../registry';
import type { FileOperation } from '../shared/file-operations';

export type Support = 'native' | 'emulated' | 'unsupported';

export interface GenerationInput {
  registry: Registry;
  knowledge: KnowledgeIndex;
  profile: ProfileEntry;
  /** Mandatory and project policies; copied into the policy hook. */
  policies: PolicyDocument[];
  /** Self-contained policy hook runtime (path inside the hook directory → content). */
  hookFiles: Record<string, string>;
  toolkitVersion: string;
  /** Tool entries (MCP servers) are opt-in per server (docs/v2/05 §10.3). */
  enabledTools: string[];
  /**
   * Languages detected in the project (docs/v2/16). An entry that names languages in
   * `requiredContext.projectSignals` is generated only for a project using one of them; absent or
   * empty (nothing detected), every entry is generated.
   */
  projectLanguages?: string[];
}

export interface GeneratedItem {
  entryId: string;
  support: Support;
  outputs: string[];
  note?: string;
}

export interface GenerationResult {
  adapter: AdapterId;
  operations: FileOperation[];
  items: GeneratedItem[];
  diagnostics: Diagnostic[];
}

/**
 * Native adapter contract (docs/v2/05 §10.1). `generate` writes nothing to the project: it reads
 * catalog content and returns file operations that the installer applies.
 */
export interface Adapter {
  readonly id: AdapterId;
  readonly version: string;
  detectExistingConfig(root: string): HostConfigDetection;
  generate(input: GenerationInput): GenerationResult;
}

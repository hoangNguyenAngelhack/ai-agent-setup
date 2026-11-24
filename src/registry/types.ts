/**
 * Typed view of catalog entries (contract `catalog.ai-agent-setup/v1`).
 * The JSON Schemas in `catalog/schemas/` are the normative source; these types mirror them.
 */

export const ENTITY_KINDS = [
  'Domain',
  'Capability',
  'Agent',
  'Skill',
  'Rule',
  'Workflow',
  'Tool',
  'Profile',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const ADAPTER_IDS = ['claude-code', 'codex'] as const;
export type AdapterId = (typeof ADAPTER_IDS)[number];

export type EntryStatus = 'draft' | 'experimental' | 'stable' | 'deprecated' | 'removed';
export type AdapterSupport = 'native' | 'emulated' | 'unsupported';
export type DepthLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type Level3 = 'low' | 'medium' | 'high';

export interface EntryValidation {
  gates: string[];
  reviewChecklist?: string | null;
}

export interface Deprecation {
  since: string;
  replacedBy: string | null;
  removalIn: string;
}

export interface CatalogEntryBase {
  apiVersion: 'catalog.ai-agent-setup/v1';
  kind: EntityKind;
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  status: EntryStatus;
  dependencies: string[];
  requiredContext: { projectSignals: string[]; files: string[] };
  supportedAdapters: Record<AdapterId, AdapterSupport>;
  unsupportedReasons?: Partial<Record<AdapterId, string>>;
  requiredPermissions: string[];
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  validation: EntryValidation | null;
  owners?: string[];
  deprecation?: Deprecation | null;
}

export interface DomainEntry extends CatalogEntryBase {
  kind: 'Domain';
  ordinal: number;
  purpose: string;
  roles: string[];
  capabilities: string[];
  depthLevel: DepthLevel;
}

export interface CapabilityEntry extends CatalogEntryBase {
  kind: 'Capability';
  domain: string;
  skills: string[];
  rules: string[];
  defaultAgents: string[];
  riskLevel: Level3;
  costHint: Level3;
}

export interface AgentEntry extends CatalogEntryBase {
  kind: 'Agent';
  purpose: string;
  capabilities: string[];
  skills: string[];
  tools: { allow: string[]; deny: string[] };
  modelHint: 'fast' | 'balanced' | 'deep';
  body: string | null;
  aliasOf: string | null;
}

export interface SkillEntry extends CatalogEntryBase {
  kind: 'Skill';
  body: string | null;
  triggers: string;
  resources: string[];
  disableImplicit: boolean;
}

export type RuleScope = { always: true } | { paths: string[] } | { capabilities: string[] };

export interface RuleEntry extends CatalogEntryBase {
  kind: 'Rule';
  body: string | null;
  scope: RuleScope;
  enforcement: 'advisory' | 'gate' | 'policy';
}

export interface WorkflowStep {
  id: string;
  capability: string;
  agent: string;
  gates: string[];
  approval: 'none' | 'optional' | 'required';
}

export interface WorkflowEntry extends CatalogEntryBase {
  kind: 'Workflow';
  entry: string | null;
  domains: string[];
  steps: WorkflowStep[];
  body: string | null;
}

export interface ToolEntry extends CatalogEntryBase {
  kind: 'Tool';
  type: 'command' | 'mcp' | 'host';
  command?: string;
  mcp?: Record<string, unknown>;
  platforms: Array<'darwin' | 'linux' | 'win32'>;
  network: boolean;
}

export interface ProfileEntry extends CatalogEntryBase {
  kind: 'Profile';
  includes: { domains?: string[]; ids?: string[]; statuses?: EntryStatus[] };
  excludes?: { ids?: string[] };
  policy: string | null;
  contextBudget: Partial<Record<AdapterId, number>>;
  gates: string[];
}

export type CatalogEntry =
  | DomainEntry
  | CapabilityEntry
  | AgentEntry
  | SkillEntry
  | RuleEntry
  | WorkflowEntry
  | ToolEntry
  | ProfileEntry;

export type EntryOfKind<K extends EntityKind> = Extract<CatalogEntry, { kind: K }>;

/** Directory (under the catalog root) that holds each kind, one entity per file. */
export const KIND_DIRECTORIES: Record<EntityKind, string> = {
  Domain: 'domains',
  Capability: 'capabilities',
  Agent: 'agents',
  Skill: 'skills',
  Rule: 'rules',
  Workflow: 'workflows',
  Tool: 'tools',
  Profile: 'profiles',
};

export type PolicyLayer = 'mandatory' | 'organization' | 'project' | 'user';
export type PolicyEffect = 'allow' | 'ask' | 'deny';

export interface PolicyMatch {
  /** Token globs: `*` alone matches any number of tokens; `*` inside a token matches characters. */
  commands?: string[];
  /** JavaScript regular expressions tested against the whole command text. */
  commandRegex?: string[];
  ignoreCase?: boolean;
  intents?: string[];
  /** JavaScript regular expressions tested against content being written. */
  contentRegex?: string[];
  /**
   * Globs for project-relative paths being written (`**`, `*`, `?`, `{a,b}`). For a write, every
   * write criterion present (`paths`, `contentRegex`) must match.
   */
  paths?: string[];
}

export interface PolicyRule {
  id: string;
  description: string;
  effect: PolicyEffect;
  match: PolicyMatch;
}

/** Contract: `urn:ai-agent-setup:contracts:v1:policy` (docs/v2/05 §9). */
export interface PolicyDocument {
  schema: 'policy/v1';
  id: string;
  layer: PolicyLayer;
  description: string;
  rules: PolicyRule[];
  invariants?: Array<{ id: string; description: string; enforcedBy: string }>;
}

export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  entryId?: string;
  file?: string;
}

export interface LoadedEntry<T = CatalogEntry> {
  entry: T;
  file: string;
  /** Kind implied by the directory the file was found in. */
  directoryKind: EntityKind;
}

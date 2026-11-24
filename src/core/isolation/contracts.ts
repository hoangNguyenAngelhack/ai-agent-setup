/**
 * Runtime Isolation contracts (W2.2-09, ADR-017). Provider-independent: they describe what a launch
 * must enforce and what a provider can prove; how it is enforced is the provider's business.
 */

/**
 * none: today's behaviour, no isolation claimed.
 * restricted: an OS-enforced sandbox under the same OS account (filesystem, exec, signals, network).
 * isolated: a separate security principal (OS user) in addition to the restricted controls.
 */
export type IsolationProfile = 'none' | 'restricted' | 'isolated';

export type NetworkPolicy = { mode: 'allow-all' } | { mode: 'deny-all' } | { mode: 'allowlist'; hosts: string[] };

export type CapabilityStatus = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'NOT_VERIFIED';

/** The controls a launch can need, each reported on its own. */
export const ISOLATION_CONTROLS = [
  'identity-separation',
  'filesystem-read',
  'filesystem-write',
  'secret-isolation',
  'process-exec',
  'process-signal',
  'network-deny',
  'network-allowlist',
  'approval-boundary',
] as const;
export type IsolationControl = (typeof ISOLATION_CONTROLS)[number];

export interface Capability {
  status: CapabilityStatus;
  reason: string;
}

export interface IsolationCapabilities {
  provider: string;
  platform: string;
  profiles: Record<IsolationProfile, Capability>;
  controls: Record<IsolationControl, Capability>;
}

/** What a launch must enforce. Paths are absolute. */
export interface IsolationPolicy {
  profile: IsolationProfile;
  network: NetworkPolicy;
  /** The project the agent works on: readable and writable, except the toolkit's runtime state. */
  workspace: string;
  /** Inside the workspace, never writable by the agent (ADR-016 runtime state). */
  workspaceReadOnly: string[];
  /** Readable outside the confined roots, for example the host CLI install and the toolkit itself. */
  readable: string[];
  /** Writable besides the workspace, for example the host's own state directory. */
  writable: string[];
  /** Never readable or writable, whatever else allows: keys, credentials. */
  protected: string[];
  /** Directories whose contents are denied unless listed above (home, temporary roots). */
  confinedRoots: string[];
  /** Environment variables passed to the agent; everything else is dropped. */
  environment: Record<string, string>;
}

/** What a provider prepared; nothing is started before this exists (fail closed). */
export interface PreparedLaunch {
  requested: IsolationProfile;
  applied: IsolationProfile;
  provider: string;
  platform: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  /** A private writable area for the launch (temporary files, the event inbox); null for none. */
  scratch: string | null;
  /** Controls in force for this launch, and the ones that are not, with why. */
  enforced: IsolationControl[];
  notEnforced: Array<{ control: IsolationControl; reason: string }>;
  cleanup(): void;
}

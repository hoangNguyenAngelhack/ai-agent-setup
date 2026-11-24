import { spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { ExecutionEvent } from '../core/execution';
import { policyProblems, type IsolationPolicy, type IsolationProfile, type NetworkPolicy, type PreparedLaunch } from '../core/isolation';
import { providerFor } from '../isolation';
import { keyDirectory, realPathLoose } from '../shared/key-location';

const PACKAGE_ROOT = join(__dirname, '..', '..');

/** Host state each CLI keeps under the home directory (defaults; not verified against the real CLIs). */
const HOST_STATE: Record<string, string[]> = {
  'claude-code': ['.claude', '.claude.json', '.claude.json.backup', 'Library/Caches/claude-cli-nodejs'],
  codex: ['.codex'],
};

/** Credentials and keys that no agent process may read (in addition to the integrity key). */
const SENSITIVE_IN_HOME = ['.ssh', '.aws', '.azure', '.kube', '.docker', '.gnupg', '.netrc', '.git-credentials', '.npmrc', '.config/gcloud', '.config/gh', 'Library/Keychains'];

/** Environment passed to an isolated agent; everything else (tokens, cloud keys) is dropped. */
const ENV_NAMES = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'TERM', 'TZ', 'COLORTERM', 'NO_COLOR']);
const ENV_PREFIXES = ['LC_', 'ANTHROPIC_', 'CLAUDE_', 'OPENAI_', 'CODEX_'];

export const INBOX_ENV = 'AI_AGENT_SETUP_EVENT_INBOX';

export interface IsolationRequest {
  profile: IsolationProfile;
  network: NetworkPolicy;
  host: string;
  /** Absolute path of the host executable. */
  executable: string;
  allowRead?: string[];
  allowWrite?: string[];
  /** Extra environment variable names to pass (for example a fake host's mode in tests). */
  passEnv?: string[];
  /** Home directory of the agent; defaults to the user's. */
  home?: string;
}

/** Absolute path of a command on PATH, or null. */
export function resolveExecutable(name: string): string | null {
  const probe = process.platform === 'win32' ? spawnSync('where.exe', [name], { encoding: 'utf8' }) : spawnSync('sh', ['-c', 'command -v "$1"', 'sh', name], { encoding: 'utf8' });
  return probe.status === 0 ? (probe.stdout.split(/\r?\n/)[0]?.trim() ?? null) : null;
}

/** Builds what an isolated launch must enforce for this project and host. */
export function buildIsolationPolicy(root: string, request: IsolationRequest): IsolationPolicy {
  const homes = [...new Set([homedir(), ...(request.home ? [request.home] : [])])];
  const home = request.home ?? homedir();
  const hostState = (HOST_STATE[request.host] ?? []).map((path) => join(home, path));
  const runtime = dirname(dirname(realPathLoose(process.execPath)));
  const executableDirs = [dirname(request.executable), dirname(realPathLoose(request.executable))];
  const keys = keyDirectory();
  const configDir = basename(dirname(keys)) === 'ai-agent-setup' ? [dirname(keys)] : [];
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (ENV_NAMES.has(name) || ENV_PREFIXES.some((prefix) => name.startsWith(prefix)) || request.passEnv?.includes(name)) environment[name] = value;
  }
  environment.HOME = home;
  const workspace = realPathLoose(root);
  return {
    profile: request.profile,
    network: request.network,
    workspace,
    workspaceReadOnly: [join(workspace, '.ai-agent-setup')],
    readable: [PACKAGE_ROOT, runtime, ...executableDirs, ...(request.allowRead ?? [])].map(realPathLoose),
    writable: [...hostState, ...(request.allowWrite ?? [])].map(realPathLoose),
    protected: [keys, ...configDir, ...homes.flatMap((dir) => SENSITIVE_IN_HOME.map((path) => join(dir, path)))].map(realPathLoose),
    confinedRoots: [...homes, tmpdir(), '/private/tmp', '/tmp'].map(realPathLoose),
    environment,
  };
}

/**
 * Resolve → detect → validate → prepare. Throws before anything starts when the requested profile
 * cannot be enforced here (fail closed); never substitutes another profile.
 */
export function prepareIsolatedLaunch(root: string, request: IsolationRequest, args: string[]): PreparedLaunch {
  const policy = buildIsolationPolicy(root, request);
  const provider = providerFor(request.profile);
  const problems = policyProblems(policy, provider.capabilities());
  if (problems.length) throw new Error(`Isolation profile ${request.profile} cannot be enforced, nothing was started: ${problems.join('; ')}`);
  const launch = provider.prepare(policy, request.executable, args);
  if (launch.scratch) {
    const inbox = join(launch.scratch, 'inbox.jsonl');
    writeFileSync(inbox, '');
    launch.env[INBOX_ENV] = inbox;
  }
  return launch;
}

/** Event types an agent may request through the inbox: its own step reports, never approvals or verdicts. */
const INBOX_TYPES: ReadonlySet<string> = new Set(['STEP_STARTED', 'STEP_PROGRESS', 'APPROVAL_REQUIRED', 'STEP_COMPLETED', 'STEP_FAILED', 'STEP_BLOCKED']);

export type InboxEvent = { type: ExecutionEvent['type']; source: 'host'; stepId: string } & Record<string, unknown>;

/**
 * Validates one inbox request from the sandboxed agent. The source is always `host`; fields are
 * copied by name and type only, so a request cannot smuggle gate results or another source.
 */
export function inboxEvent(runId: string, line: string): { event: InboxEvent } | { refused: string } {
  let request: Record<string, unknown>;
  try {
    request = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return { refused: 'not JSON' };
  }
  if (request.runId !== runId) return { refused: `request for another run (${String(request.runId)})` };
  if (typeof request.type !== 'string' || !INBOX_TYPES.has(request.type)) return { refused: `event type ${String(request.type)} cannot be requested by the agent` };
  if (typeof request.stepId !== 'string' || !request.stepId) return { refused: 'missing stepId' };
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const evidence = Array.isArray(request.evidence) ? request.evidence.filter((item): item is string => typeof item === 'string') : [];
  const event: InboxEvent = { type: request.type as ExecutionEvent['type'], source: 'host', stepId: request.stepId };
  if (request.type === 'STEP_PROGRESS') event.message = text(request.message);
  if (request.type === 'APPROVAL_REQUIRED' || request.type === 'STEP_BLOCKED') event.reason = text(request.reason) || 'no reason given';
  if (request.type === 'STEP_FAILED') Object.assign(event, { reason: text(request.reason) || 'no reason given', evidence });
  if (request.type === 'STEP_COMPLETED') Object.assign(event, { gates: [], evidence });
  return { event };
}

/** Most bytes read from the inbox per poll; the agent controls the file, so reads are bounded. */
const INBOX_CHUNK = 1024 * 1024;

/** Reads complete lines of the inbox from `offset` (at most one chunk); returns them and the new offset. */
export function readInbox(file: string, offset: number): { lines: string[]; offset: number } {
  if (!existsSync(file)) return { lines: [], offset };
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(INBOX_CHUNK);
    const read = readSync(fd, buffer, 0, INBOX_CHUNK, offset);
    const chunk = buffer.subarray(0, read);
    const end = chunk.lastIndexOf(0x0a) + 1;
    // A line longer than a chunk can never complete: skip it rather than stall the inbox.
    if (end === 0) return read === INBOX_CHUNK ? { lines: ['<line too long>'], offset: offset + read } : { lines: [], offset };
    return { lines: chunk.subarray(0, end).toString('utf8').split('\n').filter(Boolean), offset: offset + end };
  } finally {
    closeSync(fd);
  }
}

/** Called by `run event` inside an isolated launch: queue the request for the orchestrator. */
export function queueInboxRequest(file: string, request: Record<string, unknown>): void {
  appendFileSync(file, `${JSON.stringify(request)}\n`);
}

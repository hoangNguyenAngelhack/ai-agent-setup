import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Capability, IsolationCapabilities, IsolationControl, IsolationPolicy, PreparedLaunch } from '../core/isolation';
import { realPathLoose } from '../shared/key-location';
import { RUN_MARK_ENV } from './process-tree';
import type { IsolationProvider } from './provider';

/**
 * macOS Seatbelt provider (`/usr/bin/sandbox-exec`, built in, no admin rights). The kernel enforces
 * the profile on the launched process and every process it starts; a nested sandbox can only
 * narrow it. Same OS user: it cannot provide identity separation (profile `isolated`).
 */
export const SANDBOX_EXEC = '/usr/bin/sandbox-exec';

function quote(path: string): string {
  return `"${realPathLoose(path).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const subpaths = (paths: string[]) => paths.map((path) => `(subpath ${quote(path)})`).join(' ');

/** Devices a normal process writes to (null device, terminals, its own file descriptors). */
const DEVICE_WRITES = '(literal "/dev/null") (literal "/dev/zero") (literal "/dev/dtracehelper") (regex #"^/dev/tty") (regex #"^/dev/fd/")';

/**
 * The profile. Seatbelt applies the last matching rule, so the order is: confine, re-open what the
 * launch needs, then close the protected paths and the runtime state again.
 */
export function seatbeltProfile(policy: IsolationPolicy, scratch: string): string {
  const confined = subpaths(policy.confinedRoots);
  const readable = subpaths([policy.workspace, scratch, ...policy.readable, ...policy.writable]);
  const rules = [
    '(version 1)',
    '(allow default)',
    // Filesystem reads: confined roots are closed except what the launch needs.
    confined ? `(deny file-read* ${confined})` : '',
    `(allow file-read* ${readable})`,
    '(allow file-read-metadata)',
    // Filesystem writes: nowhere except the workspace, the scratch area and the host's own state.
    '(deny file-write*)',
    `(allow file-write* ${subpaths([policy.workspace, scratch, ...policy.writable])} ${DEVICE_WRITES})`,
    policy.workspaceReadOnly.length ? `(deny file-write* ${subpaths(policy.workspaceReadOnly)})` : '',
    // Execution: never from confined roots unless re-opened, never from the scratch area.
    confined ? `(deny process-exec* ${confined})` : '',
    `(allow process-exec* ${subpaths([policy.workspace, ...policy.readable])})`,
    `(deny process-exec* ${subpaths([scratch])})`,
    // Protected paths last: no read, write or exec whatever re-opened them.
    policy.protected.length ? `(deny file-read* file-write* process-exec* ${subpaths(policy.protected)})` : '',
    // Signals only within this sandbox: the agent cannot stop or probe the user's processes.
    '(deny signal)',
    '(allow signal (target same-sandbox))',
    '(deny process-info* (target others))',
    // No way out through other processes: launchd already refuses job submission from a sandboxed
    // caller; Apple Events and LaunchServices (`open`) would start work outside the sandbox.
    '(deny appleevent-send)',
    '(deny mach-lookup (global-name "com.apple.coreservices.launchservicesd") (global-name "com.apple.coreservices.quarantine-resolver"))',
    // The clipboard often holds passwords and tokens the user copied.
    '(deny mach-lookup (global-name "com.apple.pasteboard.1"))',
    ...(policy.network.mode === 'deny-all' ? ['(deny network-outbound (remote ip))', '(deny network-inbound)'] : []),
  ];
  return rules.filter(Boolean).join('\n');
}

let probeResult: Capability | null = null;

/** Proves on this machine that a deny rule is enforced, once per process. */
function liveProbe(): Capability {
  if (probeResult) return probeResult;
  if (process.platform !== 'darwin' || !existsSync(SANDBOX_EXEC)) {
    probeResult = { status: 'UNSUPPORTED', reason: `${SANDBOX_EXEC} is not available` };
    return probeResult;
  }
  const dir = mkdtempSync(join(tmpdir(), 'ai-agent-setup-probe-'));
  try {
    const secret = join(dir, 'secret');
    writeFileSync(secret, 'probe');
    const profile = `(version 1)(allow default)(deny file-read* (subpath ${quote(dir)}))`;
    const denied = spawnSync(SANDBOX_EXEC, ['-p', profile, '/bin/cat', secret], { encoding: 'utf8' });
    const control = spawnSync(SANDBOX_EXEC, ['-p', '(version 1)(allow default)', '/bin/cat', secret], { encoding: 'utf8' });
    probeResult =
      denied.status !== 0 && !denied.stdout.includes('probe') && control.status === 0 && control.stdout === 'probe'
        ? { status: 'SUPPORTED', reason: 'a deny rule was enforced by the kernel on this machine' }
        : { status: 'UNSUPPORTED', reason: 'sandbox-exec did not enforce a deny rule on this machine' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return probeResult;
}

export const seatbeltProvider: IsolationProvider = {
  id: 'macos-seatbelt',
  capabilities(): IsolationCapabilities {
    const probe = liveProbe();
    const ok = probe.status === 'SUPPORTED';
    const when = (reason: string): Capability => (ok ? { status: 'SUPPORTED', reason } : probe);
    const controls: Record<IsolationControl, Capability> = {
      'identity-separation': { status: 'UNSUPPORTED', reason: 'the sandbox runs as the same OS user; a separate principal needs profile isolated' },
      'filesystem-read': when('confined roots (home, temporary directories) are closed except the workspace and listed paths'),
      'filesystem-write': when('writes only to the workspace (not its runtime state), the scratch area and listed host state'),
      'secret-isolation': when('protected paths cannot be read; the environment is reduced to an allowlist'),
      'process-exec': when('no execution from confined roots or the scratch area; children inherit the sandbox and cannot widen it'),
      'process-signal': when('signals only to processes in the same sandbox'),
      'network-deny': when('outbound and inbound IP traffic denied by the kernel'),
      'network-allowlist': { status: 'UNSUPPORTED', reason: 'Seatbelt filters by address and port, not by domain name; an allowlist could not be enforced reliably' },
      'approval-boundary': when('the agent cannot write runtime state or read the key; events go through a host-side inbox; approvals need the user terminal'),
    };
    return {
      provider: 'macos-seatbelt',
      platform: 'darwin',
      profiles: {
        none: { status: 'SUPPORTED', reason: 'no isolation' },
        restricted: ok ? { status: 'SUPPORTED', reason: 'kernel-enforced sandbox, same OS user' } : probe,
        isolated: { status: 'UNSUPPORTED', reason: 'needs a separate OS user; Seatbelt keeps the same user' },
      },
      controls,
    };
  },
  prepare(policy, command, args): PreparedLaunch {
    const scratch = realPathLoose(mkdtempSync(join(tmpdir(), 'ai-agent-setup-sandbox-')));
    const profile = seatbeltProfile(policy, scratch);
    const env = { ...policy.environment, TMPDIR: `${scratch}/`, [RUN_MARK_ENV]: randomBytes(16).toString('hex') };
    return {
      requested: policy.profile,
      applied: 'restricted',
      provider: 'macos-seatbelt',
      platform: 'darwin',
      command: SANDBOX_EXEC,
      args: ['-p', profile, command, ...args],
      env,
      scratch,
      enforced: ['filesystem-read', 'filesystem-write', 'secret-isolation', 'process-exec', 'process-signal', 'approval-boundary', ...(policy.network.mode === 'deny-all' ? (['network-deny'] as const) : [])],
      notEnforced: [
        { control: 'identity-separation', reason: 'same OS user (profile isolated needs a separate OS user)' },
        ...(policy.network.mode === 'allow-all' ? [{ control: 'network-deny' as const, reason: 'network allowed by the policy' }] : []),
        { control: 'network-allowlist', reason: 'not available with Seatbelt' },
      ],
      cleanup: () => rmSync(scratch, { recursive: true, force: true }),
    };
  },
};

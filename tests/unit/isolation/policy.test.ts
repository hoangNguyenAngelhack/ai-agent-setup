import { describe, expect, it } from 'vitest';
import { ISOLATION_CONTROLS, policyProblems, type Capability, type IsolationCapabilities, type IsolationControl, type IsolationPolicy } from '../../../src/core/isolation';
import { noneProvider, providerFor, unsupportedProvider } from '../../../src/isolation';
import { allControls } from '../../../src/isolation/provider';
import { platformMatrix } from '../../../src/isolation/registry';
import { seatbeltProfile } from '../../../src/isolation/seatbelt';

const SUPPORTED: Capability = { status: 'SUPPORTED', reason: 'ok' };

function capabilities(overrides: Partial<Record<IsolationControl, Capability>> = {}, isolated: Capability = SUPPORTED): IsolationCapabilities {
  return { provider: 'test', platform: 'test', profiles: { none: SUPPORTED, restricted: SUPPORTED, isolated }, controls: { ...allControls(SUPPORTED), ...overrides } };
}

function policy(overrides: Partial<IsolationPolicy> = {}): IsolationPolicy {
  return {
    profile: 'restricted',
    network: { mode: 'allow-all' },
    workspace: '/zz/work/project',
    workspaceReadOnly: ['/zz/work/project/.ai-agent-setup'],
    readable: ['/zz/runtime'],
    writable: ['/zz/home/u/.codex'],
    protected: ['/zz/home/u/.ssh', '/zz/keys'],
    confinedRoots: ['/zz/home/u', '/zz/tmp'],
    environment: { PATH: '/usr/bin' },
    ...overrides,
  };
}

describe('policyProblems (fail closed, never substitute a profile)', () => {
  it('should accept a policy every required control supports', () => {
    expect(policyProblems(policy(), capabilities())).toEqual([]);
  });

  it('should refuse a profile the provider does not support', () => {
    expect(policyProblems(policy({ profile: 'isolated' }), capabilities({}, { status: 'UNSUPPORTED', reason: 'no OS user' }))).toEqual([expect.stringContaining('profile isolated is UNSUPPORTED') as unknown]);
  });

  it('should refuse when a required control is not enforced', () => {
    expect(policyProblems(policy(), capabilities({ 'process-signal': { status: 'PARTIAL', reason: 'half' } }))).toEqual(['process-signal is PARTIAL: half']);
    expect(policyProblems(policy({ profile: 'isolated' }), capabilities({ 'identity-separation': { status: 'NOT_VERIFIED', reason: 'unknown' } }))).toEqual(['identity-separation is NOT_VERIFIED: unknown']);
  });

  it('should refuse a network policy it cannot enforce', () => {
    const noNetwork = capabilities({ 'network-deny': { status: 'UNSUPPORTED', reason: 'no' }, 'network-allowlist': { status: 'UNSUPPORTED', reason: 'no domains' } });
    expect(policyProblems(policy({ network: { mode: 'deny-all' } }), noNetwork)).toEqual(['network deny-all cannot be enforced: no']);
    expect(policyProblems(policy({ network: { mode: 'allowlist', hosts: ['a.example'] } }), noNetwork)).toEqual(['network allowlist cannot be enforced: no domains']);
    expect(policyProblems(policy({ network: { mode: 'allowlist', hosts: ['a.example'] } }), capabilities())).toEqual([]);
  });

  it('should refuse a network restriction with profile none instead of pretending', () => {
    expect(policyProblems(policy({ profile: 'none', network: { mode: 'deny-all' } }), capabilities())).toEqual([expect.stringContaining('profile none enforces nothing') as unknown]);
  });

  it('should refuse a relative workspace and a workspace inside a protected path', () => {
    expect(policyProblems(policy({ workspace: 'project' }), capabilities())).toEqual(['workspace must be an absolute path']);
    expect(policyProblems(policy({ workspace: 'C:\\work' }), capabilities())).toEqual([]);
    expect(policyProblems(policy({ workspace: '/zz/home/u/.ssh/project' }), capabilities())).toEqual([expect.stringContaining('inside a protected path /zz/home/u/.ssh') as unknown]);
    expect(policyProblems(policy({ workspace: '/zz/keys' }), capabilities())).toHaveLength(1);
  });
});

describe('providers and platform matrix', () => {
  it.each([
    ['linux', 'linux-namespaces'],
    ['win32', 'windows-appcontainer'],
    ['freebsd', 'unknown'],
  ] as const)('should refuse restricted on %s (no provider), never start a plain process', (platform, id) => {
    const provider = providerFor('restricted', platform);
    expect(provider.id).toBe(id);
    expect(provider.capabilities().profiles.restricted.status).toBe('UNSUPPORTED');
    expect(() => provider.prepare(policy(), '/zz/bin/agent', [])).toThrow(/cannot start anything/);
  });

  it('should refuse isolated everywhere until an OS user is set up with permission', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      const caps = providerFor('isolated', platform).capabilities();
      expect(caps.profiles.isolated).toMatchObject({ status: 'UNSUPPORTED', reason: expect.stringContaining('requires your permission') as unknown });
      expect(policyProblems(policy({ profile: 'isolated' }), caps).length).toBeGreaterThan(0);
    }
  });

  it('should claim nothing for profile none and pass the environment unchanged', () => {
    expect(providerFor('none')).toBe(noneProvider);
    expect(Object.values(noneProvider.capabilities().controls).every((capability) => capability.status === 'UNSUPPORTED')).toBe(true);
    const launch = noneProvider.prepare(policy({ profile: 'none' }), '/zz/bin/agent', ['-x']);
    expect(launch).toMatchObject({ applied: 'none', command: '/zz/bin/agent', args: ['-x'], scratch: null, enforced: [] });
    expect(launch.notEnforced).toHaveLength(ISOLATION_CONTROLS.length);
    expect(launch.env.PATH).toBe(process.env.PATH);
    launch.cleanup();
  });

  it('should describe a refused provider with its reason on every control', () => {
    const caps = unsupportedProvider('x', 'plan9', 'because').capabilities();
    expect(caps.controls['filesystem-read']).toEqual({ status: 'UNSUPPORTED', reason: 'because' });
    expect(caps.profiles.none.status).toBe('SUPPORTED');
  });

  it('should report Linux and Windows as UNSUPPORTED and macOS from a live probe only', () => {
    const matrix = platformMatrix();
    expect(matrix.map((row) => row.platform)).toEqual(['macOS', 'Linux', 'Windows']);
    expect(matrix.slice(1).map((row) => row.status)).toEqual(['UNSUPPORTED', 'UNSUPPORTED']);
    expect(['PARTIAL', 'UNSUPPORTED', 'NOT_VERIFIED']).toContain(matrix[0]!.status);
    if (process.platform !== 'darwin') expect(matrix[0]!.status).toBe('NOT_VERIFIED');
  });
});

describe('seatbeltProfile', () => {
  it('should close the protected paths after re-opening the workspace (last rule wins)', () => {
    const profile = seatbeltProfile(policy(), '/zz/scratch');
    const lines = profile.split('\n');
    const reopen = lines.findIndex((line) => line.startsWith('(allow file-read*'));
    const protect = lines.findIndex((line) => line.startsWith('(deny file-read* file-write* process-exec*'));
    expect(reopen).toBeGreaterThan(0);
    expect(protect).toBeGreaterThan(reopen);
    expect(lines[protect]).toContain('"/zz/home/u/.ssh"');
    expect(profile).toContain('(deny file-write* (subpath "/zz/work/project/.ai-agent-setup"))');
    expect(profile).toContain('(deny process-exec* (subpath "/zz/scratch"))');
    expect(profile).toContain('(allow signal (target same-sandbox))');
    expect(profile).toContain('(deny appleevent-send)');
    expect(profile).toContain('com.apple.pasteboard.1');
  });

  it('should deny network traffic only for deny-all', () => {
    expect(seatbeltProfile(policy(), '/zz/scratch')).not.toContain('network-outbound');
    expect(seatbeltProfile(policy({ network: { mode: 'deny-all' } }), '/zz/scratch')).toContain('(deny network-outbound (remote ip))');
  });

  it('should escape quotes and backslashes in paths', () => {
    expect(seatbeltProfile(policy({ workspace: '/zz/work/a"b\\c', confinedRoots: [], protected: [], workspaceReadOnly: [] }), '/zz/scratch')).toContain('(subpath "/zz/work/a\\"b\\\\c")');
  });
});

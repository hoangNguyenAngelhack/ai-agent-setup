import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { inboxEvent, prepareIsolatedLaunch } from '../../src/app/isolation';
import { approveRun, createRun, deliverRun, loadRun, reportRun } from '../../src/app/runs';
import type { NetworkPolicy } from '../../src/core/isolation';
import { SANDBOX_EXEC } from '../../src/isolation/seatbelt';
import { writeTree } from '../helpers/fs-tree';
import { PLAN_ID, projectWithPlan } from '../helpers/run-project';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * W2.2-09 security tests 1–12 against the real macOS kernel sandbox: every attack runs as a real
 * process under `sandbox-exec` with the profile the toolkit generates, and every denial has a
 * control run that shows the same action succeeds without the sandbox (so a denial is the
 * boundary, not a missing file). Fixture secrets are fake and live in temporary directories; the
 * user's real home, keys and credentials are never read.
 */
const PROBE = join(REPO_ROOT, 'tests', 'helpers', 'isolation-probe.cjs');
const CLI = join(REPO_ROOT, 'bin', 'cli.js');
const run = promisify(execFile);
const onMac = process.platform === 'darwin' && existsSync(SANDBOX_EXEC);

interface ProbeResult {
  ok: boolean;
  code: string | null;
  detail: unknown;
}

let workspace: string;
let fakeHome: string;
let outside: string;
let keyFile: string;

async function probeIn(network: NetworkPolicy, action: string, ...args: string[]): Promise<ProbeResult> {
  const launch = prepareIsolatedLaunch(workspace, { profile: 'restricted', network, host: 'codex', executable: process.execPath, home: fakeHome }, [PROBE, action, ...args]);
  try {
    const { stdout } = await run(launch.command, launch.args, { env: launch.env, cwd: workspace });
    return JSON.parse(stdout.trim().split('\n').at(-1)!) as ProbeResult;
  } finally {
    launch.cleanup();
  }
}
const sandboxed = (action: string, ...args: string[]) => probeIn({ mode: 'allow-all' }, action, ...args);

async function unsandboxed(action: string, ...args: string[]): Promise<ProbeResult> {
  const { stdout } = await run(process.execPath, [PROBE, action, ...args], { cwd: workspace });
  return JSON.parse(stdout.trim()) as ProbeResult;
}

const denied = expect.objectContaining({ ok: false }) as unknown;
const allowed = expect.objectContaining({ ok: true }) as unknown;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(check: () => boolean, ms = 10_000): Promise<boolean> {
  for (let waited = 0; waited < ms; waited += 100) {
    if (check()) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return check();
}

describe.runIf(onMac)('runtime isolation: macOS Seatbelt (real kernel sandbox)', () => {
  beforeAll(() => {
    workspace = writeTree({ 'src/app.js': 'console.log("app")', '.ai-agent-setup/runs/r1/events.jsonl': '{"type":"RUN_STARTED"}\n', '.ai-agent-setup/integrity.json': '{}' }, 'iso-workspace-');
    fakeHome = writeTree({ '.ssh/id_rsa': 'FAKE-SSH-PRIVATE-KEY', '.aws/credentials': '[default]\naws_secret_access_key=FAKE', '.config/gcloud/credentials.db': 'FAKE', 'notes.txt': 'private notes' }, 'iso-home-');
    outside = writeTree({ 'secret.txt': 'another project' }, 'iso-outside-');
    keyFile = join(process.env.AI_AGENT_SETUP_KEY_DIR!, 'isolation-test.key');
    writeFileSync(keyFile, 'FAKE-HMAC-KEY');
  });

  it('1. should deny reading the integrity (HMAC) key directory', async () => {
    expect(await unsandboxed('read', keyFile)).toEqual(allowed);
    expect(await sandboxed('read', keyFile)).toEqual(denied);
    expect(await sandboxed('list', process.env.AI_AGENT_SETUP_KEY_DIR!)).toEqual(denied);
  });

  it('2. should deny reading an SSH key in the home directory', async () => {
    expect(await unsandboxed('read', join(fakeHome, '.ssh', 'id_rsa'))).toEqual(allowed);
    expect(await sandboxed('read', join(fakeHome, '.ssh', 'id_rsa'))).toEqual(denied);
  });

  it('3. should deny reading cloud credentials', async () => {
    for (const file of [join(fakeHome, '.aws', 'credentials'), join(fakeHome, '.config', 'gcloud', 'credentials.db')]) {
      expect(await unsandboxed('read', file)).toEqual(allowed);
      expect(await sandboxed('read', file)).toEqual(denied);
    }
  });

  it('4. should deny reading outside the workspace, and allow reading inside it', async () => {
    expect(await sandboxed('read', join(workspace, 'src', 'app.js'))).toEqual(allowed);
    for (const file of [join(outside, 'secret.txt'), join(fakeHome, 'notes.txt')]) {
      expect(await unsandboxed('read', file)).toEqual(allowed);
      expect(await sandboxed('read', file)).toEqual(denied);
    }
    expect(await sandboxed('list', fakeHome)).toEqual(denied);
  });

  it('5. should deny writing outside the workspace, and allow writing inside it', async () => {
    expect(await sandboxed('write', join(workspace, 'src', 'new.js'))).toEqual(allowed);
    for (const file of [join(outside, 'planted.txt'), join(fakeHome, '.zshrc')]) {
      expect(await sandboxed('write', file)).toEqual(denied);
      expect(existsSync(file)).toBe(false);
    }
  });

  it('6. should deny running a program the agent dropped in the temporary area', async () => {
    expect(await sandboxed('exec-scratch')).toEqual(denied);
  });

  it('7. should keep children inside the sandbox and refuse a nested, wider sandbox', async () => {
    const key = join(fakeHome, '.ssh', 'id_rsa');
    expect(await sandboxed('child-read', join(workspace, 'src', 'app.js'))).toEqual(allowed);
    expect(await sandboxed('child-read', key)).toEqual(denied);
    expect(await sandboxed('nested-sandbox', key)).toEqual(denied);
  });

  describe('8. network', () => {
    let server: Server;
    let port: number;
    beforeAll(async () => {
      server = createServer((socket) => socket.end());
      await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
      port = (server.address() as { port: number }).port;
    });
    afterAll(() => server.close());

    it('should deny outbound connections under deny-all, and allow them under allow-all', async () => {
      expect(await probeIn({ mode: 'allow-all' }, 'connect', String(port))).toEqual(allowed);
      expect(await probeIn({ mode: 'deny-all' }, 'connect', String(port))).toEqual(denied);
    });

    it('should refuse a domain allowlist it cannot enforce, before anything starts', () => {
      expect(() => prepareIsolatedLaunch(workspace, { profile: 'restricted', network: { mode: 'allowlist', hosts: ['api.anthropic.com'] }, host: 'codex', executable: process.execPath }, [PROBE, 'env'])).toThrow(/cannot be enforced, nothing was started: network allowlist/);
    });
  });

  it('9. should refuse an approval or a verdict requested by the agent', () => {
    expect(inboxEvent('r1', JSON.stringify({ runId: 'r1', type: 'APPROVAL_RESOLVED', stepId: 's1', approved: true }))).toEqual({ refused: expect.stringContaining('APPROVAL_RESOLVED') as unknown });
    expect(inboxEvent('r1', JSON.stringify({ runId: 'r1', type: 'RUN_COMPLETED', stepId: 's1' }))).toEqual({ refused: expect.stringContaining('RUN_COMPLETED') as unknown });
    expect(inboxEvent('r1', JSON.stringify({ runId: 'r1', type: 'STEP_COMPLETED', stepId: 's1', source: 'user', gates: [{ id: 'gate.build', status: 'PASS' }] }))).toEqual({ event: { type: 'STEP_COMPLETED', source: 'host', stepId: 's1', gates: [], evidence: [] } });
  });

  it('10. should deny tampering with runtime state and evidence, and allow reading it', async () => {
    const events = join(workspace, '.ai-agent-setup', 'runs', 'r1', 'events.jsonl');
    expect(await sandboxed('read', events)).toEqual(allowed);
    for (const file of [events, join(workspace, '.ai-agent-setup', 'integrity.json'), join(workspace, '.ai-agent-setup', 'gates.json')]) {
      expect(await sandboxed('append', file)).toEqual(denied);
    }
    expect(readFileSync(events, 'utf8')).toBe('{"type":"RUN_STARTED"}\n');
  });

  describe('11. host processes', () => {
    let victim: ChildProcess;
    beforeAll(() => {
      victim = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
    });
    afterAll(() => victim.kill('SIGKILL'));

    it('should deny signalling or probing a process of the user outside the sandbox', async () => {
      expect(await unsandboxed('info', String(victim.pid))).toEqual(allowed);
      expect(await sandboxed('signal', String(victim.pid))).toEqual(denied);
      expect(await sandboxed('info', String(victim.pid))).toEqual(denied);
      expect(alive(victim.pid!)).toBe(true);
    });
  });

  it('should pass only allowlisted environment variables (no tokens, no key location)', async () => {
    process.env.GITHUB_TOKEN = 'fake-token-for-test'; // secret-scan:allow synthetic fixture
    process.env.AWS_SECRET_ACCESS_KEY = 'fake-for-test'; // secret-scan:allow synthetic fixture
    try {
      const { detail } = await sandboxed('env');
      expect(detail).toEqual(expect.arrayContaining(['PATH', 'HOME', 'TMPDIR', 'AI_AGENT_SETUP_EVENT_INBOX']));
      expect(detail).not.toEqual(expect.arrayContaining(['GITHUB_TOKEN']));
      expect(detail).not.toEqual(expect.arrayContaining(['AWS_SECRET_ACCESS_KEY']));
      expect(detail).not.toEqual(expect.arrayContaining(['AI_AGENT_SETUP_KEY_DIR']));
    } finally {
      delete process.env.GITHUB_TOKEN;
      delete process.env.AWS_SECRET_ACCESS_KEY;
    }
  });

  it('should refuse profile isolated (no separate OS user) instead of running with less', () => {
    expect(() => prepareIsolatedLaunch(workspace, { profile: 'isolated', network: { mode: 'allow-all' }, host: 'codex', executable: process.execPath }, [PROBE, 'env'])).toThrow(/isolated cannot be enforced, nothing was started/);
  });
});

/** Tests 9 and 12 through the real delivery lifecycle: fake host → sandbox → inbox → signed events. */
describe.runIf(onMac)('runtime isolation: delivery lifecycle under restricted', () => {
  const originalPath = process.env.PATH;
  let pidFile: string;

  beforeAll(() => {
    const bin = writeTree({}, 'iso-bin-');
    for (const name of ['codex', 'claude']) {
      copyFileSync(join(REPO_ROOT, 'tests', 'helpers', 'fake-host.cjs'), join(bin, name));
      chmodSync(join(bin, name), 0o755);
    }
    process.env.PATH = `${bin}${delimiter}${originalPath}`;
  });
  afterEach(() => {
    delete process.env.FAKE_HOST_MODE;
    delete process.env.FAKE_HOST_HANG;
    delete process.env.FAKE_HOST_PID_FILE;
  });
  afterAll(() => {
    process.env.PATH = originalPath;
  });

  function approved(): { root: string; runId: string } {
    const root = projectWithPlan();
    const draft = createRun(root, PLAN_ID);
    approveRun(root, draft.runId, 'user');
    pidFile = join(root, 'left-behind.pid');
    return { root, runId: draft.runId };
  }

  function deliver(root: string, runId: string, mode: string, extra: { timeoutMs?: number; signal?: AbortSignal; hang?: boolean } = {}) {
    process.env.FAKE_HOST_MODE = mode;
    process.env.FAKE_HOST_PID_FILE = pidFile;
    if (extra.hang) process.env.FAKE_HOST_HANG = '1';
    return deliverRun(root, runId, 'codex', {
      eventCommand: `"${process.execPath}" "${CLI}" run event ${runId}`,
      ...(extra.timeoutMs ? { timeoutMs: extra.timeoutMs } : {}),
      ...(extra.signal ? { signal: extra.signal } : {}),
      isolation: { profile: 'restricted', network: { mode: 'deny-all' }, passEnv: ['FAKE_HOST_MODE', 'FAKE_HOST_HANG', 'FAKE_HOST_PID_FILE', 'FAKE_HOST_ESCAPE'] },
    });
  }

  it('should run a plan with step events signed by the orchestrator and a signed isolation report', async () => {
    const { root, runId } = approved();
    const delivery = await deliver(root, runId, 'success');

    expect(delivery).toMatchObject({ status: 'DELIVERED', isolation: { requested: 'restricted', applied: 'restricted', provider: 'macos-seatbelt', network: 'deny-all', refused: [] } });
    expect(delivery.isolation!.notEnforced.map((item) => item.control)).toContain('identity-separation');
    const { state } = loadRun(root, runId);
    // Each step reported done by the agent, through the inbox, signed by the orchestrator; not verified yet.
    expect(Object.values(state.steps).map((step) => step.state)).toEqual(['NOT_VERIFIED', 'NOT_VERIFIED']);
    expect(reportRun(root, runId).result).toMatchObject({ run: 'HOST_COMPLETED', integrity: { status: 'VERIFIED' } });
    expect(JSON.parse(readFileSync(join(root, delivery.isolation!.report), 'utf8'))).not.toHaveProperty('environment.GITHUB_TOKEN');
  }, 60_000);

  it('9. should keep the approval pending when the agent forges one, and deny its direct write', async () => {
    const { root, runId } = approved();
    const delivery = await deliver(root, runId, 'forge');
    const first = loadRun(root, runId).plan.steps[0]!.id;

    expect(loadRun(root, runId).state.steps[first]).toMatchObject({ pendingApproval: expect.objectContaining({ reason: 'needs a database migration' }) as unknown });
    expect(readFileSync(join(root, delivery.transcript!), 'utf8')).toContain('direct write: EPERM');
    expect(readFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), 'utf8')).not.toContain('APPROVAL_RESOLVED');
    expect(reportRun(root, runId).result).toMatchObject({ integrity: { status: 'VERIFIED' } });
  }, 60_000);

  it('12. should leave no process behind after the host finishes normally', async () => {
    const { root, runId } = approved();
    await deliver(root, runId, 'leave-behind');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    expect(await waitFor(() => !alive(pid))).toBe(true);
  }, 60_000);

  it('12. should leave no process behind after a timeout', async () => {
    const { root, runId } = approved();
    expect(await deliver(root, runId, 'leave-behind', { hang: true, timeoutMs: 2000 })).toMatchObject({ status: 'NOT_VERIFIED' });
    const pid = Number(readFileSync(pidFile, 'utf8'));
    expect(await waitFor(() => !alive(pid))).toBe(true);
  }, 60_000);

  it('12. should leave no process behind after a cancellation', async () => {
    const { root, runId } = approved();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    expect(await deliver(root, runId, 'leave-behind', { hang: true, signal: controller.signal })).toMatchObject({ status: 'CANCELLED' });
    const pid = Number(readFileSync(pidFile, 'utf8'));
    expect(await waitFor(() => !alive(pid))).toBe(true);
  }, 60_000);

  it('12. should leave no process behind after Ctrl-C in run deliver', async () => {
    const { root, runId } = approved();
    const child = spawn(process.execPath, [CLI, 'run', 'deliver', runId, '--host', 'codex', '--isolation', 'restricted', '--pass-env', 'FAKE_HOST_MODE,FAKE_HOST_HANG,FAKE_HOST_PID_FILE', '--event-command', `"${process.execPath}" "${CLI}" run event ${runId}`], {
      cwd: root,
      env: { ...process.env, FAKE_HOST_MODE: 'leave-behind', FAKE_HOST_HANG: '1', FAKE_HOST_PID_FILE: pidFile },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(await waitFor(() => existsSync(pidFile) && readFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), 'utf8').includes('STEP_STARTED'), 20_000)).toBe(true);
    child.kill('SIGINT');
    expect(await new Promise<number | null>((resolveExit) => child.on('close', resolveExit))).toBe(2);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    expect(await waitFor(() => !alive(pid))).toBe(true);
  }, 60_000);

  it('12. known gap: a double fork that drops its environment can outlive the run, but stays inside the sandbox', async () => {
    const { root, runId } = approved();
    const key = join(process.env.AI_AGENT_SETUP_KEY_DIR!, 'isolation-gap.key');
    writeFileSync(key, 'FAKE-HMAC-KEY');
    process.env.FAKE_HOST_ESCAPE = key;
    try {
      await deliver(root, runId, 'leave-behind');
      // Without a pid file the survivor never started: the tree was stopped first (the good case).
      if (!(await waitFor(() => existsSync(pidFile), 3000))) return;
      const pid = Number(readFileSync(pidFile, 'utf8'));
      // Recorded as FAIL for test 12b in docs/v2/12 (ADR-017): when it escapes tracking, it must stay confined.
      if (alive(pid)) {
        expect(await waitFor(() => existsSync(`${pidFile}.read`))).toBe(true);
        expect(readFileSync(`${pidFile}.read`, 'utf8')).toBe('EPERM');
        process.kill(pid, 'SIGKILL');
      }
    } finally {
      delete process.env.FAKE_HOST_ESCAPE;
    }
  }, 60_000);

  it('should refuse isolated before the host starts, with no run event written', async () => {
    const { root, runId } = approved();
    const before = readFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), 'utf8');
    process.env.FAKE_HOST_MODE = 'success';
    await expect(deliverRun(root, runId, 'codex', { isolation: { profile: 'isolated' } })).rejects.toThrow(/nothing was started/);
    expect(readFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), 'utf8')).toBe(before);
  });
});

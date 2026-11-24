import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIsolationPolicy, inboxEvent, prepareIsolatedLaunch, queueInboxRequest, readInbox, resolveExecutable } from '../../../src/app/isolation';
import { ProcessTree, RUN_MARK_ENV } from '../../../src/isolation';
import { keyDirectory } from '../../../src/shared/key-location';
import { writeTree } from '../../helpers/fs-tree';

describe('inboxEvent (what a sandboxed agent may ask the orchestrator to sign)', () => {
  const line = (request: Record<string, unknown>) => JSON.stringify({ runId: 'r1', stepId: 's1', ...request });

  it('should refuse malformed requests and requests for another run', () => {
    expect(inboxEvent('r1', 'not json')).toEqual({ refused: 'not JSON' });
    expect(inboxEvent('r1', line({ runId: 'r2', type: 'STEP_STARTED' }))).toEqual({ refused: 'request for another run (r2)' });
    expect(inboxEvent('r1', line({ type: 'STEP_STARTED', stepId: '' }))).toEqual({ refused: 'missing stepId' });
    expect(inboxEvent('r1', line({ type: 42 }))).toEqual({ refused: 'event type 42 cannot be requested by the agent' });
  });

  it.each(['APPROVAL_RESOLVED', 'RUN_COMPLETED', 'RUN_FAILED', 'RUN_CANCELLED', 'STEP_VERIFIED', 'RUN_STARTED'])('should refuse %s from the agent', (type) => {
    expect(inboxEvent('r1', line({ type }))).toEqual({ refused: `event type ${type} cannot be requested by the agent` });
  });

  it('should copy only the fields of each step report, always with source host', () => {
    expect(inboxEvent('r1', line({ type: 'STEP_STARTED', source: 'user', by: 'user' }))).toEqual({ event: { type: 'STEP_STARTED', source: 'host', stepId: 's1' } });
    expect(inboxEvent('r1', line({ type: 'STEP_PROGRESS', message: 'half way' }))).toEqual({ event: { type: 'STEP_PROGRESS', source: 'host', stepId: 's1', message: 'half way' } });
    expect(inboxEvent('r1', line({ type: 'APPROVAL_REQUIRED' }))).toEqual({ event: { type: 'APPROVAL_REQUIRED', source: 'host', stepId: 's1', reason: 'no reason given' } });
    expect(inboxEvent('r1', line({ type: 'STEP_BLOCKED', reason: 'waiting' }))).toEqual({ event: { type: 'STEP_BLOCKED', source: 'host', stepId: 's1', reason: 'waiting' } });
    expect(inboxEvent('r1', line({ type: 'STEP_FAILED', reason: 7, evidence: ['a.md', 3] }))).toEqual({ event: { type: 'STEP_FAILED', source: 'host', stepId: 's1', reason: 'no reason given', evidence: ['a.md'] } });
    expect(inboxEvent('r1', line({ type: 'STEP_COMPLETED', evidence: 'x', gates: [{ id: 'gate.build', status: 'PASS' }] }))).toEqual({ event: { type: 'STEP_COMPLETED', source: 'host', stepId: 's1', gates: [], evidence: [] } });
  });
});

describe('inbox file', () => {
  it('should read complete lines only, from the last offset', () => {
    const file = join(writeTree({}), 'inbox.jsonl');
    expect(readInbox(file, 0)).toEqual({ lines: [], offset: 0 });
    queueInboxRequest(file, { a: 1 });
    writeFileSync(file, '{"b":', { flag: 'a' });
    const first = readInbox(file, 0);
    expect(first.lines).toEqual(['{"a":1}']);
    expect(readInbox(file, first.offset)).toEqual({ lines: [], offset: first.offset });
    writeFileSync(file, '2}\n', { flag: 'a' });
    expect(readInbox(file, first.offset).lines).toEqual(['{"b":2}']);
  });

  it('should read at most one chunk per call and skip a line that never ends', () => {
    const file = join(writeTree({}), 'inbox.jsonl');
    writeFileSync(file, 'x'.repeat(1024 * 1024 + 10));
    const skipped = readInbox(file, 0);
    expect(skipped).toEqual({ lines: ['<line too long>'], offset: 1024 * 1024 });
    expect(readInbox(file, skipped.offset)).toEqual({ lines: [], offset: skipped.offset });
  });
});

describe('buildIsolationPolicy', () => {
  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.FAKE_EXTRA;
  });

  it('should protect the key directory and credentials, and pass only allowlisted variables', () => {
    process.env.GITHUB_TOKEN = 'fake'; // secret-scan:allow synthetic fixture
    process.env.ANTHROPIC_API_KEY = 'fake'; // secret-scan:allow synthetic fixture
    process.env.FAKE_EXTRA = 'x';
    const root = writeTree({ 'a.txt': 'a' });
    const home = writeTree({});
    const policy = buildIsolationPolicy(root, { profile: 'restricted', network: { mode: 'deny-all' }, host: 'claude-code', executable: process.execPath, home, passEnv: ['FAKE_EXTRA'], allowRead: [home], allowWrite: [join(home, 'out')] });

    expect(policy.environment).toMatchObject({ HOME: home, ANTHROPIC_API_KEY: 'fake', FAKE_EXTRA: 'x' });
    expect(policy.environment).not.toHaveProperty('GITHUB_TOKEN');
    expect(policy.environment).not.toHaveProperty('AI_AGENT_SETUP_KEY_DIR');
    expect(policy.protected).toEqual(expect.arrayContaining([expect.stringContaining('ai-agent-setup-keys-') as unknown, expect.stringMatching(/\.ssh$/) as unknown, expect.stringMatching(/\.aws$/) as unknown]));
    expect(policy.workspaceReadOnly[0]).toMatch(/\.ai-agent-setup$/);
    expect(policy.writable.some((path) => path.endsWith('.claude'))).toBe(true);
    expect(keyDirectory()).toBe(process.env.AI_AGENT_SETUP_KEY_DIR);
  });

  it('should refuse to prepare a profile that cannot be enforced, before anything starts', () => {
    expect(() => prepareIsolatedLaunch(writeTree({}), { profile: 'isolated', network: { mode: 'allow-all' }, host: 'codex', executable: process.execPath }, [])).toThrow(/nothing was started/);
  });

  it('should resolve executables on PATH', () => {
    expect(resolveExecutable('node')).toBeTruthy();
    expect(resolveExecutable('definitely-not-a-command-xyz')).toBeNull();
  });
});

describe.skipIf(process.platform === 'win32')('ProcessTree (host-side process tracking)', () => {
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const waitFor = async (check: () => boolean) => {
    for (let tries = 0; tries < 100 && !check(); tries += 1) await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    return check();
  };

  it('should stop descendants that left the process group', async () => {
    const pidFile = join(writeTree({}), 'pid');
    const code = `const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000);`;
    const parent = spawn(process.execPath, ['-e', code], { stdio: 'ignore', detached: true });
    expect(await waitFor(() => existsSync(pidFile) && readFileSync(pidFile, 'utf8') !== '')).toBe(true);
    const tree = new ProcessTree(parent.pid!);
    expect(tree.scan()).toBe(2);
    tree.stop();
    const grandchild = Number(readFileSync(pidFile, 'utf8'));
    expect(await waitFor(() => !alive(grandchild) && !alive(parent.pid!))).toBe(true);
    expect(tree.alive()).toEqual([]);
  });

  it('should find an orphan by its run mark on stop', async () => {
    const mark = 'a'.repeat(32);
    const orphan = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore', detached: true, env: { ...process.env, [RUN_MARK_ENV]: mark } });
    const tree = new ProcessTree(999_999_999, mark);
    tree.stop();
    expect(await waitFor(() => !alive(orphan.pid!))).toBe(true);
  });
});

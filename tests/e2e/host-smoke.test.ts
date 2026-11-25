import { chmodSync, copyFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSmokeArgs, runHostSmoke } from '../../src/app/host-smoke';
import { writeTree } from '../helpers/fs-tree';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * The real-host smoke command (`npm run smoke:host`), checked against the fake host only: this proves
 * the command's own logic, never that a real CLI passes.
 */
const originalPath = process.env.PATH;

describe.skipIf(process.platform === 'win32')('host smoke command (fake host)', () => {
  beforeEach(() => {
    const bin = writeTree({});
    for (const name of ['codex', 'claude']) {
      copyFileSync(join(REPO_ROOT, 'tests', 'helpers', 'fake-host.cjs'), join(bin, name));
      chmodSync(join(bin, name), 0o755);
    }
    process.env.PATH = `${bin}${delimiter}${originalPath}`;
  });
  afterEach(() => {
    process.env.PATH = originalPath;
    delete process.env.FAKE_HOST_MODE;
  });

  it.each(['codex', 'claude-code'] as const)('should pass %s only when step events reach a verified, unsucceeded run', async (host) => {
    process.env.FAKE_HOST_MODE = 'success';
    const report = await runHostSmoke({ host, timeoutMs: 30000, base: writeTree({}) });

    expect(report.checks.filter((check) => check.status === 'FAIL')).toEqual([]);
    expect(report).toMatchObject({ verdict: 'PASS', delivery: { status: 'DELIVERED' }, result: { integrity: 'VERIFIED', status: 'NOT_VERIFIED' } });
    expect(report.events).toEqual(expect.arrayContaining([expect.stringMatching(/^STEP_STARTED /) as unknown]));
  }, 60000);

  it('should not pass a host that says nothing', async () => {
    process.env.FAKE_HOST_MODE = 'silent';
    const report = await runHostSmoke({ host: 'codex', timeoutMs: 30000, base: writeTree({}) });

    expect(report.verdict).toBe('NOT_VERIFIED');
    expect(report.checks.find((check) => check.name === 'step-events')?.status).toBe('FAIL');
  }, 60000);

  it('should fail a host that delivers without reporting any step', async () => {
    process.env.FAKE_HOST_MODE = 'leak';
    const report = await runHostSmoke({ host: 'codex', timeoutMs: 30000, base: writeTree({}) });

    expect(report).toMatchObject({ verdict: 'FAIL', delivery: { status: 'DELIVERED' } });
  }, 60000);
});

describe('host smoke arguments', () => {
  it('should read the host, timeout, model and isolation, and refuse anything else', () => {
    expect(parseSmokeArgs(['--host', 'codex'])).toEqual({ host: 'codex', timeoutMs: 600000 });
    expect(parseSmokeArgs(['--host', 'claude-code', '--model', 'haiku', '--timeout', '30', '--isolation', 'restricted', '--network', 'deny'])).toEqual({
      host: 'claude-code',
      timeoutMs: 30000,
      model: 'haiku',
      isolation: { profile: 'restricted', network: { mode: 'deny-all' } },
    });
    expect(() => parseSmokeArgs([])).toThrow(/--host/);
    expect(() => parseSmokeArgs(['--host', 'codex', '--timeout', '0'])).toThrow(/--timeout/);
    expect(() => parseSmokeArgs(['--host', 'codex', '--isolation', 'isolated'])).toThrow(/--isolation/);
  });
});

import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECK_ROOMS, judge, snapshotTree } from '../../src/app/benchmark/oracle';
import { loadSuite } from '../../src/app/benchmark/tasks';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * Finding 4b of docs/v2/15: code under test must not be able to end, skip, change or read the hidden
 * checks that judge it. Each case is an attack an agent could write into its own code; the oracle
 * must still reject the unfixed behaviour. Run with the real suite (se-01, IDOR).
 */
const SUITE = join(REPO_ROOT, 'benchmarks', 'suite');
const task = loadSuite(SUITE).find((item) => item.id === 'se-01-idor')!;
const sandboxed = process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec');

/** The untouched fixture (the IDOR is still there) with `attack` appended to src/app.js. */
function attacked(attack: string): { workspace: string; before: ReturnType<typeof snapshotTree> } {
  const workspace = mkdtempSync(join(tmpdir(), 'attack-'));
  cpSync(join(SUITE, task.fixture), workspace, { recursive: true });
  const before = snapshotTree(workspace);
  appendFileSync(join(workspace, 'src', 'app.js'), `\n${attack}\n`);
  return { workspace, before };
}

describe.skipIf(process.platform === 'win32')('hidden checks against code under test (finding 4b)', () => {
  it('should reject code that ends its process as soon as it is loaded', () => {
    const { workspace, before } = attacked('process.exit(0);');
    expect(judge(task, SUITE, workspace, before)).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' } });
  }, 60000);

  it('should reject code that detects the checker and exits 0', () => {
    const attack = "const caller = [require.main && require.main.filename, ...process.argv, process.cwd()].join(' ');\nif (/bench|hidden|check|subject/i.test(caller)) process.exit(0);";
    const { workspace, before } = attacked(attack);
    expect(judge(task, SUITE, workspace, before)).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' } });
  }, 60000);

  it('should reject code that patches built-ins and the assert module', () => {
    const attack = [
      "const assert = require('node:assert');",
      'for (const name of Object.keys(assert)) assert[name] = () => {};',
      'Array.prototype.every = () => true;',
      "process.on('uncaughtException', () => process.exit(0));",
    ].join('\n');
    const { workspace, before } = attacked(attack);
    expect(judge(task, SUITE, workspace, before)).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' } });
  }, 60000);

  it.runIf(sandboxed)('should keep every trial\'s checks unlistable, unreadable and unwritable while the code under test runs (macOS Seatbelt)', () => {
    // A check file that exists while the code under test runs: the attack knows its exact path.
    mkdirSync(CHECK_ROOMS, { recursive: true });
    const decoy = join(mkdtempSync(join(CHECK_ROOMS, 'room-')), 'check.cjs');
    writeFileSync(decoy, 'module.exports = "expected values";');
    const report = join(mkdtempSync(join(tmpdir(), 'attack-report-')), 'seen.json');
    const attack = `
const fs = require('node:fs');
const seen = {};
try { fs.readdirSync(${JSON.stringify(CHECK_ROOMS)}); seen.list = 'listed'; } catch (error) { seen.list = error.code; }
try { fs.readFileSync(${JSON.stringify(decoy)}, 'utf8'); seen.read = 'read'; } catch (error) { seen.read = error.code; }
try { fs.writeFileSync(${JSON.stringify(decoy)}, 'process.exit(0)'); seen.write = 'written'; } catch (error) { seen.write = error.code; }
fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify(seen));`;
    const { workspace, before } = attacked(attack);
    const result = judge(task, SUITE, workspace, before);
    const seen = JSON.parse(readFileSync(report, 'utf8')) as Record<string, string>;
    rmSync(dirname(decoy), { recursive: true, force: true });

    expect(result.verdict).toBe('REJECTED');
    expect(seen).toEqual({ list: 'EPERM', read: 'EPERM', write: 'EPERM' });
  }, 60000);

  it('should not let the fixed code pass the regression guard by ending the test process early', () => {
    // The reference solution, plus an exit when the fixture's own tests load it: the hidden check
    // still passes (it runs through the subject runtime, not node --test), so only the guard can catch it.
    const workspace = mkdtempSync(join(tmpdir(), 'attack-'));
    cpSync(join(SUITE, task.fixture), workspace, { recursive: true });
    const before = snapshotTree(workspace);
    cpSync(join(SUITE, 'solutions', task.id), workspace, { recursive: true });
    appendFileSync(join(workspace, 'src', 'app.js'), "\nif (process.argv.some((arg) => arg.includes('app.test'))) process.exit(0);\n");
    const result = judge(task, SUITE, workspace, before);

    expect(result).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' } });
    expect(result.hiddenTests.detail).toMatch(/existing tests fail: node --test: \d+ passed, \d+ failed \(untouched fixture: 2 passed\)/);
  }, 60000);
});

describe.skipIf(process.platform === 'win32')('security regression checks (finding 7)', () => {
  const tasks = loadSuite(SUITE);
  const solved = (id: string) => {
    const item = tasks.find((candidate) => candidate.id === id)!;
    const workspace = mkdtempSync(join(tmpdir(), 'insecure-'));
    cpSync(join(SUITE, item.fixture), workspace, { recursive: true });
    const before = snapshotTree(workspace);
    cpSync(join(SUITE, 'solutions', id), workspace, { recursive: true });
    return { item, workspace, before };
  };

  it('should reject a solved task that opens an order endpoint to callers without a token', () => {
    const { item, workspace, before } = solved('be-01-pagination');
    appendFileSync(join(workspace, 'src', 'auth.js'), "\nconst original = module.exports.authenticate;\nif (original) module.exports.authenticate = (headers) => original(headers) || { id: 2, name: 'Bob' };\n");
    const result = judge(item, SUITE, workspace, before);

    expect(result).toMatchObject({ verdict: 'REJECTED', security: { status: 'FAIL' } });
    expect(result.security.findings.join('\n')).toMatch(/auth-required/);
  }, 60000);

  it('should reject a solved task that adds code evaluation', () => {
    const { item, workspace, before } = solved('bu-03-chunk');
    appendFileSync(join(workspace, 'src', 'chunk.js'), "\nmodule.exports.run = (code) => eval(code);\n");
    expect(judge(item, SUITE, workspace, before)).toMatchObject({ verdict: 'REJECTED', security: { status: 'FAIL', findings: ['js-dangerous-calls: exit 1'] } });
  }, 60000);

  it.runIf(spawnSync('python3', ['--version']).status === 0)('should reject a solved Python task that adds a shell command', () => {
    const { item, workspace, before } = solved('da-03-monthly-revenue');
    appendFileSync(join(workspace, 'etl', 'aggregate.py'), "\nimport subprocess\n");
    expect(judge(item, SUITE, workspace, before)).toMatchObject({ verdict: 'REJECTED', security: { status: 'FAIL', findings: ['py-dangerous-calls: exit 1'] } });
  }, 60000);
});

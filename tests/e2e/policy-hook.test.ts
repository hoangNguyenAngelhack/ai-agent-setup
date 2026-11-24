import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPolicyHookAssets } from '../../src/app/policy-hook-assets';
import { validateCatalog } from '../../src/registry';
import { REPO_ROOT } from '../helpers/v1-cli';

type HookOutput = { hookSpecificOutput: { permissionDecision: string } };

/**
 * Runs the generated policy hook as a real process, exactly as a host would: JSON on stdin,
 * decision on stdout / exit code (fixes TD-03: the V1 hooks never received their input).
 */
let hookDir: string;

beforeAll(() => {
  const project = mkdtempSync(join(tmpdir(), 'policy-hook-'));
  // An ESM project: the hook must still run because its files are .cjs.
  writeFileSync(join(project, 'package.json'), JSON.stringify({ type: 'module' }));
  hookDir = join(project, '.claude', 'hooks', 'ai-agent-setup');
  const { files } = loadPolicyHookAssets(join(REPO_ROOT, 'dist'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(hookDir, path)), { recursive: true });
    writeFileSync(join(hookDir, path), content);
  }
  writeFileSync(join(hookDir, 'policies.json'), JSON.stringify(validateCatalog(join(REPO_ROOT, 'catalog')).policies));
});

function runHook(host: 'claude-code' | 'codex', input: unknown) {
  return spawnSync(process.execPath, [join(hookDir, 'policy-check.cjs'), '--host', host], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
}

describe('generated policy hook (end to end)', () => {
  it('should ask Claude Code for approval before rm -rf', () => {
    const result = runHook('claude-code', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf build' } });

    expect(result.status).toBe(0);
    expect((JSON.parse(result.stdout) as HookOutput).hookSpecificOutput).toMatchObject({ permissionDecision: 'ask' });
  });

  it('should deny writing an AWS access key', () => {
    const content = `key = "${'AKIA'}${'QWERTYUIOPASDFGH'}"`;

    const result = runHook('claude-code', { tool_name: 'Write', tool_input: { file_path: 'a.py', content } });

    expect((JSON.parse(result.stdout) as HookOutput).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('should stay silent for harmless commands', () => {
    const result = runHook('claude-code', { tool_name: 'Bash', tool_input: { command: 'npm test' } });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('should block on Codex with exit code 2 for a force push inside bash -lc', () => {
    const result = runHook('codex', { tool_name: 'Bash', tool_input: { command: "bash -lc 'git push --force origin x'" } });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('safety.no-destructive-unapproved');
  });

  it('should deny a Codex patch that adds a private key', () => {
    const patch = `*** Begin Patch\n*** Add File: id_rsa\n+-----BEGIN ${'RSA'} PRIVATE KEY-----\n*** End Patch`;

    const result = runHook('codex', { tool_name: 'apply_patch', tool_input: { command: patch } });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('safety.no-secret-write');
  });

  it('should fail open with a visible error on malformed input', () => {
    const result = spawnSync(process.execPath, [join(hookDir, 'policy-check.cjs')], { input: 'not json', encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ai-agent-setup policy hook error');
  });

  it('should deny Claude Code writes to runtime state, given as an absolute path', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'runtime-'));
    const result = runHook('claude-code', { cwd, tool_name: 'Write', tool_input: { file_path: join(cwd, '.ai-agent-setup', 'runs', 'r', 'events.jsonl'), content: '{}' } });

    expect((JSON.parse(result.stdout) as HookOutput).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('should block a Codex patch that edits the gate configuration', () => {
    const patch = '*** Begin Patch\n*** Update File: .ai-agent-setup/gates.json\n@@\n-{}\n+{"gates":{}}\n*** End Patch';
    const result = runHook('codex', { cwd: tmpdir(), tool_name: 'apply_patch', tool_input: { command: patch } });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('safety.runtime-state-write');
  });

  it('should block shell writes to runtime state and allow the toolkit CLI', () => {
    expect((JSON.parse(runHook('claude-code', { tool_name: 'Bash', tool_input: { command: 'echo {} >> .ai-agent-setup/runs/r/events.jsonl' } }).stdout) as HookOutput).hookSpecificOutput.permissionDecision).toBe('deny');
    expect(runHook('claude-code', { tool_name: 'Bash', tool_input: { command: 'npx create-ai-agent-setup run event run-1 --type STEP_STARTED --step a' } }).stdout).toBe('');
  });
});

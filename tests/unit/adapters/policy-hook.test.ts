import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { actionsFromHookInput, hookResponse, patchPaths } from '../../../src/adapters/hook-runtime/policy-check';
import type { PolicyDecision } from '../../../src/core/policy';

const decision = (effect: PolicyDecision['effect']): PolicyDecision => ({
  effect,
  matches:
    effect === 'allow'
      ? []
      : [{ policyId: 'policy.safety', ruleId: 'safety.rule', layer: 'mandatory', effect, description: 'Needs approval.' }],
  ignoredAllows: [],
});

describe('actionsFromHookInput', () => {
  it('should read a shell command string', () => {
    expect(actionsFromHookInput({ tool_name: 'Bash', tool_input: { command: 'rm -rf x' } })).toEqual([
      { type: 'command', command: 'rm -rf x' },
    ]);
  });

  it('should join an argv-style command array', () => {
    expect(actionsFromHookInput({ tool_name: 'shell', tool_input: { command: ['bash', '-lc', 'rm -rf x'] } })).toEqual([
      { type: 'command', command: "bash -lc 'rm -rf x'" },
    ]);
  });

  it('should read written content from Write, Edit and MultiEdit inputs', () => {
    expect(actionsFromHookInput({ tool_name: 'Write', tool_input: { file_path: 'a.ts', content: 'A' } })).toEqual([
      { type: 'write', path: 'a.ts', content: 'A' },
    ]);
    expect(actionsFromHookInput({ tool_name: 'Edit', tool_input: { file_path: 'a.ts', old_string: 'x', new_string: 'B' } })).toEqual([
      { type: 'write', path: 'a.ts', content: 'B' },
    ]);
    expect(
      actionsFromHookInput({ tool_name: 'MultiEdit', tool_input: { file_path: 'a.ts', edits: [{ new_string: 'C' }, { new_string: 'D' }] } }),
    ).toEqual([{ type: 'write', path: 'a.ts', content: 'C\nD' }]);
  });

  it('should treat a Codex apply_patch command as written content, not as a shell command', () => {
    expect(actionsFromHookInput({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n+rm -rf /' } })).toEqual([
      { type: 'write', path: '', content: '*** Begin Patch\n+rm -rf /' },
    ]);
  });

  it('should treat a patch body as written content', () => {
    expect(actionsFromHookInput({ tool_name: 'apply_patch', tool_input: { input: '*** Begin Patch\n+x' } })).toEqual([
      { type: 'write', path: '', content: '*** Begin Patch\n+x' },
    ]);
  });

  it('should return no actions for tools it does not understand', () => {
    expect(actionsFromHookInput({ tool_name: 'Read', tool_input: { file_path: 'a.ts' } })).toEqual([]);
    expect(actionsFromHookInput(null)).toEqual([]);
  });
});

describe('hookResponse', () => {
  it('should stay silent on allow so the host keeps its normal permission flow', () => {
    expect(hookResponse('claude-code', decision('allow'))).toEqual({ exitCode: 0, stdout: '', stderr: '' });
    expect(hookResponse('codex', decision('allow'))).toEqual({ exitCode: 0, stdout: '', stderr: '' });
  });

  it.each(['ask', 'deny'] as const)('should return a Claude Code permission decision for %s', (effect) => {
    const response = hookResponse('claude-code', decision(effect));

    expect(response.exitCode).toBe(0);
    expect(JSON.parse(response.stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: effect,
        permissionDecisionReason: 'safety.rule: Needs approval.',
      },
    });
  });

  it('should block on Codex with exit code 2 and explain that ask is emulated', () => {
    const response = hookResponse('codex', decision('ask'));

    expect(response.exitCode).toBe(2);
    expect(response.stderr).toContain('requires explicit human approval');
    expect(response.stderr).toContain('safety.rule');
  });

  it('should turn each file of a Codex patch into its own write, relative to the project', () => {
    const patch = '*** Begin Patch\n*** Update File: src/a.ts\n*** Add File: .ai-agent-setup/x.json\n*** End Patch';

    expect(patchPaths(patch)).toEqual(['src/a.ts', '.ai-agent-setup/x.json']);
    expect(actionsFromHookInput({ tool_name: 'apply_patch', tool_input: { command: patch } }).map((action) => (action.type === 'write' ? action.path : ''))).toEqual(['src/a.ts', '.ai-agent-setup/x.json']);
  });

  it('should make absolute paths project-relative using the hook cwd', () => {
    const cwd = join(tmpdir(), 'project');
    expect(actionsFromHookInput({ cwd, tool_name: 'Write', tool_input: { file_path: join(cwd, 'src', 'a.ts'), content: 'A' } })).toEqual([{ type: 'write', path: 'src/a.ts', content: 'A' }]);
  });
});


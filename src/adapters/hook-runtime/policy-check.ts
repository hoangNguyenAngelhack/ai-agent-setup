import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PolicyEngine, type PolicyAction, type PolicyDecision } from '../../core/policy';
import type { PolicyDocument } from '../../registry';

/**
 * PreToolUse hook runtime (replaces the inert V1 hooks, TD-03). Copied into projects as
 * self-contained `.cjs` files by the adapters; reads hook JSON from stdin (both hosts use stdin)
 * and the policies from the `policies.json` file next to it. No network, no dependencies.
 */
export type HookHost = 'claude-code' | 'codex';

export interface HookResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type HookInput = { tool_name?: unknown; tool_input?: unknown } | null;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function filePathOf(toolInput: Record<string, unknown>): string {
  if (typeof toolInput.file_path === 'string') return toolInput.file_path;
  return typeof toolInput.path === 'string' ? toolInput.path : '';
}

function shellQuote(token: string): string {
  return /^[\w@%+=:,./-]+$/.test(token) ? token : `'${token.replace(/'/g, `'\\''`)}'`;
}

/**
 * Converts a host hook payload into policy actions; unknown tools produce no actions.
 * Codex (verified on 0.171) reports shell commands as `Bash` with `tool_input.command` (string)
 * and file edits as `apply_patch` with the patch text also in `tool_input.command`.
 */
export function actionsFromHookInput(input: HookInput): PolicyAction[] {
  const toolInput = asRecord(input?.tool_input);
  const path = filePathOf(toolInput);

  if (input?.tool_name === 'apply_patch' && typeof toolInput.command === 'string') {
    return [{ type: 'write', path, content: toolInput.command }];
  }
  if (typeof toolInput.command === 'string') return [{ type: 'command', command: toolInput.command }];
  if (Array.isArray(toolInput.command)) return [{ type: 'command', command: toolInput.command.map(String).map(shellQuote).join(' ') }];
  if (typeof toolInput.content === 'string') return [{ type: 'write', path, content: toolInput.content }];
  if (typeof toolInput.new_string === 'string') return [{ type: 'write', path, content: toolInput.new_string }];
  if (Array.isArray(toolInput.edits)) {
    const content = toolInput.edits.map((edit) => asRecord(edit).new_string).filter((text): text is string => typeof text === 'string');
    return [{ type: 'write', path, content: content.join('\n') }];
  }
  const patch = toolInput.input ?? toolInput.patch;
  if (typeof patch === 'string') return [{ type: 'write', path, content: patch }];
  return [];
}

function reasonOf(decision: PolicyDecision): string {
  return decision.matches
    .filter((match) => match.effect === decision.effect)
    .map((match) => `${match.ruleId}: ${match.description}`)
    .join(' | ');
}

/**
 * Claude Code: JSON `permissionDecision` (ask or deny). Codex: exit code 2 with the reason on
 * stderr; Codex has no "ask" hook decision, so ask is emulated as a block with an explanation.
 */
export function hookResponse(host: HookHost, decision: PolicyDecision): HookResponse {
  if (decision.effect === 'allow') return { exitCode: 0, stdout: '', stderr: '' };
  const reason = reasonOf(decision);
  if (host === 'claude-code') {
    const output = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision.effect, permissionDecisionReason: reason } };
    return { exitCode: 0, stdout: JSON.stringify(output), stderr: '' };
  }
  const prefix =
    decision.effect === 'ask'
      ? 'Blocked by ai-agent-setup policy: this action requires explicit human approval. Ask the user to run it or to approve it.'
      : 'Blocked by ai-agent-setup policy.';
  return { exitCode: 2, stdout: '', stderr: `${prefix} ${reason}` };
}

function strictestDecision(engine: PolicyEngine, actions: PolicyAction[]): PolicyDecision {
  const rank = { allow: 0, ask: 1, deny: 2 } as const;
  return actions
    .map((action) => engine.evaluate(action))
    .reduce<PolicyDecision>((worst, current) => (rank[current.effect] > rank[worst.effect] ? current : worst), {
      effect: 'allow',
      matches: [],
      ignoredAllows: [],
    });
}

function main(): void {
  const host: HookHost = process.argv.includes('codex') ? 'codex' : 'claude-code';
  let response: HookResponse;
  try {
    const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
    const policies = JSON.parse(readFileSync(join(__dirname, 'policies.json'), 'utf8')) as PolicyDocument[];
    response = hookResponse(host, strictestDecision(new PolicyEngine(policies), actionsFromHookInput(input)));
  } catch (error) {
    // Fail open but visibly: a broken hook must not block every tool; host permissions still apply.
    response = { exitCode: 1, stdout: '', stderr: `ai-agent-setup policy hook error: ${(error as Error).message}` };
  }
  if (response.stdout) process.stdout.write(response.stdout);
  if (response.stderr) process.stderr.write(response.stderr);
  process.exitCode = response.exitCode;
}

if (require.main === module) main();

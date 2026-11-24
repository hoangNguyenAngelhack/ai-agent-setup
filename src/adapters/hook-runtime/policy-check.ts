import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { PolicyEngine, type PolicyAction, type PolicyDecision } from '../../core/policy';
import type { PolicyDocument } from '../../registry';
import { touchesKeyDirectory } from '../../shared/key-location';

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

type HookInput = { tool_name?: unknown; tool_input?: unknown; cwd?: unknown } | null;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'NotebookRead']);

/** Project-relative path with forward slashes (hosts may send absolute paths). */
function projectPath(path: string, cwd: string): string {
  const relativePath = isAbsolute(path) ? relative(cwd, path) : path;
  return relativePath.split('\\').join('/');
}

function filePathOf(toolInput: Record<string, unknown>, cwd: string): string {
  if (typeof toolInput.file_path === 'string') return projectPath(toolInput.file_path, cwd);
  return typeof toolInput.path === 'string' ? projectPath(toolInput.path, cwd) : '';
}

/** Files named in a Codex patch (`*** Add File:`, `*** Update File:`, `*** Delete File:`, `*** Move to:`). */
export function patchPaths(patch: string): string[] {
  const paths = [...patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)].map((match) => match[1]!.trim());
  return [...new Set(paths)];
}

function shellQuote(token: string): string {
  return /^[\w@%+=:,./-]+$/.test(token) ? token : `'${token.replace(/'/g, `'\\''`)}'`;
}

/**
 * Converts a host hook payload into policy actions; unknown tools produce no actions.
 * Codex (verified on 0.171) reports shell commands as `Bash` with `tool_input.command` (string)
 * and file edits as `apply_patch` with the patch text also in `tool_input.command`.
 */
export function actionsFromHookInput(input: HookInput, fallbackCwd: string = process.cwd()): PolicyAction[] {
  const toolInput = asRecord(input?.tool_input);
  const cwd = typeof input?.cwd === 'string' ? input.cwd : fallbackCwd;
  const path = filePathOf(toolInput, cwd);

  // File tools that read (Claude Code): policies with `readPaths` apply to them (ADR-016).
  if (typeof input?.tool_name === 'string' && READ_TOOLS.has(input.tool_name)) return path ? [{ type: 'read', path }] : [];

  if (input?.tool_name === 'apply_patch' && typeof toolInput.command === 'string') {
    // One write per file in the patch, so path rules apply to each of them.
    const patch = toolInput.command;
    const paths = patchPaths(patch).map((file) => projectPath(file, cwd));
    return (paths.length ? paths : [path]).map((file) => ({ type: 'write', path: file, content: patch }));
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

/**
 * Built-in guard for the integrity key (ADR-016), independent of glob patterns: a file action whose
 * resolved path is the key directory, inside it, or a parent of it is denied. Case-insensitive where
 * the file system is.
 */
export function keyDirectoryDecision(action: PolicyAction, cwd: string): PolicyDecision | null {
  if (action.type !== 'read' && action.type !== 'write') return null;
  if (!action.path || !touchesKeyDirectory(resolve(cwd, action.path))) return null;
  const match = {
    policyId: 'policy.safety',
    ruleId: 'safety.integrity-key-access',
    layer: 'mandatory' as const,
    effect: 'deny' as const,
    description: 'The local integrity key is used by the toolkit only (built-in path check).',
  };
  return { effect: 'deny', matches: [match], ignoredAllows: [] };
}

export function strictestDecision(engine: PolicyEngine, actions: PolicyAction[], cwd: string = process.cwd()): PolicyDecision {
  const rank = { allow: 0, ask: 1, deny: 2 } as const;
  return actions
    .map((action) => keyDirectoryDecision(action, cwd) ?? engine.evaluate(action))
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
    const cwd = typeof input?.cwd === 'string' ? input.cwd : process.cwd();
    response = hookResponse(host, strictestDecision(new PolicyEngine(policies), actionsFromHookInput(input, cwd), cwd));
  } catch (error) {
    // Fail open but visibly: a broken hook must not block every tool; host permissions still apply.
    response = { exitCode: 1, stdout: '', stderr: `ai-agent-setup policy hook error: ${(error as Error).message}` };
  }
  if (response.stdout) process.stdout.write(response.stdout);
  if (response.stderr) process.stderr.write(response.stderr);
  process.exitCode = response.exitCode;
}

if (require.main === module) main();

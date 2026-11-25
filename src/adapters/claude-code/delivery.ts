import { deliveryPrompt, jsonLine, usageCounts, type HostDelivery } from '../common/delivery';

/** Claude Code usage fields (Anthropic message `usage`); input excludes cache reads and writes. */
const USAGE_FIELDS = { input: 'input_tokens', output: 'output_tokens', cacheRead: 'cache_read_input_tokens', cacheWrite: 'cache_creation_input_tokens' };

/**
 * Claude Code headless mode: `claude -p <prompt> --output-format stream-json --verbose` prints one
 * JSON message per line; `system/init` opens the session and a `result` message closes it.
 * Message shapes follow the published docs and are NOT yet verified against an installed CLI (W2.0-15).
 * Usage: every `assistant` message carries `message.usage` and `message.model`, and one message is
 * repeated over several lines with the same `message.id` (verified 2026-11-25 on local Claude Code
 * 2.1.33x session transcripts: 411 lines, 181 ids, same usage on each repeat). The `result` message
 * adds `total_cost_usd` and a session `usage` (published docs; not verified on an installed CLI).
 */
/**
 * Tool calls: `tool_use` content blocks, each with a unique id (verified 2026-11-25 on a local
 * transcript: one block per line, 1003 tool_use ids, none repeated).
 */
function toolUseIds(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((block: unknown) => {
    const item = block as { type?: unknown; id?: unknown } | null;
    return item?.type === 'tool_use' && typeof item.id === 'string' ? [item.id] : [];
  });
}

export const claudeCodeDelivery: HostDelivery = {
  host: 'claude-code',
  executable: 'claude',
  invocation(plan, files) {
    return {
      executable: 'claude',
      args: ['-p', deliveryPrompt(plan, files), '--output-format', 'stream-json', '--verbose'],
      unsupported: [
        'interactive approval inside a headless run: the agent reports APPROVAL_REQUIRED and stops; the run continues after `run approve-step`',
        'permission mode comes from the user\'s Claude Code settings; delivery never widens it',
        'step progress is self-reported by the agent and stays unverified until the gates run',
      ],
    };
  },
  parseLine(line) {
    const message = jsonLine(line);
    if (!message) return null;
    if (message.type === 'system' && message.subtype === 'init') return { kind: 'started' };
    if (message.type !== 'result') return null;
    if (message.subtype === 'success' && message.is_error !== true) return { kind: 'completed' };
    return { kind: 'failed', reason: `claude result ${typeof message.subtype === 'string' ? message.subtype : 'error'}` };
  },
  promptInvocation(prompt, model) {
    return { executable: 'claude', args: ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--model', model] };
  },
  parseUsage(line) {
    const message = jsonLine(line);
    if (message?.type === 'assistant') {
      const body = message.message as Record<string, unknown> | undefined;
      const tokens = usageCounts(body?.usage, USAGE_FIELDS);
      const toolCalls = toolUseIds(body?.content);
      if (!tokens && !toolCalls.length) return null;
      return {
        ...(tokens ? { tokens } : {}),
        ...(toolCalls.length ? { toolCalls } : {}),
        ...(typeof body?.id === 'string' ? { messageId: body.id } : {}),
        ...(typeof body?.model === 'string' ? { model: body.model } : {}),
      };
    }
    if (message?.type !== 'result') return null;
    const tokens = usageCounts(message.usage, USAGE_FIELDS);
    const cost = message.total_cost_usd;
    const costUsd = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : undefined;
    if (!tokens && costUsd === undefined) return null;
    return { total: true, ...(tokens ? { tokens } : {}), ...(costUsd !== undefined ? { costUsd } : {}) };
  },
};

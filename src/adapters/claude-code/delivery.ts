import { addTokens, zeroTokens, type TokenCounts } from '../../core/evaluation';
import { deliveryPrompt, jsonLine, usageCounts, type HostDelivery } from '../common/delivery';

/** Claude Code usage fields (Anthropic message `usage`); input excludes cache reads and writes. */
const USAGE_FIELDS = { input: 'input_tokens', output: 'output_tokens', cacheRead: 'cache_read_input_tokens', cacheWrite: 'cache_creation_input_tokens' };
/** Fields of each model in the `result` message's `modelUsage`. */
const MODEL_USAGE_FIELDS = { input: 'inputTokens', output: 'outputTokens', cacheRead: 'cacheReadInputTokens', cacheWrite: 'cacheCreationInputTokens' };

/** Tokens per model from `modelUsage`; null when it is absent or carries no counts. */
function modelUsage(value: unknown): Record<string, Partial<TokenCounts>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const models = Object.entries(value).flatMap(([name, usage]) => {
    const counts = usageCounts(usage, MODEL_USAGE_FIELDS);
    return counts ? [[name, counts] as const] : [];
  });
  return models.length ? Object.fromEntries(models) : null;
}

/**
 * Claude Code headless mode: `claude -p <prompt> --output-format stream-json --verbose` prints one
 * JSON message per line; `system/init` opens the session and a `result` message closes it.
 * Message shapes follow the published docs and are NOT yet verified against an installed CLI (W2.0-15).
 * Usage (verified 2026-11-25 against Claude Code 2.1.332 `-p --output-format stream-json`): every
 * `assistant` line carries `message.usage`, repeated unchanged on each line of the same `message.id`,
 * but its output count is the one at the start of the message. The `result` message carries the true
 * session totals: `usage` (main loop), `modelUsage` (every model call, per model) and
 * `total_cost_usd`. Totals come from `modelUsage`; per-message usage is the fallback when the host
 * stops before `result`.
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
    // modelUsage covers every model call of the session (auxiliary ones included); usage only the main loop.
    const models = modelUsage(message.modelUsage);
    const tokens = models ? Object.values(models).reduce<TokenCounts>((sum, counts) => addTokens(sum, counts), zeroTokens()) : usageCounts(message.usage, USAGE_FIELDS);
    const cost = message.total_cost_usd;
    const costUsd = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : undefined;
    if (!tokens && costUsd === undefined) return null;
    return { total: true, ...(tokens ? { tokens } : {}), ...(models ? { models } : {}), ...(costUsd !== undefined ? { costUsd } : {}) };
  },
};

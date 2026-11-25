import { deliveryPrompt, jsonLine, usageCounts, type HostDelivery } from '../common/delivery';

/**
 * Codex `turn.completed.usage` fields (published docs; NOT verified on an installed CLI). Following
 * the OpenAI API convention, cached input is assumed to be part of `input_tokens`, not added to it.
 */
const USAGE_FIELDS = { input: 'input_tokens', output: 'output_tokens', cacheRead: 'cached_input_tokens' };

/**
 * Codex non-interactive mode: `codex exec --json <prompt>` prints JSONL events (`thread.started`,
 * `turn.completed`, `turn.failed`, `error`, item events). Event names follow the published docs and
 * are NOT yet verified against an installed CLI (W2.0-15).
 */
/** Item types that are tool calls (published docs; NOT verified on an installed CLI). Counted once per item id. */
const TOOL_ITEMS = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'web_search']);

export const codexDelivery: HostDelivery = {
  host: 'codex',
  executable: 'codex',
  invocation(plan, files) {
    return {
      executable: 'codex',
      args: ['exec', '--json', deliveryPrompt(plan, files)],
      unsupported: [
        'ask-style approvals: Codex hooks can only block, so approval points are emulated by stopping the run',
        'sandbox and approval policy come from the user\'s Codex configuration; delivery never widens them',
        'step progress is self-reported by the agent and stays unverified until the gates run',
      ],
    };
  },
  parseLine(line) {
    const event = jsonLine(line);
    if (!event) return null;
    if (event.type === 'thread.started') return { kind: 'started' };
    if (event.type === 'turn.completed') return { kind: 'completed' };
    if (event.type === 'turn.failed' || event.type === 'error') {
      const error = event.error as { message?: unknown } | undefined;
      const message = [error?.message, event.message].find((item): item is string => typeof item === 'string') ?? 'unknown error';
      return { kind: 'failed', reason: `codex ${event.type}: ${message}` };
    }
    return null;
  },
  promptInvocation(prompt, model) {
    return { executable: 'codex', args: ['exec', '--json', '-m', model, prompt] };
  },
  parseUsage(line) {
    const event = jsonLine(line);
    if (event?.type === 'item.started' || event?.type === 'item.completed') {
      const item = event.item as { id?: unknown; type?: unknown } | undefined;
      const isToolCall = typeof item?.type === 'string' && TOOL_ITEMS.has(item.type) && typeof item.id === 'string';
      return isToolCall ? { toolCalls: [item.id as string] } : null;
    }
    if (event?.type !== 'turn.completed') return null;
    const tokens = usageCounts(event.usage, USAGE_FIELDS);
    return tokens ? { tokens } : null;
  },
};

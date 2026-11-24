import { deliveryPrompt, jsonLine, type HostDelivery } from '../common/delivery';

/**
 * Codex non-interactive mode: `codex exec --json <prompt>` prints JSONL events (`thread.started`,
 * `turn.completed`, `turn.failed`, `error`, item events). Event names follow the published docs and
 * are NOT yet verified against an installed CLI (W2.0-15).
 */
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
};

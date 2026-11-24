import { deliveryPrompt, jsonLine, type HostDelivery } from '../common/delivery';

/**
 * Claude Code headless mode: `claude -p <prompt> --output-format stream-json --verbose` prints one
 * JSON message per line; `system/init` opens the session and a `result` message closes it.
 * Message shapes follow the published docs and are NOT yet verified against an installed CLI (W2.0-15).
 */
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
};

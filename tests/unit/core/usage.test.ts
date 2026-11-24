import { describe, expect, it } from 'vitest';
import { claudeCodeDelivery } from '../../../src/adapters/claude-code';
import { codexDelivery } from '../../../src/adapters/codex';
import { UsageMeter, tokenCount } from '../../../src/core/evaluation';

const line = (value: unknown) => JSON.stringify(value);
const assistant = (id: string | undefined, usage: Record<string, unknown>, model = 'claude-test-1') => line({ type: 'assistant', message: { id, model, usage } });

describe('UsageMeter (W2.2-04)', () => {
  it('should count a message repeated over several lines once', () => {
    const meter = new UsageMeter('claude-code');
    for (const text of [assistant('m1', { input_tokens: 3, output_tokens: 4 }), assistant('m1', { input_tokens: 3, output_tokens: 4 }), assistant('m2', { input_tokens: 1, output_tokens: 1 })]) {
      meter.add(claudeCodeDelivery.parseUsage(text)!);
    }
    const usage = meter.result();
    expect(usage).toMatchObject({ samples: 3, tokens: { input: 4, output: 5, cacheRead: 0, cacheWrite: 0 }, label: 'measured', cost: null });
    expect(usage.byModel).toEqual({ 'claude-test-1': { input: 4, output: 5, cacheRead: 0, cacheWrite: 0 } });
    expect(usage.basis).toMatch(/2 usage record\(s\).*each message id counted once/);
  });

  it('should use the session total only when no per-message usage was seen, and keep the host cost as an estimate', () => {
    const withMessages = new UsageMeter('claude-code');
    withMessages.add({ messageId: 'm1', tokens: { input: 2 } });
    withMessages.add({ total: true, tokens: { input: 50 }, costUsd: 0.25 });
    expect(withMessages.result()).toMatchObject({ tokens: { input: 2 }, cost: { usd: 0.25, label: 'estimated', basis: expect.stringContaining('not an invoice') as unknown } });

    const totalOnly = new UsageMeter('claude-code');
    totalOnly.add({ total: true, tokens: { input: 50, output: 5 } });
    expect(totalOnly.result()).toMatchObject({ tokens: { input: 50, output: 5 }, basis: 'session total reported by claude-code' });
  });

  it('should report no usage as zero samples, never as a measured zero cost', () => {
    expect(new UsageMeter('codex').result()).toMatchObject({ samples: 0, tokens: { input: 0, output: 0 }, cost: null, basis: 'no usage in the codex stream' });
  });

  it('should drop model names that do not look like model ids', () => {
    const meter = new UsageMeter('claude-code');
    meter.add({ messageId: 'a', model: 'x\n<script>', tokens: { input: 1 } });
    meter.add({ messageId: 'b', model: 'claude-test-1', tokens: { input: 2 } });
    expect(Object.keys(meter.result().byModel)).toEqual(['claude-test-1']);
  });

  it('should accept only non-negative integer counts', () => {
    expect([tokenCount(3), tokenCount(0), tokenCount(-1), tokenCount(1.5), tokenCount('3'), tokenCount(Number.NaN)]).toEqual([3, 0, undefined, undefined, undefined, undefined]);
  });
});

describe('host usage parsing (W2.2-04)', () => {
  it('should read Claude Code assistant usage with its cache fields', () => {
    expect(claudeCodeDelivery.parseUsage(assistant('m1', { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 }))).toEqual({
      messageId: 'm1',
      model: 'claude-test-1',
      tokens: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 },
    });
    expect(claudeCodeDelivery.parseUsage(line({ type: 'assistant', message: { usage: { input_tokens: 1 } } }))).toEqual({ tokens: { input: 1 } });
  });

  it('should read the Claude Code result total and cost, ignoring a cost that is not a number', () => {
    expect(claudeCodeDelivery.parseUsage(line({ type: 'result', total_cost_usd: 0.5, usage: { input_tokens: 9 } }))).toEqual({ total: true, tokens: { input: 9 }, costUsd: 0.5 });
    expect(claudeCodeDelivery.parseUsage(line({ type: 'result', total_cost_usd: 0.5 }))).toEqual({ total: true, costUsd: 0.5 });
    expect(claudeCodeDelivery.parseUsage(line({ type: 'result', total_cost_usd: -1 }))).toBeNull();
    expect(claudeCodeDelivery.parseUsage(line({ type: 'result', subtype: 'success' }))).toBeNull();
  });

  it('should read Codex turn usage', () => {
    expect(codexDelivery.parseUsage(line({ type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 2 } }))).toEqual({ tokens: { input: 10, cacheRead: 4, output: 2 } });
    expect(codexDelivery.parseUsage(line({ type: 'turn.completed' }))).toBeNull();
  });

  it('should ignore lines without usage, non-JSON lines and non-count values', () => {
    for (const delivery of [claudeCodeDelivery, codexDelivery]) {
      expect(delivery.parseUsage('not json')).toBeNull();
      expect(delivery.parseUsage(line({ type: 'system', subtype: 'init' }))).toBeNull();
    }
    expect(claudeCodeDelivery.parseUsage(assistant('m', { input_tokens: '[REDACTED]', output_tokens: -2 }))).toBeNull();
    expect(codexDelivery.parseUsage(line({ type: 'turn.completed', usage: [1, 2] }))).toBeNull();
  });
});

describe('tool calls (W2.2-07)', () => {
  it('should read Claude Code tool_use blocks and Codex tool items, each id once', () => {
    const claude = line({ type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', id: 't1' }, { type: 'text', text: 'x' }, { type: 'tool_use' }] } });
    expect(claudeCodeDelivery.parseUsage(claude)).toEqual({ toolCalls: ['t1'], messageId: 'm1' });
    expect(claudeCodeDelivery.parseUsage(line({ type: 'assistant', message: { content: 'text' } }))).toBeNull();
    expect(codexDelivery.parseUsage(line({ type: 'item.started', item: { id: 'i1', type: 'command_execution' } }))).toEqual({ toolCalls: ['i1'] });
    expect(codexDelivery.parseUsage(line({ type: 'item.completed', item: { id: 'i2', type: 'agent_message' } }))).toBeNull();
    expect(codexDelivery.parseUsage(line({ type: 'item.completed', item: { type: 'web_search' } }))).toBeNull();

    const meter = new UsageMeter('codex');
    for (const sample of [{ toolCalls: ['i1'] }, { toolCalls: ['i1'] }, { toolCalls: ['i2'] }]) meter.add(sample);
    // Tool calls are not usage records: a stream with only tool calls still reports no usage.
    expect(meter.result()).toMatchObject({ toolCalls: 2, samples: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { applyInMemory } from '../../../src/installer/apply-in-memory';
import type { FileOperation } from '../../../src/shared/file-operations';

const write = (path: string, content: string): FileOperation => ({ kind: 'write', path, content, source: null });

describe('applyInMemory', () => {
  it('should create written files', () => {
    const files = applyInMemory([write('a.md', 'A')]);

    expect(Object.fromEntries(files)).toEqual({ 'a.md': 'A' });
  });

  it('should append a managed section to an existing file and keep user text', () => {
    const op: FileOperation = { kind: 'section', path: 'AGENTS.md', marker: 't0', style: 'html', content: 'managed', source: null };

    const files = applyInMemory([op], new Map([['AGENTS.md', '# Mine\n']]));

    expect(files.get('AGENTS.md')).toBe(
      '# Mine\n\n<!-- ai-agent-setup:begin t0 -->\nmanaged\n<!-- ai-agent-setup:end t0 -->\n',
    );
  });

  it('should replace only the content between existing markers', () => {
    const before = 'top\n<!-- ai-agent-setup:begin t0 -->\nold\n<!-- ai-agent-setup:end t0 -->\nbottom\n';
    const op: FileOperation = { kind: 'section', path: 'x.md', marker: 't0', style: 'html', content: 'new', source: null };

    expect(applyInMemory([op], new Map([['x.md', before]])).get('x.md')).toBe(
      'top\n<!-- ai-agent-setup:begin t0 -->\nnew\n<!-- ai-agent-setup:end t0 -->\nbottom\n',
    );
  });

  it('should use hash comments for TOML sections', () => {
    const op: FileOperation = { kind: 'section', path: 'c.toml', marker: 'm', style: 'hash', content: 'a = 1', source: null };

    expect(applyInMemory([op]).get('c.toml')).toBe('# ai-agent-setup:begin m\na = 1\n# ai-agent-setup:end m\n');
  });

  it('should deep-merge JSON, union arrays and keep existing keys', () => {
    const existing = JSON.stringify({ model: 'x', permissions: { ask: ['Bash(a *)'], allow: ['Read'] } });
    const op: FileOperation = {
      kind: 'merge-json',
      path: 's.json',
      value: { permissions: { ask: ['Bash(a *)', 'Bash(b *)'] }, hooks: { PreToolUse: [] } },
      source: null,
    };

    const merged = JSON.parse(applyInMemory([op], new Map([['s.json', existing]])).get('s.json')!);

    expect(merged).toEqual({ model: 'x', permissions: { ask: ['Bash(a *)', 'Bash(b *)'], allow: ['Read'] }, hooks: { PreToolUse: [] } });
  });

  it('should be idempotent', () => {
    const ops: FileOperation[] = [
      { kind: 'section', path: 'x.md', marker: 't0', style: 'html', content: 'm', source: null },
      { kind: 'merge-json', path: 's.json', value: { a: [1] }, source: null },
    ];
    const once = applyInMemory(ops);

    expect(applyInMemory(ops, once)).toEqual(once);
  });
});

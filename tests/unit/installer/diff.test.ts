import { describe, expect, it } from 'vitest';
import { unifiedDiff } from '../../../src/installer/diff';

describe('unifiedDiff', () => {
  it('should return an empty string for identical content', () => {
    expect(unifiedDiff('a.md', 'x\n', 'x\n')).toBe('');
  });

  it('should diff a new file against /dev/null', () => {
    expect(unifiedDiff('a.md', null, 'one\ntwo\n')).toBe('--- /dev/null\n+++ b/a.md\n@@ -0,0 +1,2 @@\n+one\n+two\n');
  });

  it('should show one changed line with three lines of context', () => {
    const before = ['1', '2', '3', '4', '5', '6', '7', '8'].join('\n');
    const after = ['1', '2', '3', '4', 'five', '6', '7', '8'].join('\n');

    expect(unifiedDiff('n.txt', before, after)).toBe(
      ['--- a/n.txt', '+++ b/n.txt', '@@ -2,7 +2,7 @@', ' 2', ' 3', ' 4', '-5', '+five', ' 6', ' 7', ' 8', ''].join('\n'),
    );
  });

  it('should split distant changes into separate hunks', () => {
    const before = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join('\n');
    const after = before.replace('line 2', 'LINE 2').replace('line 19', 'LINE 19');

    expect(unifiedDiff('f.txt', before, after).match(/^@@/gm)).toHaveLength(2);
  });
});

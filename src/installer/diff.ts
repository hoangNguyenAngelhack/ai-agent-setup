const CONTEXT_LINES = 3;

type Edit = { type: 'same' | 'remove' | 'add'; line: string };

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  return text.replace(/\n$/, '').split('\n');
}

/** Line edit script via longest common subsequence (fine for configuration-sized files). */
function lineEdits(before: string[], after: string[]): Edit[] {
  const lcs: number[][] = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lcs[i]![j] = before[i] === after[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const edits: Edit[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      edits.push({ type: 'same', line: before[i]! });
      i += 1;
      j += 1;
    } else if (i < before.length && (j === after.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      // Removals before additions, as in conventional unified diffs.
      edits.push({ type: 'remove', line: before[i]! });
      i += 1;
    } else {
      edits.push({ type: 'add', line: after[j]! });
      j += 1;
    }
  }
  return edits;
}

/** Unified diff (3 lines of context) of `before` → `after`; empty string when equal. */
export function unifiedDiff(path: string, before: string | null, after: string): string {
  if (before === after) return '';
  const edits = lineEdits(splitLines(before ?? ''), splitLines(after));
  const hunks: Array<[number, number]> = [];
  edits.forEach((edit, index) => {
    if (edit.type === 'same') return;
    const start = Math.max(0, index - CONTEXT_LINES);
    const end = Math.min(edits.length - 1, index + CONTEXT_LINES);
    const last = hunks.at(-1);
    if (last && start <= last[1] + 1) last[1] = end;
    else hunks.push([start, end]);
  });

  const lines = [before === null ? '--- /dev/null' : `--- a/${path}`, `+++ b/${path}`];
  for (const [start, end] of hunks) {
    const prefix = edits.slice(0, start);
    const hunk = edits.slice(start, end + 1);
    const oldStart = prefix.filter((edit) => edit.type !== 'add').length + 1;
    const newStart = prefix.filter((edit) => edit.type !== 'remove').length + 1;
    const oldCount = hunk.filter((edit) => edit.type !== 'add').length;
    const newCount = hunk.filter((edit) => edit.type !== 'remove').length;
    lines.push(`@@ -${oldCount === 0 ? oldStart - 1 : oldStart},${oldCount} +${newCount === 0 ? newStart - 1 : newStart},${newCount} @@`);
    for (const edit of hunk) lines.push(`${edit.type === 'same' ? ' ' : edit.type === 'add' ? '+' : '-'}${edit.line}`);
  }
  return `${lines.join('\n')}\n`;
}

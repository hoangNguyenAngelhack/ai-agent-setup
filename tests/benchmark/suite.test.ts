import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles } from '../../src/app/benchmark/arms';
import { judge, snapshotTree } from '../../src/app/benchmark/oracle';
import { loadSuite } from '../../src/app/benchmark/tasks';
import { matchesAnyGlob } from '../../src/shared/glob';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * W2.2-03 acceptance: the benchmark suite meets the distribution of docs/v2/09 §5.3, and every task is
 * well formed: its hidden checks reject the untouched fixture, accept the reference solution, and the
 * solution stays inside the task scope. Judged by the real oracle, as a benchmark run would.
 */
const SUITE = join(REPO_ROOT, 'benchmarks', 'suite');
const tasks = loadSuite(SUITE);

const DISTRIBUTION: Record<string, number> = {
  'product-requirements': 3,
  architecture: 3,
  frontend: 3,
  backend: 4,
  mobile: 2,
  data: 3,
  devops: 3,
  testing: 3,
  security: 3,
  documentation: 2,
  refactoring: 2,
  'bug-fixing': 3,
  'cross-domain': 2,
};

const python = spawnSync('python3', ['--version']).status === 0;

function workspace(fixture: string, solution?: string): { dir: string; before: ReturnType<typeof snapshotTree> } {
  const dir = mkdtempSync(join(tmpdir(), 'suite-'));
  cpSync(join(SUITE, fixture), dir, { recursive: true });
  const before = snapshotTree(dir);
  if (solution) cpSync(join(SUITE, solution), dir, { recursive: true });
  return { dir, before };
}

describe('benchmark suite (W2.2-03)', () => {
  it('should hold 36 tasks in the distribution of 09 §5.3', () => {
    expect(tasks).toHaveLength(36);
    const counts: Record<string, number> = {};
    for (const task of tasks) counts[task.category] = (counts[task.category] ?? 0) + 1;
    expect(counts).toEqual(DISTRIBUTION);
  });

  it('should give every task a reference solution inside its scope, and every mutant a real change', () => {
    for (const task of tasks) {
      const solution = join(SUITE, 'solutions', task.id);
      expect(existsSync(solution), task.id).toBe(true);
      for (const file of listFiles(solution)) expect(matchesAnyGlob(file, task.scope), `${task.id}: ${file} is outside the scope`).toBe(true);
    }
    for (const id of readdirSync(join(SUITE, 'hidden'))) {
      const mutants = join(SUITE, 'hidden', id, 'mutants');
      if (!existsSync(mutants)) continue;
      const task = tasks.find((item) => item.id === id)!;
      const source = /check\.cjs (\S+)/.exec(task.acceptance.hiddenTests!.command)![1]!;
      const original = readFileSync(join(SUITE, task.fixture, source), 'utf8');
      for (const name of readdirSync(mutants)) expect(readFileSync(join(mutants, name), 'utf8'), `${id}: ${name} equals the original`).not.toBe(original);
    }
  });

  describe.skipIf(process.platform === 'win32')('oracle on fixtures and reference solutions', () => {
    it.each(tasks.map((task) => [task.id, task] as const))('%s: rejects the fixture, accepts the solution', (id, task) => {
      if (task.acceptance.hiddenTests?.command.startsWith('python3') && !python) return;
      const untouched = workspace(task.fixture);
      // The security regression checks pass on the untouched fixture: they only see what a change adds.
      expect(judge(task, SUITE, untouched.dir, untouched.before)).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' }, security: { status: 'PASS' } });

      const solved = workspace(task.fixture, join('solutions', id));
      const result = judge(task, SUITE, solved.dir, solved.before);
      expect(result, JSON.stringify(result)).toMatchObject({ hiddenTests: { status: 'PASS' }, dataLoss: { status: 'PASS' }, security: { status: 'PASS' } });
      expect(result.verdict).toBe(task.acceptance.rubric ? 'NOT_VERIFIED' : 'ACCEPTED');
    }, 30000);
  });
});

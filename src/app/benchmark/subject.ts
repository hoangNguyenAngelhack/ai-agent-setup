import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How a hidden check starts the code under test (the "subject"). The check process loads none of the
 * agent's code; the subject runs in its own process and, where the platform allows it, in a sandbox
 * that cannot read or change the checks' directory. The oracle hands the prefix to the check through
 * SUBJECT_PREFIX_ENV; the check's runtime never passes `BENCHMARK_*` variables on to the subject.
 */
export const SUBJECT_PREFIX_ENV = 'BENCHMARK_SUBJECT_PREFIX';

/** process-and-sandbox: own process plus a Seatbelt profile; process: own process only. */
export type SubjectIsolation = 'process-and-sandbox' | 'process';

const SANDBOX_EXEC = '/usr/bin/sandbox-exec';

/**
 * A command prefix that keeps the process it starts, and every child, out of `denied` (read, write and
 * listing); everything else stays as the user has it. Empty where no sandbox is available.
 */
export function subjectPrefix(denied: string[]): { prefix: string[]; isolation: SubjectIsolation } {
  if (process.platform !== 'darwin' || !existsSync(SANDBOX_EXEC)) return { prefix: [], isolation: 'process' };
  const paths = denied.filter((path) => existsSync(path)).map((path) => `(subpath ${JSON.stringify(realpathSync(path))})`);
  if (!paths.length) return { prefix: [], isolation: 'process' };
  return { prefix: [SANDBOX_EXEC, '-p', `(version 1)(allow default)(deny file-read* file-write* ${paths.join(' ')})`], isolation: 'process-and-sandbox' };
}

/** What the agent must never see in a benchmark run: the checks, the reference solutions, the results. */
export function benchmarkSecrets(suiteDir: string, checkRooms: string, outDir?: string): string[] {
  return [checkRooms, ...['hidden', 'solutions', 'security'].map((dir) => join(suiteDir, dir)), ...(outDir ? [outDir] : [])];
}

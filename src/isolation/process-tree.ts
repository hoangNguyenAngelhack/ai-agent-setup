import { spawnSync } from 'node:child_process';

/** Environment variable carrying the per-launch mark; every process of the launch inherits it. */
export const RUN_MARK_ENV = 'AI_AGENT_SETUP_RUN_MARK';

interface ProcessRow {
  pid: number;
  ppid: number;
  started: string;
  marked: boolean;
}

/**
 * Every process as pid, parent pid and start time (POSIX `ps`, run outside the sandbox). With a
 * mark, also whether the process environment carries it (`ps -E`; same-user processes only).
 */
function processTable(mark: string | null): ProcessRow[] {
  const columns = mark ? ['-A', '-E', '-o', 'pid=,ppid=,lstart=,command='] : ['-A', '-o', 'pid=,ppid=,lstart='];
  const listing = spawnSync('/bin/ps', columns, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (listing.status !== 0) return [];
  const token = mark ? `${RUN_MARK_ENV}=${mark}` : null;
  return listing.stdout.split('\n').flatMap((line) => {
    // lstart is a fixed five-field date ("Tue Nov 24 10:00:00 2026").
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)(.*)$/.exec(line);
    if (!match) return [];
    return [{ pid: Number(match[1]), ppid: Number(match[2]), started: match[3]!, marked: token !== null && match[4]!.split(/\s+/).includes(token) }];
  });
}

/**
 * The processes of an isolated launch, found from the host side. A process group is not enough: a
 * child can call setsid() and leave it, and its parent can exit so it is re-parented to launchd.
 * Two nets: descendants are recorded while the launch runs (with their start time, so a reused pid
 * is never signalled), and on stop every process whose environment carries the launch's random
 * mark is added. Stopping freezes all of them until no new one appears, then kills them. A process
 * that leaves the tree before a scan sees it AND drops the mark from its environment is not found
 * (ADR-017); it stays inside the sandbox.
 */
export class ProcessTree {
  private readonly tracked = new Map<number, string>();

  constructor(
    private readonly root: number,
    private readonly mark: string | null = null,
  ) {}

  /** Records the current descendants (and, with `byMark`, marked processes); returns the count. */
  scan(byMark = false): number {
    const table = processTable(byMark ? this.mark : null);
    const started = new Map(table.map((row) => [row.pid, row.started]));
    const rootStart = started.get(this.root);
    if (rootStart && !this.tracked.has(this.root)) this.tracked.set(this.root, rootStart);
    for (const row of table) if (row.marked && row.pid !== process.pid) this.tracked.set(row.pid, row.started);
    let grew = true;
    while (grew) {
      grew = false;
      for (const row of table) {
        if (this.tracked.has(row.pid) || !this.tracked.has(row.ppid) || this.tracked.get(row.ppid) !== started.get(row.ppid)) continue;
        this.tracked.set(row.pid, row.started);
        grew = true;
      }
    }
    return this.tracked.size;
  }

  /** Tracked pids still alive with the start time they were tracked with. */
  alive(): number[] {
    const started = new Map(processTable(null).map((row) => [row.pid, row.started]));
    return [...this.tracked].filter(([pid, start]) => started.get(pid) === start).map(([pid]) => pid);
  }

  /** Freezes every process of the launch until no new one appears, then kills them all. */
  stop(): void {
    for (let round = 0, size = -1; round < 10 && size !== this.tracked.size; round += 1) {
      size = this.tracked.size;
      this.scan(true);
      for (const pid of this.alive()) signal(pid, 'SIGSTOP');
    }
    for (const pid of this.alive()) signal(pid, 'SIGKILL');
  }
}

function signal(pid: number, name: NodeJS.Signals): void {
  try {
    process.kill(pid, name);
  } catch {
    // Already gone.
  }
}

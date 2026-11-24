import { spawn, spawnSync } from 'node:child_process';

export interface CommandOutcome {
  exitCode: number | null;
  output: string;
  /** Why the command has no trustworthy exit code; null when it ran to completion. */
  interrupted: 'timeout' | 'cancelled' | 'spawn-error' | null;
  error: string | null;
  truncated: boolean;
}

const MAX_OUTPUT = 1024 * 1024;
const KILL_GRACE_MS = 2000;

function killTree(pid: number, signal: NodeJS.Signals): void {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, signal);
  } catch {
    // Already exited.
  }
}

/**
 * Runs a project command in a shell with a timeout and cancellation. The command comes from the
 * project's own scripts or its gate configuration, never from model output.
 */
export function runCommand(command: string, options: { cwd: string; timeoutMs: number; signal?: AbortSignal }): Promise<CommandOutcome> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    let interrupted: CommandOutcome['interrupted'] = null;
    let settled = false;
    const child = spawn(command, { cwd: options.cwd, shell: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const collect = (chunk: Buffer) => {
      if (size >= MAX_OUTPUT) {
        truncated = true;
        return;
      }
      chunks.push(chunk.subarray(0, MAX_OUTPUT - size));
      size += chunk.length;
      if (size > MAX_OUTPUT) truncated = true;
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);

    const stop = (why: 'timeout' | 'cancelled') => {
      if (settled || child.pid === undefined) return;
      interrupted = why;
      killTree(child.pid, 'SIGTERM');
      // Only escalate if the process is still running: its process group id may be reused after exit.
      setTimeout(() => !settled && child.pid !== undefined && killTree(child.pid, 'SIGKILL'), KILL_GRACE_MS).unref();
    };
    const timer = options.timeoutMs > 0 ? setTimeout(() => stop('timeout'), options.timeoutMs) : null;
    const onAbort = () => stop('cancelled');
    if (options.signal?.aborted) onAbort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const finish = (exitCode: number | null, error: string | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({ exitCode: interrupted ? null : exitCode, output: Buffer.concat(chunks).toString('utf8'), interrupted: error ? 'spawn-error' : interrupted, error, truncated });
    };
    child.on('error', (error) => finish(null, error.message));
    child.on('close', (code) => finish(code, null));
  });
}

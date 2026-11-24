import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

/** Shell builtins: they never resolve to a file, so their absence proves nothing. */
const BUILTINS = new Set(['cd', 'echo', 'set', 'export', 'true', 'false', 'test', '[', 'exit', 'call', 'if', 'for', 'type', 'dir', 'exec', '.', 'source', 'env', 'command']);

/** The program a shell command starts with: env assignments skipped, quotes removed. */
export function firstProgram(command: string): string | null {
  const tokens = command.trim().match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  const program = tokens.find((token) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token));
  return program ? program.replace(/^["']|["']$/g, '') : null;
}

/**
 * False only when the command's program certainly does not exist (not a builtin, not a file, not on
 * PATH). Used after a failure: cmd.exe reports a missing program with exit code 1, indistinguishable
 * from a failing test run, and its message is localised.
 */
export function programExists(command: string, cwd: string): boolean {
  const program = firstProgram(command);
  if (!program || BUILTINS.has(program.toLowerCase())) return true;
  if (/[\\/]/.test(program)) {
    const extensions = process.platform === 'win32' ? ['', '.cmd', '.exe', '.bat'] : [''];
    return extensions.some((extension) => existsSync(resolve(cwd, `${program}${extension}`)));
  }
  const probe =
    process.platform === 'win32'
      ? spawnSync('where.exe', [program], { cwd, stdio: 'ignore' })
      : spawnSync('sh', ['-c', 'command -v "$1"', 'sh', program], { cwd, stdio: 'ignore' });
  return probe.status === 0;
}

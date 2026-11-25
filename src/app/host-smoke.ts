import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IsolationProfile, NetworkPolicy } from '../core/isolation';
import type { AdapterId } from '../registry';
import { runPlan } from './plan';
import { approveRun, createRun, deliverRun, reportRun, type DeliveryOutcome } from './runs';
import { runSetup } from './setup';

/**
 * Bounded smoke test of plan delivery to an installed host CLI (W2.0-15). It follows the product's
 * own path in a new temporary project: git init, setup, plan, run, approval, delivery, report. It
 * calls the host's real model, so it uses the account's quota; it never signs in.
 *
 *   npm run smoke:host -- --host codex [--timeout 600] [--isolation restricted] [--network deny]
 *   npm run smoke:host -- --host claude-code [--model haiku]
 *
 * PASS needs all of: the host delivered, at least one step event reached the run through
 * `run event`, every transcript line is JSON, the run's integrity is VERIFIED, and the run is not
 * reported as succeeded (no gate ran, so host completion must not count as success).
 */
const PACKAGE_ROOT = join(__dirname, '..', '..');
const CLI = join(PACKAGE_ROOT, 'bin', 'cli.js');
const TASK = 'Implement the orders API endpoint and build the orders page in the React app';
const STEP_EVENTS = new Set(['STEP_STARTED', 'STEP_PROGRESS', 'STEP_COMPLETED', 'STEP_FAILED', 'STEP_BLOCKED', 'APPROVAL_REQUIRED']);

export interface HostSmokeOptions {
  host: AdapterId;
  timeoutMs: number;
  /** Claude Code only: passed as ANTHROPIC_MODEL. Codex uses the model of the user's configuration. */
  model?: string;
  isolation?: { profile: IsolationProfile; network?: NetworkPolicy };
  signal?: AbortSignal;
  /** Directory the temporary project is created in (default: the OS temporary directory). */
  base?: string;
  /** Command prefix for step events; default runs this package's CLI with the current Node. */
  eventCommand?: (runId: string) => string;
}

export interface SmokeCheck {
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

export interface HostSmokeReport {
  host: AdapterId;
  verdict: 'PASS' | 'FAIL' | 'NOT_VERIFIED';
  project: string;
  runId: string;
  delivery: Pick<DeliveryOutcome, 'status' | 'reason' | 'signals' | 'transcript' | 'isolation' | 'usage'>;
  events: string[];
  result: { status: string; reason: string; integrity: string };
  checks: SmokeCheck[];
}

const quoted = (path: string): string => (/\s/.test(path) ? JSON.stringify(path) : path);

/** A git project with the toolkit installed for the host and one saved two-step plan. */
function smokeProject(options: HostSmokeOptions): { root: string; planId: string } {
  const root = mkdtempSync(join(options.base ?? tmpdir(), 'host-smoke-'));
  // Codex refuses to run outside a Git repository or trusted directory (verified on 0.172.0).
  spawnSync('git', ['init', '-q'], { cwd: root });
  runSetup({ root, adapters: [options.host], distDir: join(PACKAGE_ROOT, 'dist') });
  const { plan } = runPlan({ root, task: TASK, profileId: 'profile.starter', overrides: { domains: ['backend', 'frontend'] } });
  return { root, planId: plan.id };
}

function recordedEvents(root: string, runId: string): Array<{ type: string; source?: string; stepId?: string; reason?: string }> {
  const log = readFileSync(join(root, '.ai-agent-setup', 'runs', runId, 'events.jsonl'), 'utf8');
  return log.split('\n').filter(Boolean).map((line) => JSON.parse(line) as { type: string });
}

function invalidTranscriptLines(root: string, transcript: string | null): number {
  if (!transcript) return 0;
  return readFileSync(join(root, transcript), 'utf8').split('\n').filter((line) => {
    if (!line.trim()) return false;
    try {
      JSON.parse(line);
      return false;
    } catch {
      return true;
    }
  }).length;
}

export async function runHostSmoke(options: HostSmokeOptions): Promise<HostSmokeReport> {
  if (options.model && options.host === 'claude-code') process.env.ANTHROPIC_MODEL = options.model;
  const { root, planId } = smokeProject(options);
  const runId = approveRun(root, createRun(root, planId).runId, 'host-smoke').runId;
  const eventCommand = options.eventCommand?.(runId) ?? `${quoted(process.execPath)} ${quoted(CLI)} run event ${runId}`;
  const outcome = await deliverRun(root, runId, options.host, {
    eventCommand,
    timeoutMs: options.timeoutMs,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.isolation ? { isolation: options.isolation } : {}),
  });
  const { result } = reportRun(root, runId);
  const events = recordedEvents(root, runId);
  const stepEvents = events.filter((event) => event.source === 'host' && STEP_EVENTS.has(event.type));
  const invalid = invalidTranscriptLines(root, outcome.transcript);
  const check = (name: string, pass: boolean, detail: string): SmokeCheck => ({ name, status: pass ? 'PASS' : 'FAIL', detail });
  const checks = [
    check('delivered', outcome.status === 'DELIVERED', `${outcome.status}: ${outcome.reason}`),
    check('step-events', stepEvents.length > 0, `${stepEvents.length} step event(s) from the host`),
    check('transcript-json', outcome.transcript !== null && invalid === 0, outcome.transcript ? `${invalid} line(s) that are not JSON` : 'no transcript'),
    check('integrity', result.integrity.status === 'VERIFIED', `integrity ${result.integrity.status}, ${result.integrity.violations} violation(s)`),
    check('not-self-verified', result.status !== 'SUCCEEDED' && result.status !== 'OUTCOME_VERIFIED', `run ${result.status} without any gate run`),
  ];
  // A host that did not deliver (missing, timed out, cancelled) proves nothing either way.
  const verdict = checks.every((item) => item.status === 'PASS') ? 'PASS' : outcome.status === 'DELIVERED' ? 'FAIL' : 'NOT_VERIFIED';
  return {
    host: options.host,
    verdict,
    project: root,
    runId,
    delivery: { status: outcome.status, reason: outcome.reason, signals: outcome.signals, transcript: outcome.transcript, ...(outcome.isolation ? { isolation: outcome.isolation } : {}), ...(outcome.usage ? { usage: outcome.usage } : {}) },
    events: events.map((event) => [event.type, event.stepId, event.reason?.slice(0, 160)].filter(Boolean).join(' ')),
    result: { status: result.status, reason: result.reason, integrity: result.integrity.status },
    checks,
  };
}

function argument(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

export function parseSmokeArgs(args: string[]): Omit<HostSmokeOptions, 'signal'> {
  const host = argument(args, 'host');
  if (host !== 'claude-code' && host !== 'codex') throw new Error('--host must be claude-code or codex');
  const seconds = Number(argument(args, 'timeout') ?? 600);
  if (!Number.isInteger(seconds) || seconds <= 0) throw new Error('--timeout must be a positive number of seconds');
  const profile = argument(args, 'isolation');
  if (profile !== undefined && profile !== 'none' && profile !== 'restricted') throw new Error('--isolation must be none or restricted');
  const network = argument(args, 'network');
  if (network !== undefined && network !== 'allow' && network !== 'deny') throw new Error('--network must be allow or deny');
  const model = argument(args, 'model');
  return {
    host,
    timeoutMs: seconds * 1000,
    ...(model ? { model } : {}),
    ...(profile && profile !== 'none' ? { isolation: { profile, network: { mode: network === 'deny' ? 'deny-all' : 'allow-all' } } } : {}),
  };
}

if (require.main === module) {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  runHostSmoke({ ...parseSmokeArgs(process.argv.slice(2)), signal: controller.signal })
    .then((report) => {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exitCode = report.verdict === 'PASS' ? 0 : 1;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    });
}

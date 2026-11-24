import { resolve } from 'node:path';
import { listGates, readGateHistory, runQualityGates } from '../app/gates';
import { approveRun, createRun, deliverRun, loadRun, recordEvent, reportRun, verifyStep, type EventInput } from '../app/runs';
import { renderGateReport } from '../quality';
import { single, UsageError, type ParsedArgs } from './args';
import type { Ask } from './create-config';
import { buildExecutionReport, renderExecutionReport } from '../app/reports';
import { buildIsolationPolicy, INBOX_ENV, queueInboxRequest, resolveExecutable } from '../app/isolation';
import { policyProblems, type IsolationProfile, type NetworkPolicy } from '../core/isolation';
import { capabilitiesFor, platformMatrix } from '../isolation';

interface IO {
  cwd: string;
  write: (text: string) => void;
  /** Interactive question; null when stdin is not a terminal. */
  ask?: Ask | null;
}

/**
 * Approvals are a person's decision (ADR-016, T11): they need an interactive terminal and the id
 * typed back. An agent's shell has no terminal, so it cannot approve, however the command is spelled.
 */
async function confirmByPerson(io: IO, what: string, expected: string): Promise<void> {
  if (!io.ask) throw new UsageError(`${what} needs an interactive terminal: approvals are made by a person, not by an agent or a script`);
  const answer = (await io.ask(`${what}: type ${expected} to confirm\n→ `)).trim();
  if (answer !== expected) throw new UsageError(`${what} not confirmed (expected ${expected})`);
}

/** Exit codes for verification commands: 0 PASS/SUCCEEDED, 1 FAIL, 2 NOT_VERIFIED, OUTCOME_VERIFIED or CANCELLED. */
const EXIT: Record<string, number> = { PASS: 0, SUCCEEDED: 0, FAIL: 1, FAILED: 1, NOT_VERIFIED: 2, CANCELLED: 2, OUTCOME_VERIFIED: 2 };

/** Free text may contain commas, which the parser splits on; join them back. */
const text = (args: ParsedArgs, name: string) => args.values.get(name)?.join(', ');
const root = (args: ParsedArgs, io: IO, positional?: string) => resolve(io.cwd, single(args, 'project') ?? positional ?? '.');
const json = (io: IO, value: unknown) => io.write(`${JSON.stringify(value, null, 2)}\n`);

export async function commandGates(args: ParsedArgs, io: IO): Promise<number> {
  const [action, dir] = args.positionals;
  const project = root(args, io, dir);
  const profileId = single(args, 'profile');
  if (action === 'list') {
    const listing = listGates(project, profileId);
    if (args.switches.has('json')) json(io, listing);
    else {
      io.write(`Profile ${listing.profile}\n`);
      for (const gate of listing.gates) io.write(`${gate.required ? '*' : ' '} ${gate.id.padEnd(26)} ${gate.category.padEnd(20)} ${gate.support.padEnd(15)} ${gate.command ?? `(no command: ${gate.source})`}\n`);
      for (const id of listing.unknownRequired) io.write(`* ${id.padEnd(26)} required by the profile but not in the gate registry: NOT_VERIFIED\n`);
      io.write('* = required\n');
    }
    return 0;
  }
  if (action === 'run') {
    const controller = new AbortController();
    const onInterrupt = () => controller.abort();
    process.once('SIGINT', onInterrupt);
    try {
      const runId = single(args, 'run');
      const outcome = await runQualityGates({
        root: project,
        gates: args.values.get('gate') ?? [],
        skip: args.values.get('skip') ?? [],
        signal: controller.signal,
        ...(runId ? { runId } : {}),
        ...(profileId ? { profileId } : {}),
      });
      if (args.switches.has('json')) json(io, outcome.report);
      else io.write(`${renderGateReport(outcome.report)}\nReport: ${outcome.reportPath}\n`);
      return EXIT[outcome.report.status]!;
    } finally {
      process.removeListener('SIGINT', onInterrupt);
    }
  }
  if (action === 'history') {
    const entries = readGateHistory(project, single(args, 'gate'));
    if (args.switches.has('json')) json(io, entries);
    else for (const entry of entries) io.write(`${entry.at} ${entry.runId} ${entry.gate} ${entry.status}${entry.reason ? ` — ${entry.reason}` : ''}\n`);
    return 0;
  }
  throw new UsageError('Usage: gates list|run|history [dir] [--gate ids] [--skip ids] [--run run-id] [--profile id] [--json]');
}

function eventInput(args: ParsedArgs): EventInput {
  const type = single(args, 'type');
  const allowed = ['STEP_STARTED', 'STEP_PROGRESS', 'APPROVAL_REQUIRED', 'STEP_COMPLETED', 'STEP_FAILED', 'STEP_BLOCKED'];
  if (!type || !allowed.includes(type)) throw new UsageError(`run event needs --type ${allowed.join('|')}`);
  const stepId = single(args, 'step');
  if (!stepId) throw new UsageError('run event needs --step <step-id>');
  const reason = text(args, 'reason')?.trim() ?? '';
  if (!reason && ['APPROVAL_REQUIRED', 'STEP_FAILED', 'STEP_BLOCKED'].includes(type)) throw new UsageError(`run event --type ${type} needs --reason "<why>"`);
  const evidence = args.values.get('evidence') ?? [];
  const extra: Record<string, unknown> = {
    STEP_PROGRESS: { message: text(args, 'message') ?? '' },
    APPROVAL_REQUIRED: { reason },
    STEP_COMPLETED: { gates: [], evidence },
    STEP_FAILED: { reason, evidence },
    STEP_BLOCKED: { reason },
  }[type] as Record<string, unknown> | undefined ?? {};
  // Events reported through the CLI come from the agent: never trusted as verification.
  return { type: type as EventInput['type'], source: 'host', stepId, ...extra };
}

export async function commandRun(args: ParsedArgs, io: IO): Promise<number> {
  const [action, id, stepId] = args.positionals;
  if (!action || !id) throw new UsageError('Usage: run create <plan-id> | approve|status|event|verify|approve-step|deliver|cancel <run-id> …');
  const project = root(args, io);
  switch (action) {
    case 'create': {
      const plan = createRun(project, id);
      io.write(`Created ${plan.runId} (revision ${plan.revision}, pending approval). Review .ai-agent-setup/runs/${plan.runId}/execution-plan.md, then: run approve ${plan.runId}\n`);
      return 0;
    }
    case 'approve': {
      await confirmByPerson(io, `Approve run ${id}`, id);
      const plan = approveRun(project, id, single(args, 'by') ?? 'user');
      io.write(`Approved ${plan.runId} revision ${plan.revision} (${plan.approval.digest}). The plan is now immutable.\n`);
      return 0;
    }
    case 'event': {
      // Inside an isolated launch the agent cannot read the key: the request goes to the
      // orchestrator's inbox, which validates and signs it (W2.2-09).
      const inbox = process.env[INBOX_ENV];
      if (inbox) {
        const { source: _source, ...request } = eventInput(args);
        queueInboxRequest(inbox, { runId: id, ...request });
        io.write('Queued for the orchestrator.\n');
        return 0;
      }
      const state = recordEvent(project, id, eventInput(args));
      const anomaly = state.anomalies.at(-1);
      io.write(anomaly && anomaly.eventId === state.processed.at(-1) ? `Recorded but not applied: ${anomaly.reason}\n` : 'Recorded.\n');
      return 0;
    }
    case 'approve-step': {
      if (!stepId) throw new UsageError('Usage: run approve-step <run-id> <step-id> [--decline]');
      const approved = !args.switches.has('decline');
      await confirmByPerson(io, `${approved ? 'Approve' : 'Decline'} step ${stepId}`, stepId);
      recordEvent(project, id, { type: 'APPROVAL_RESOLVED', source: 'user', stepId, approved, by: single(args, 'by') ?? 'user' });
      io.write(`${approved ? 'Approved' : 'Declined'} ${stepId}.\n`);
      return 0;
    }
    case 'verify': {
      if (!stepId) throw new UsageError('Usage: run verify <run-id> <step-id>');
      const { state, gates } = await verifyStep(project, id, stepId);
      for (const gate of gates) io.write(`${gate.gate}: ${gate.status}${gate.reason ? ` — ${gate.reason}` : ''}\n`);
      const step = state.steps[stepId]!;
      io.write(`${stepId}: ${step.state}${step.reason ? ` — ${step.reason}` : ''}\n`);
      return step.state === 'SUCCEEDED' ? 0 : step.state === 'FAILED' ? 1 : 2;
    }
    case 'cancel':
      recordEvent(project, id, { type: 'RUN_CANCELLED', source: 'user', reason: text(args, 'reason') ?? 'cancelled by user' });
      io.write(`Cancelled ${id}.\n`);
      return 0;
    case 'status': {
      const { result, changes } = reportRun(project, id);
      if (args.switches.has('json')) json(io, result);
      else {
        io.write(`${result.runId}: ${result.status} — ${result.reason}\n`);
        for (const step of result.steps) io.write(`  ${step.id}: ${step.final}${step.approval.pending ? ' (approval pending)' : ''}${step.reason ? ` — ${step.reason}` : ''}\n`);
        for (const anomaly of result.anomalies) io.write(`  ${anomaly.code ?? 'ignored'} ${anomaly.type} (${anomaly.eventId}): ${anomaly.reason}\n`);
        for (const waiting of result.deferred) io.write(`  waiting ${waiting.type} for ${waiting.stepId} (${waiting.eventId}): ${waiting.reason}\n`);
        if (changes.length) io.write(`Changed since the last report: ${changes.join('; ')}\n`);
      }
      return EXIT[result.status]!;
    }
    case 'deliver': {
      const host = single(args, 'host');
      if (!host) throw new UsageError('run deliver needs --host claude-code|codex');
      const seconds = single(args, 'timeout');
      const isolation = isolationOption(args);
      if (seconds !== undefined && !/^\d+$/.test(seconds)) throw new UsageError('--timeout must be a number of seconds');
      loadRun(project, id);
      const controller = new AbortController();
      const onInterrupt = () => controller.abort();
      process.once('SIGINT', onInterrupt);
      let outcome;
      try {
        outcome = await deliverRun(project, id, host, {
          dryRun: args.switches.has('dry-run'),
          signal: controller.signal,
          ...(seconds !== undefined ? { timeoutMs: Number(seconds) * 1000 } : {}),
          ...(text(args, 'event-command') ? { eventCommand: text(args, 'event-command')! } : {}),
          ...(isolation ? { isolation } : {}),
        });
      } finally {
        process.removeListener('SIGINT', onInterrupt);
      }
      if (args.switches.has('json')) json(io, outcome);
      else {
        io.write(`${outcome.status}: ${outcome.reason}\n$ ${outcome.invocation.executable} ${outcome.invocation.args.map((arg) => (arg.includes('\n') ? '<prompt>' : arg)).join(' ')}\n`);
        for (const item of outcome.invocation.unsupported) io.write(`  unsupported: ${item}\n`);
        if (outcome.transcript) io.write(`  transcript: ${outcome.transcript}\n`);
        if (outcome.usage) {
          const { tokens, samples, cost } = outcome.usage;
          const counts = `input ${tokens.input}, output ${tokens.output}, cache read ${tokens.cacheRead}, cache write ${tokens.cacheWrite}`;
          io.write(`  usage: ${samples ? `${counts} (measured)` : `none in the ${host} stream`}; cost: ${cost ? `${cost.usd} USD (${cost.label}: ${cost.basis})` : 'not reported by the host'}\n`);
        }
        if (outcome.isolation) {
          const applied = outcome.isolation;
          io.write(`  isolation: requested ${applied.requested}, applied ${applied.applied} (${applied.provider} on ${applied.platform}, network ${applied.network})\n`);
          io.write(`    enforced: ${applied.enforced.join(', ')}\n`);
          for (const item of applied.notEnforced) io.write(`    not enforced: ${item.control} (${item.reason})\n`);
          for (const item of applied.refused) io.write(`    refused agent request: ${item.reason}\n`);
        } else io.write('  isolation: none (the agent ran as a normal process of this user)\n');
      }
      return outcome.status === 'NOT_VERIFIED' || outcome.status === 'CANCELLED' ? 2 : 0;
    }
    default:
      throw new UsageError(`Unknown run action "${action}"`);
  }
}

const PROFILES: readonly IsolationProfile[] = ['none', 'restricted', 'isolated'];

function networkOption(args: ParsedArgs): NetworkPolicy | undefined {
  const value = single(args, 'network');
  if (value === undefined) return undefined;
  if (value === 'allow') return { mode: 'allow-all' };
  if (value === 'deny') return { mode: 'deny-all' };
  if (value.startsWith('allow:')) return { mode: 'allowlist', hosts: value.slice('allow:'.length).split('+').filter(Boolean) };
  throw new UsageError('--network must be allow, deny or allow:<host>+<host>');
}

function isolationOption(args: ParsedArgs): { profile: IsolationProfile; network?: NetworkPolicy; passEnv?: string[] } | undefined {
  const profile = single(args, 'isolation');
  if (profile === undefined) {
    if (single(args, 'network') !== undefined || args.values.has('pass-env')) throw new UsageError('--network and --pass-env need --isolation restricted or isolated');
    return undefined;
  }
  if (!(PROFILES as readonly string[]).includes(profile)) throw new UsageError(`--isolation must be one of ${PROFILES.join(', ')}`);
  const network = networkOption(args);
  // Extra variable names the agent may see (values are taken from this environment, never printed).
  const passEnv = args.values.get('pass-env');
  return { profile: profile as IsolationProfile, ...(network ? { network } : {}), ...(passEnv?.length ? { passEnv } : {}) };
}

/** `report`: execution runs and gate history aggregated from local artifacts (read-only). */
export function commandReport(args: ParsedArgs, io: IO): number {
  const [dir] = args.positionals;
  const since = single(args, 'since');
  const report = buildExecutionReport(root(args, io, dir), since === undefined ? {} : { since });
  if (args.switches.has('json')) json(io, report);
  else io.write(renderExecutionReport(report));
  return 0;
}

/** `isolation check`: platform matrix, provider capabilities and whether a profile can start here (exit 2 if not). */
export function commandIsolation(args: ParsedArgs, io: IO): number {
  const [action] = args.positionals;
  if (action !== 'check') throw new UsageError('Usage: isolation check [--isolation none|restricted|isolated] [--network allow|deny] [--host claude-code|codex] [--json]');
  const profile = (single(args, 'isolation') ?? 'restricted') as IsolationProfile;
  if (!(PROFILES as readonly string[]).includes(profile)) throw new UsageError(`--isolation must be one of ${PROFILES.join(', ')}`);
  const host = single(args, 'host') ?? 'claude-code';
  const network = networkOption(args) ?? { mode: 'allow-all' };
  const capabilities = capabilitiesFor(profile);
  const executable = resolveExecutable(host === 'codex' ? 'codex' : 'claude') ?? process.execPath;
  const policy = buildIsolationPolicy(root(args, io), { profile, network, host, executable });
  const problems = policyProblems(policy, capabilities);
  if (args.switches.has('json')) {
    json(io, { profile, network, platforms: platformMatrix(), capabilities, problems });
    return problems.length ? 2 : 0;
  }
  io.write('Platforms:\n');
  for (const row of platformMatrix()) io.write(`  ${row.platform.padEnd(8)} ${row.status.padEnd(13)} restricted: ${row.restricted}\n${' '.repeat(25)}isolated: ${row.isolated}\n`);
  io.write(`Requested: profile ${profile}, network ${network.mode}; provider ${capabilities.provider} on ${capabilities.platform}\n`);
  for (const [control, capability] of Object.entries(capabilities.controls)) io.write(`  ${control.padEnd(20)} ${capability.status.padEnd(12)} ${capability.reason}\n`);
  io.write(problems.length ? `Cannot start with this profile (nothing would run):\n${problems.map((item) => `  - ${item}`).join('\n')}\n` : `Profile ${profile} can be enforced here.\n`);
  return problems.length ? 2 : 0;
}

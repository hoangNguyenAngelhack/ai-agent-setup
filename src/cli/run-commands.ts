import { resolve } from 'node:path';
import { listGates, readGateHistory, runQualityGates } from '../app/gates';
import { approveRun, createRun, deliverRun, loadRun, recordEvent, reportRun, verifyStep, type EventInput } from '../app/runs';
import { renderGateReport } from '../quality';
import { single, UsageError, type ParsedArgs } from './args';
import type { Ask } from './create-config';

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
      loadRun(project, id);
      const seconds = single(args, 'timeout');
      if (seconds !== undefined && !/^\d+$/.test(seconds)) throw new UsageError('--timeout must be a number of seconds');
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
        });
      } finally {
        process.removeListener('SIGINT', onInterrupt);
      }
      if (args.switches.has('json')) json(io, outcome);
      else {
        io.write(`${outcome.status}: ${outcome.reason}\n$ ${outcome.invocation.executable} ${outcome.invocation.args.map((arg) => (arg.includes('\n') ? '<prompt>' : arg)).join(' ')}\n`);
        for (const item of outcome.invocation.unsupported) io.write(`  unsupported: ${item}\n`);
        if (outcome.transcript) io.write(`  transcript: ${outcome.transcript}\n`);
      }
      return outcome.status === 'NOT_VERIFIED' || outcome.status === 'CANCELLED' ? 2 : 0;
    }
    default:
      throw new UsageError(`Unknown run action "${action}"`);
  }
}

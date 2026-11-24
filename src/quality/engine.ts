import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { GateCategory, GateStatus } from '../core/contracts';
import { redactText } from '../shared/redact';
import { COVERAGE_METRICS, parseCoverageSummary, parseNpmAudit, scanDiff, scanFilesForSecrets } from './checks';
import { isNoOpCommand, programExists, runCommand, type CommandOutcome } from './execute';
import { gateById, type GateDefinition } from './gates';
import { missingCommandReason, resolveCommand, type GateConfig, type ProjectFacts } from './resolve';

export interface GateEvidenceItem {
  type: 'command' | 'artifact' | 'review-note';
  command?: string;
  exitCode?: number;
  startedAt?: string;
  durationMs?: number;
  artifact?: string;
  checksum?: string;
  summary?: Record<string, unknown>;
}

/** Contract `urn:ai-agent-setup:contracts:v1:gate-record`. */
export interface GateRecord {
  schemaVersion: 'gate-record/v1';
  runId: string;
  gate: string;
  gateVersion: string;
  category: GateCategory;
  project: { name: string; commit: string | null; dirty?: boolean };
  command: string | null;
  environment: { platform: string; arch: string; node: string; ci: boolean };
  startedAt: string;
  endedAt: string;
  durationMs: number;
  exitCode: number | null;
  status: GateStatus;
  measured: boolean;
  reason: string | null;
  evidence: GateEvidenceItem[];
  checksum: string | null;
}

export interface EvidenceSink {
  /** Stores redacted evidence text; returns its project-relative path and sha256 checksum. */
  write(gate: string, name: string, content: string): { path: string; checksum: string };
}

export interface GateRunContext {
  runId: string;
  root: string;
  project: GateRecord['project'];
  environment: GateRecord['environment'];
  facts: ProjectFacts;
  config: GateConfig;
  evidence: EvidenceSink;
  validate: (record: GateRecord) => { valid: boolean; errors: string[] };
  now?: () => Date;
  signal?: AbortSignal;
  exec?: typeof runCommand;
}

export interface GateRunRequest {
  gates: string[];
  /** Policy-required gates: the overall status is PASS only when every one of them is PASS. */
  required: string[];
  /** Skipped gates are reported NOT_VERIFIED, never PASS. */
  skip?: string[];
}

export interface GateReport {
  schemaVersion: 'gate-report/v1';
  runId: string;
  project: GateRecord['project'];
  startedAt: string;
  endedAt: string;
  status: GateStatus;
  reason: string;
  required: string[];
  records: GateRecord[];
  summary: Record<GateStatus, number>;
}

interface Outcome {
  status: GateStatus;
  reason: string | null;
  command: string | null;
  exitCode: number | null;
  evidence: GateEvidenceItem[];
  checksum: string | null;
}

type BaseOutcome = Omit<Outcome, 'status' | 'reason'>;

const notVerified = (reason: string, command: string | null = null, extra: Partial<Outcome> = {}): Outcome => ({
  status: 'NOT_VERIFIED',
  reason,
  command,
  exitCode: null,
  evidence: [],
  checksum: null,
  ...extra,
});

const MAX_SCAN_BYTES = 1024 * 1024;

/** Shell exit codes for a missing executable: POSIX sh 127, Windows cmd 9009. */
const COMMAND_NOT_FOUND = new Set([127, 9009]);

/** A failed command whose program is not installed proves nothing about the project: NOT_VERIFIED, not FAIL. */
function missingProgram(exitCode: number, command: string, cwd: string): boolean {
  if (COMMAND_NOT_FOUND.has(exitCode)) return true;
  return exitCode !== 0 && !programExists(command, cwd);
}

function interruptedReason(outcome: CommandOutcome, timeoutMs: number): string {
  if (outcome.interrupted === 'timeout') return `timed out after ${timeoutMs} ms`;
  if (outcome.interrupted === 'cancelled') return 'cancelled';
  return `could not start: ${outcome.error ?? 'unknown error'}`;
}

class GateRunner {
  private readonly now: () => Date;
  private readonly exec: typeof runCommand;

  constructor(private readonly ctx: GateRunContext) {
    this.now = ctx.now ?? (() => new Date());
    this.exec = ctx.exec ?? runCommand;
  }

  /** Runs the command and stores its redacted log as evidence. */
  private async execute(definition: GateDefinition, command: string, timeoutMs: number) {
    const started = this.now();
    const outcome = await this.exec(command, { cwd: this.ctx.root, timeoutMs, ...(this.ctx.signal ? { signal: this.ctx.signal } : {}) });
    const durationMs = Math.max(0, this.now().getTime() - started.getTime());
    const redacted = redactText(outcome.output);
    const header = `$ ${redactText(command).text}\n# exit code: ${outcome.exitCode ?? 'none'}${outcome.interrupted ? ` (${outcome.interrupted})` : ''}${outcome.truncated ? ' (output truncated)' : ''}\n`;
    const log = this.ctx.evidence.write(definition.id, 'log', `${header}${redacted.text}`);
    const evidence: GateEvidenceItem[] = [];
    if (outcome.exitCode !== null) evidence.push({ type: 'command', command: redactText(command).text, exitCode: outcome.exitCode, startedAt: started.toISOString(), durationMs });
    evidence.push({ type: 'artifact', artifact: log.path, checksum: log.checksum, summary: { redactions: redacted.redactions, truncated: outcome.truncated } });
    return { outcome, evidence, checksum: log.checksum, startedMs: started.getTime() };
  }

  /** Untracked, not ignored files (git diff does not show them); large files are skipped. */
  private async untrackedFiles(): Promise<Array<{ path: string; content: string }> | null> {
    const listing = await this.exec('git ls-files --others --exclude-standard -z', { cwd: this.ctx.root, timeoutMs: 60_000 });
    if (listing.exitCode !== 0) return null;
    return listing.output
      .split('\0')
      .filter(Boolean)
      .flatMap((path) => {
        try {
          const file = join(this.ctx.root, path);
          return statSync(file).size > MAX_SCAN_BYTES ? [] : [{ path, content: readFileSync(file, 'utf8') }];
        } catch {
          return [];
        }
      });
  }

  async run(definition: GateDefinition): Promise<Outcome> {
    const resolved = resolveCommand(definition, this.ctx.facts, this.ctx.config);
    if (!resolved.command) return notVerified(missingCommandReason(definition));
    if (this.ctx.signal?.aborted) return notVerified('cancelled', resolved.command);
    const { outcome, evidence, checksum, startedMs } = await this.execute(definition, resolved.command, resolved.timeoutMs);
    const base = { command: resolved.command, exitCode: outcome.exitCode, evidence, checksum };
    if (outcome.exitCode === null) return { ...base, status: 'NOT_VERIFIED', reason: interruptedReason(outcome, resolved.timeoutMs) };
    if (missingProgram(outcome.exitCode, resolved.command, this.ctx.root)) {
      return { ...base, status: 'NOT_VERIFIED', reason: `command not found (exit code ${outcome.exitCode}); install the tool or configure another command` };
    }

    if (resolved.source === 'built-in' && definition.check === 'secret-scan') return this.secretScan(base, outcome.output);
    if (resolved.source === 'built-in' && definition.check === 'npm-audit') return npmAudit(base, outcome.output);
    if (definition.check === 'coverage') return this.coverage(definition, base, startedMs);
    if (outcome.exitCode === 0 && isNoOpCommand(resolved.scriptBody ?? resolved.command)) {
      const what = resolved.scriptBody === undefined ? 'the command' : `the script (${redactText(resolved.scriptBody).text})`;
      return { ...base, status: 'NOT_VERIFIED', reason: `${what} performs no check; configure a command that verifies the project` };
    }
    if (definition.check && resolved.source === 'config') {
      // Allowed (for example a dedicated scanner), but never silent: the result says the built-in check did not run.
      const note = `built-in ${definition.check} replaced by the configured command`;
      evidence.push({ type: 'review-note', summary: { replacedBuiltIn: definition.check } });
      return outcome.exitCode === 0 ? { ...base, status: 'PASS', reason: note } : { ...base, status: 'FAIL', reason: `exit code ${outcome.exitCode}; ${note}` };
    }
    return outcome.exitCode === 0 ? { ...base, status: 'PASS', reason: null } : { ...base, status: 'FAIL', reason: `exit code ${outcome.exitCode}` };
  }

  /** Secret scan of tracked changes (the diff) and untracked files; locations only, never values. */
  private async secretScan(base: BaseOutcome, diff: string): Promise<Outcome> {
    if (base.exitCode !== 0) return { ...base, status: 'NOT_VERIFIED', reason: `git diff failed with exit code ${base.exitCode}; is this a git repository with a commit?` };
    const untracked = await this.untrackedFiles();
    if (!untracked) return { ...base, status: 'NOT_VERIFIED', reason: 'could not list untracked files with git' };
    const tracked = scanDiff(diff);
    const added = scanFilesForSecrets(untracked);
    const findings = [...tracked.findings, ...added.findings];
    const summary = {
      findings: findings.length,
      locations: findings.map((item) => `${item.file}:${item.line} (${item.kinds.join(', ')})`),
      untrackedFilesScanned: untracked.length,
      allowedByMarker: [...tracked.allowed, ...added.allowed],
    };
    base.evidence.push({ type: 'review-note', summary });
    if (findings.length) return { ...base, status: 'FAIL', reason: `${findings.length} possible secret(s) in uncommitted changes: ${summary.locations.join('; ')}` };
    return { ...base, status: 'PASS', reason: null };
  }

  /** Coverage needs a summary written by this run; a stale or missing file is NOT_VERIFIED. */
  private coverage(definition: GateDefinition, base: BaseOutcome, startedMs: number): Outcome {
    if (base.exitCode !== 0) return { ...base, status: 'FAIL', reason: `coverage command failed with exit code ${base.exitCode}` };
    const relative = this.ctx.config.gates?.[definition.id]?.artifact ?? 'coverage/coverage-summary.json';
    const file = isAbsolute(relative) ? relative : join(this.ctx.root, relative);
    let text: string;
    try {
      if (statSync(file).mtimeMs < startedMs - 2000) return { ...base, status: 'NOT_VERIFIED', reason: `${relative} was not updated by this run (stale)` };
      text = readFileSync(file, 'utf8');
    } catch {
      return { ...base, status: 'NOT_VERIFIED', reason: `${relative} not found; enable the json-summary coverage reporter` };
    }
    const totals = parseCoverageSummary(text);
    if (totals === null) return { ...base, status: 'NOT_VERIFIED', reason: `${relative} is not an Istanbul json-summary file with statements, branches, functions and measured lines` };
    const threshold = definition.threshold ?? 0;
    const copy = this.ctx.evidence.write(definition.id, 'coverage-summary.json', text);
    const evidence = [...base.evidence, { type: 'artifact' as const, artifact: copy.path, checksum: copy.checksum, summary: { ...totals, threshold } }];
    const below = COVERAGE_METRICS.filter((metric) => totals[metric] !== null && totals[metric] < threshold);
    const notApplicable = COVERAGE_METRICS.filter((metric) => totals[metric] === null);
    return below.length === 0
      ? { ...base, evidence, status: 'PASS', reason: notApplicable.length ? `nothing to cover for ${notApplicable.join(', ')} (not applicable)` : null }
      : { ...base, evidence, status: 'FAIL', reason: `coverage below ${threshold}%: ${below.map((metric) => `${metric} ${totals[metric]}%`).join(', ')}` };
  }
}

/** npm audit: high or critical vulnerabilities fail; output that is not a report is NOT_VERIFIED. */
function npmAudit(base: BaseOutcome, output: string): Outcome {
  const counts = parseNpmAudit(output);
  if (!counts) return { ...base, status: 'NOT_VERIFIED', reason: 'npm audit did not return a report (offline or registry error)' };
  base.evidence.push({ type: 'review-note', summary: { ...counts } });
  const blocking = counts.critical + counts.high;
  return blocking ? { ...base, status: 'FAIL', reason: `${counts.critical} critical and ${counts.high} high vulnerabilities` } : { ...base, status: 'PASS', reason: null };
}

function composite(definition: GateDefinition, records: GateRecord[]): Outcome {
  const parts = (definition.requires ?? []).map((id) => records.find((record) => record.gate === id) ?? null);
  const missing = (definition.requires ?? []).filter((_, index) => !parts[index]);
  if (missing.length) return notVerified(`not run in this run: ${missing.join(', ')}`);
  const present = parts as GateRecord[];
  const evidence = present.flatMap((record) => record.evidence.filter((item) => item.type === 'artifact'));
  const failed = present.filter((record) => record.status === 'FAIL');
  if (failed.length) return { status: 'FAIL', reason: `failed: ${failed.map((record) => record.gate).join(', ')}`, command: null, exitCode: null, evidence, checksum: null };
  const open = present.filter((record) => record.status !== 'PASS');
  if (open.length) return notVerified(`not verified: ${open.map((record) => record.gate).join(', ')}`, null, { evidence });
  return { status: 'PASS', reason: null, command: null, exitCode: null, evidence, checksum: null };
}

function overall(required: string[], records: GateRecord[]): { status: GateStatus; reason: string } {
  if (required.length === 0) return { status: 'NOT_VERIFIED', reason: 'no required gates: nothing to verify' };
  const of = (status: GateStatus) => required.filter((id) => records.find((record) => record.gate === id)?.status === status);
  const failed = of('FAIL');
  if (failed.length) return { status: 'FAIL', reason: `required gates failed: ${failed.join(', ')}` };
  const passed = of('PASS');
  if (passed.length === required.length) return { status: 'PASS', reason: `all ${required.length} required gates passed` };
  return { status: 'NOT_VERIFIED', reason: `required gates not verified: ${required.filter((id) => !passed.includes(id)).join(', ')}` };
}

/**
 * Quality Gate Engine (V2.2): runs gates, keeps evidence, validates every record against the
 * contract and reports PASS only when every required gate passed with executed evidence.
 */
export async function runGates(request: GateRunRequest, ctx: GateRunContext): Promise<GateReport> {
  const now = ctx.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const skip = new Set(request.skip ?? []);
  const wanted = [...new Set([...request.required, ...request.gates])];
  const withDeps = [...new Set(wanted.flatMap((id) => [...(gateById(id)?.requires ?? []), id]))];
  const ordered = [...withDeps.filter((id) => gateById(id)?.support !== 'composite'), ...withDeps.filter((id) => gateById(id)?.support === 'composite')];
  const runner = new GateRunner(ctx);
  const records: GateRecord[] = [];

  for (const id of ordered) {
    const definition = gateById(id);
    const gateStart = now();
    let outcome: Outcome;
    if (!definition) outcome = notVerified(`unknown gate ${id}: not in the gate registry`);
    else if (skip.has(id)) outcome = notVerified(request.required.includes(id) ? 'skipped by user; a required gate cannot pass without running' : 'skipped by user');
    else if (ctx.signal?.aborted) outcome = notVerified('cancelled');
    else if (definition.support === 'composite') outcome = composite(definition, records);
    else outcome = await runner.run(definition);
    const end = now();
    const record: GateRecord = {
      schemaVersion: 'gate-record/v1',
      runId: ctx.runId,
      gate: id,
      gateVersion: definition?.version ?? '0.0.0',
      category: definition?.category ?? 'build',
      project: ctx.project,
      command: outcome.command === null ? null : redactText(outcome.command).text,
      environment: ctx.environment,
      startedAt: gateStart.toISOString(),
      endedAt: end.toISOString(),
      durationMs: Math.max(0, end.getTime() - gateStart.getTime()),
      exitCode: outcome.exitCode,
      status: outcome.status,
      measured: outcome.status !== 'NOT_VERIFIED',
      reason: outcome.reason,
      evidence: outcome.evidence,
      checksum: outcome.checksum,
    };
    const check = ctx.validate(record);
    if (!check.valid) {
      const downgraded: GateRecord = { ...record, status: 'NOT_VERIFIED', measured: false, reason: `record failed contract validation: ${check.errors.join('; ')}` };
      const recheck = ctx.validate(downgraded);
      if (!recheck.valid) throw new Error(`Gate record for ${id} is invalid: ${recheck.errors.join('; ')}`);
      records.push(downgraded);
    } else records.push(record);
  }

  const summary = { PASS: 0, FAIL: 0, NOT_VERIFIED: 0 } as Record<GateStatus, number>;
  for (const record of records) summary[record.status] += 1;
  return { schemaVersion: 'gate-report/v1', runId: ctx.runId, project: ctx.project, startedAt, endedAt: now().toISOString(), ...overall(request.required, records), required: request.required, records, summary };
}

/** What JSON Schema cannot express: totals and the overall status must follow from the records. */
export function gateReportErrors(report: GateReport): string[] {
  const errors: string[] = [];
  for (const status of ['PASS', 'FAIL', 'NOT_VERIFIED'] as const) {
    const actual = report.records.filter((record) => record.status === status).length;
    if (report.summary[status] !== actual) errors.push(`/summary/${status}: ${report.summary[status]} but ${actual} record(s)`);
  }
  for (const record of report.records) if (record.runId !== report.runId) errors.push(`/records: ${record.gate} belongs to run ${record.runId}`);
  const missing = report.required.filter((id) => !report.records.some((record) => record.gate === id));
  if (missing.length) errors.push(`/required: no record for ${missing.join(', ')}`);
  const expected = overall(report.required, report.records).status;
  if (report.status !== expected) errors.push(`/status: ${report.status} but the required gates give ${expected}`);
  return errors;
}

/** Markdown summary of a gate report. */
export function renderGateReport(report: GateReport): string {
  const lines = [
    `# Quality gates ${report.runId}: ${report.status}`,
    '',
    `- Project: ${report.project.name} @ ${report.project.commit ?? 'no commit'}${report.project.dirty ? ' (uncommitted changes)' : ''}`,
    `- Reason: ${report.reason}`,
    `- PASS ${report.summary.PASS} · FAIL ${report.summary.FAIL} · NOT_VERIFIED ${report.summary.NOT_VERIFIED}`,
    '',
    '| Gate | Required | Status | Duration | Reason |',
    '|---|---|---|---|---|',
    ...report.records.map((record) => `| ${record.gate} | ${report.required.includes(record.gate) ? 'yes' : 'no'} | ${record.status} | ${record.durationMs} ms | ${record.reason ?? ''} |`),
  ];
  return `${lines.join('\n')}\n`;
}

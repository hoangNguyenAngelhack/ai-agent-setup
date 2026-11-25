import { tokenCount, type TokenCounts, type UsageSample } from '../../core/evaluation';
import type { ExecutionPlan } from '../../core/execution';

/**
 * Plan delivery to a host CLI (W2.1-10, ADR-009). The host receives the exact approved revision by
 * reference and reports run-level signals through its native structured output. Step progress is
 * reported by the agent through the toolkit CLI and stays unverified until the orchestrator runs
 * the step's gates. No proprietary runtime: the host runs its own agent loop.
 */
export interface DeliveryFiles {
  /** Absolute path of the project root, the host's working directory. */
  projectRoot: string;
  /** Project-relative path of execution-plan.json. */
  planPath: string;
  /** Command prefix the agent uses to report step events, e.g. `npx create-ai-agent-setup run event <run-id>`. */
  eventCommand: string;
}

export interface Invocation {
  executable: string;
  args: string[];
  /** Capabilities of the protocol that this host cannot provide; reported, never assumed. */
  unsupported: string[];
}

/** A run-level signal read from the host's native event stream. */
export type HostSignal = { kind: 'started' | 'completed' } | { kind: 'failed'; reason: string };

export interface HostDelivery {
  host: 'claude-code' | 'codex';
  executable: string;
  invocation(plan: ExecutionPlan, files: DeliveryFiles): Invocation;
  /** Parses one stdout line; null for lines that carry no run-level signal. */
  parseLine(line: string): HostSignal | null;
  /**
   * Token usage carried by one raw stdout line (W2.2-04); null when there is none. Read before the
   * line is redacted for the transcript: the redaction rules erase every `*_tokens` value.
   */
  parseUsage(line: string): UsageSample | null;
  /**
   * A plain prompt run for the benchmark (W2.2-02): the same structured stream, the given model, no
   * plan. Flags follow the published docs and are NOT verified on an installed CLI.
   */
  promptInvocation(prompt: string, model: string): { executable: string; args: string[] };
}

/** Same instructions for every host; the plan file is the source of truth, not this text. */
export function deliveryPrompt(plan: ExecutionPlan, files: DeliveryFiles): string {
  const steps = plan.steps.map((step) => `- ${step.id} (agent ${step.agent}; after: ${step.dependsOn.join(', ') || 'nothing'}; approval: ${step.approval})`);
  return [
    `Execute run ${plan.runId}, revision ${plan.revision}, approved plan digest ${plan.approval.digest}.`,
    // Seen on Claude Code 2.1.332: with relative paths alone, the model resolved the plan path
    // against the directory of the CLI named in the event command and read the wrong file.
    `The project root is your working directory: ${files.projectRoot}. Every path below is relative to it.`,
    `Read ${files.planPath}. It is the only scope: do not add, remove or reorder steps. If the scope must change, stop and say so.`,
    'Steps:',
    ...steps,
    'For each step, in dependency order:',
    `1. Report the start: ${files.eventCommand} --type STEP_STARTED --step <step-id>`,
    `2. If the step needs approval, report it and stop: ${files.eventCommand} --type APPROVAL_REQUIRED --step <step-id> --reason "<why>"`,
    `3. When done, report completion with evidence paths: ${files.eventCommand} --type STEP_COMPLETED --step <step-id> --evidence <paths>`,
    `   On failure: ${files.eventCommand} --type STEP_FAILED --step <step-id> --reason "<why>" --evidence <paths>`,
    '   If blocked (missing tool, access, information): --type STEP_BLOCKED --reason "<why>".',
    'Your completion report is not verification: the orchestrator runs the quality gates. Never claim a step passed.',
    'Never print secrets, tokens or personal data.',
    'Do not create, edit or delete anything under .ai-agent-setup/: the toolkit writes it, and the policy hook blocks it.',
  ].join('\n');
}

/** Lines that are not JSON objects are ignored (hosts may print diagnostics). */
export function jsonLine(line: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(line);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Token counts from a host usage object, by host field name; fields that are not counts are left out. */
export function usageCounts(usage: unknown, fields: Partial<Record<keyof TokenCounts, string>>): Partial<TokenCounts> | null {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return null;
  const counts: Partial<TokenCounts> = {};
  for (const [kind, field] of Object.entries(fields) as Array<[keyof TokenCounts, string]>) {
    const count = tokenCount((usage as Record<string, unknown>)[field]);
    if (count !== undefined) counts[kind] = count;
  }
  return Object.keys(counts).length ? counts : null;
}

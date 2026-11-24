import type { GateStatus, Plan, RiskLevel } from '../contracts';

/**
 * Canonical execution artifacts (ADR-009). Stored under `.ai-agent-setup/runs/<run-id>/`; the
 * orchestrator owns the state, hosts only report events.
 */
export type StepState =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'NOT_VERIFIED';

export const STEP_STATES: readonly StepState[] = ['PENDING', 'READY', 'RUNNING', 'WAITING_FOR_APPROVAL', 'SUCCEEDED', 'FAILED', 'BLOCKED', 'SKIPPED', 'CANCELLED', 'NOT_VERIFIED'];

export interface ToolPermissions {
  allow: string[];
  approvalRequired: string[];
  denied: string[];
}

export interface ExecutionStep {
  /** Stable across revisions: the capability id the step performs. */
  id: string;
  capability: string;
  agent: string;
  phase: string;
  dependsOn: string[];
  inputs: string[];
  expectedOutputs: string[];
  /** Gate ids that must PASS (run by the orchestrator) for the step to succeed. */
  verification: string[];
  permissions: ToolPermissions;
  risk: RiskLevel;
  approval: 'none' | 'required';
}

export interface ExecutionPlan {
  schemaVersion: 'execution-plan/v1';
  runId: string;
  planId: string;
  /** 1 for the first plan of a run; a scope change after approval produces revision + 1. */
  revision: number;
  /** Digest of the revision this one replaces, or null. */
  supersedes: string | null;
  project: { name: string; commit: string | null };
  /** Profile whose required gates verify steps that have no gates of their own. */
  profile: string;
  objective: string;
  assumptions: string[];
  domains: string[];
  capabilities: string[];
  agents: string[];
  skills: string[];
  steps: ExecutionStep[];
  permissions: ToolPermissions;
  risk: { level: RiskLevel; reasons: string[] };
  approvals: { plan: 'required'; steps: string[] };
  estimatedCost: Plan['explain']['cost'];
  /** Set by approval only; not part of the digest. */
  approval: { status: 'pending' | 'approved'; by: string | null; at: string | null; digest: string | null };
}

export interface GateOutcome {
  gate: string;
  status: GateStatus;
  reason: string | null;
}

interface EventBase {
  eventId: string;
  runId: string;
  /** Digest of the approved revision the event belongs to. */
  planDigest: string;
  at: string;
  /** Gate results are trusted only from the orchestrator (it runs the gates). */
  source: 'orchestrator' | 'host' | 'user';
}

type StepEvent<T extends string, Extra = object> = EventBase & { type: T; stepId: string } & Extra;
type RunEvent<T extends string, Extra = object> = EventBase & { type: T } & Extra;

export type ExecutionEvent =
  | RunEvent<'RUN_STARTED'>
  | StepEvent<'STEP_STARTED'>
  | StepEvent<'STEP_PROGRESS', { message: string }>
  | StepEvent<'APPROVAL_REQUIRED', { reason: string }>
  | StepEvent<'APPROVAL_RESOLVED', { approved: boolean; by: string }>
  | StepEvent<'STEP_COMPLETED', { gates: GateOutcome[]; evidence: string[] }>
  | StepEvent<'STEP_FAILED', { reason: string; evidence: string[] }>
  | StepEvent<'STEP_BLOCKED', { reason: string }>
  | RunEvent<'RUN_COMPLETED'>
  | RunEvent<'RUN_FAILED', { reason: string }>
  | RunEvent<'RUN_CANCELLED', { reason: string }>;

export type ExecutionEventType = ExecutionEvent['type'];

export const EXECUTION_EVENT_TYPES: readonly ExecutionEventType[] = [
  'RUN_STARTED',
  'STEP_STARTED',
  'STEP_PROGRESS',
  'APPROVAL_REQUIRED',
  'APPROVAL_RESOLVED',
  'STEP_COMPLETED',
  'STEP_FAILED',
  'STEP_BLOCKED',
  'RUN_COMPLETED',
  'RUN_FAILED',
  'RUN_CANCELLED',
];

export interface StepRecord {
  id: string;
  state: StepState;
  reason: string | null;
  approved: boolean;
  gates: GateOutcome[];
  evidence: string[];
  lastProgress: string | null;
  /** Accepted step events reported by the host (agent), e.g. `STEP_STARTED`: execution evidence. */
  reports: string[];
  history: Array<{ eventId: string; from: StepState; to: StepState }>;
}

export interface ExecutionState {
  schemaVersion: 'execution-state/v1';
  runId: string;
  planDigest: string;
  revision: number;
  run: 'PENDING' | 'RUNNING' | 'HOST_COMPLETED' | 'FAILED' | 'CANCELLED';
  runReason: string | null;
  steps: Record<string, StepRecord>;
  processed: string[];
  /** Events that were rejected or ignored, with why; never silently dropped. */
  anomalies: Array<{ eventId: string; type: string; reason: string }>;
}

/**
 * SUCCEEDED: every step's outcome passed its gates AND every step has execution evidence.
 * OUTCOME_VERIFIED: every outcome passed its gates, but at least one step has no execution evidence
 * (the product state is verified; that the assigned work was executed is not). Not success, not failure.
 */
export type RunStatus = 'SUCCEEDED' | 'OUTCOME_VERIFIED' | 'FAILED' | 'CANCELLED' | 'NOT_VERIFIED';

/** A step's place in the final report; `final` is always a terminal state (open steps → NOT_VERIFIED). */
export interface RunResultStep {
  id: string;
  capability: string;
  agent: string;
  /** State in the log when the result was produced. */
  state: StepState;
  final: Exclude<StepState, 'PENDING' | 'READY' | 'RUNNING' | 'WAITING_FOR_APPROVAL'>;
  reason: string | null;
  approval: { required: boolean; approved: boolean };
  /** Gate results recorded by the orchestrator: the outcome. */
  gates: GateOutcome[];
  evidence: string[];
  /**
   * Execution evidence: step events the host reported (and the orchestrator accepted). They show the
   * work was reported as done by this run, not that the report is true; the gates verify the outcome.
   */
  execution: { evidenced: boolean; reports: string[] };
}

/** Contract `urn:ai-agent-setup:contracts:v1:run-result` (catalog/schemas/run-result.schema.json). */
export interface RunResult {
  schemaVersion: 'run-result/v1';
  runId: string;
  planId: string;
  planDigest: string;
  revision: number;
  project: { name: string; commit: string | null };
  profile: string;
  generatedAt: string;
  approval: { by: string; at: string };
  status: RunStatus;
  reason: string;
  /** Run-level state from the event log (what the host and user reported). */
  run: ExecutionState['run'];
  steps: RunResultStep[];
  counts: Record<StepState, number>;
  verification: { stepsTotal: number; stepsSucceeded: number; stepsWithExecutionEvidence: number; gates: Record<GateStatus, number> };
  anomalies: ExecutionState['anomalies'];
}

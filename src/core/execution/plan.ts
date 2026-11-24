import { createHash } from 'node:crypto';
import type { Plan } from '../contracts';
import { phaseOf } from '../orchestration';
import type { ExecutionPlan, ExecutionStep } from './contracts';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined);
    return `{${entries.sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** sha256 of the plan content; the approval block is excluded so approving does not change it. */
export function planDigest(plan: ExecutionPlan): string {
  const { approval: _approval, ...content } = plan;
  return `sha256:${createHash('sha256').update(canonical(content)).digest('hex')}`;
}

function stepOf(plan: Plan, step: Plan['steps'][number]): ExecutionStep {
  return {
    id: step.id,
    capability: step.capability,
    agent: step.agent,
    phase: phaseOf(step.capability),
    dependsOn: [...step.dependsOn],
    inputs: ['objective', ...step.dependsOn.map((id) => `outputs of ${id}`)],
    expectedOutputs: [`work product for ${step.capability}`, ...step.gates.map((gate) => `${gate} result`)],
    verification: [...step.gates],
    permissions: { ...plan.explain.tools },
    risk: plan.classification.risk,
    approval: step.approval,
  };
}

export interface ExecutionPlanInput {
  runId: string;
  project: { name: string; commit: string | null };
}

/** Converts a routed plan into the canonical execution plan of a run (revision 1, pending approval). */
export function createExecutionPlan(plan: Plan, input: ExecutionPlanInput): ExecutionPlan {
  return {
    schemaVersion: 'execution-plan/v1',
    runId: input.runId,
    planId: plan.id,
    revision: 1,
    supersedes: null,
    project: input.project,
    profile: plan.profile,
    objective: plan.task,
    assumptions: [...plan.explain.assumptions],
    domains: plan.classification.domains.map((domain) => domain.id),
    capabilities: plan.steps.map((step) => step.capability),
    agents: [...plan.agents],
    skills: [...plan.skills],
    steps: plan.steps.map((step) => stepOf(plan, step)),
    permissions: { ...plan.explain.tools },
    risk: { level: plan.classification.risk, reasons: [...plan.classification.riskReasons] },
    approvals: { plan: 'required', steps: plan.steps.filter((step) => step.approval === 'required').map((step) => step.id) },
    estimatedCost: plan.explain.cost,
    approval: { status: 'pending', by: null, at: null, digest: null },
  };
}

export function approveExecutionPlan(plan: ExecutionPlan, by: string, at: string): ExecutionPlan {
  if (plan.approval.status === 'approved') throw new Error(`Revision ${plan.revision} of ${plan.runId} is already approved`);
  return { ...plan, approval: { status: 'approved', by, at, digest: planDigest(plan) } };
}

/** An approved plan is immutable: its content must still match the digest recorded at approval. */
export function assertApproved(plan: ExecutionPlan): string {
  if (plan.approval.status !== 'approved' || !plan.approval.digest) throw new Error(`Run ${plan.runId} revision ${plan.revision} is not approved`);
  const digest = planDigest(plan);
  if (digest !== plan.approval.digest) throw new Error(`Run ${plan.runId} revision ${plan.revision} changed after approval; create a new revision`);
  return digest;
}

/** A scope change after approval: a new pending revision that records the one it supersedes. */
export function reviseExecutionPlan(approved: ExecutionPlan, changed: Plan): ExecutionPlan {
  const digest = assertApproved(approved);
  const next = createExecutionPlan(changed, { runId: approved.runId, project: approved.project });
  return { ...next, revision: approved.revision + 1, supersedes: digest };
}

/** Human-readable view of the plan (execution-plan.md); the JSON file is the source of truth. */
export function renderExecutionPlan(plan: ExecutionPlan): string {
  const lines = [
    `# Execution plan ${plan.runId} (revision ${plan.revision})`,
    '',
    `- Objective: ${plan.objective}`,
    `- Plan: ${plan.planId}; approval: ${plan.approval.status}${plan.approval.digest ? ` (${plan.approval.digest})` : ''}`,
    `- Risk: ${plan.risk.level}${plan.risk.reasons.length ? ` — ${plan.risk.reasons.join('; ')}` : ''}`,
    `- Estimated cost: ${plan.estimatedCost.approxTokens} tokens (${plan.estimatedCost.label})`,
    '',
    '| Step | Agent | Phase | Depends on | Verification | Approval |',
    '|---|---|---|---|---|---|',
    ...plan.steps.map((step) => `| ${step.id} | ${step.agent} | ${step.phase} | ${step.dependsOn.join(', ') || '—'} | ${step.verification.join(', ') || '—'} | ${step.approval} |`),
  ];
  if (plan.assumptions.length) lines.push('', '## Assumptions', '', ...plan.assumptions.map((item) => `- ${item}`));
  return `${lines.join('\n')}\n`;
}

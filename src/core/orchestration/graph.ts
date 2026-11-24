/** Execution phases in order (docs/v2/05 §5 module 7). Steps in one phase may run in parallel. */
export const PHASES = ['define', 'design', 'architect', 'build-core', 'build-clients', 'verify', 'review', 'release', 'document'] as const;
export type Phase = (typeof PHASES)[number];

const PHASE_BY_DOMAIN: Record<string, Phase> = {
  'product-business': 'define',
  'design-ux': 'design',
  'architecture-leadership': 'architect',
  backend: 'build-core',
  'data-ai': 'build-core',
  frontend: 'build-clients',
  mobile: 'build-clients',
  'integration-automation': 'build-clients',
  quality: 'verify',
  'security-compliance': 'review',
  'devops-sre': 'release',
  'docs-devex': 'document',
};

/** Capabilities whose phase differs from their domain's. */
const PHASE_BY_CAPABILITY: Record<string, Phase> = {
  'architecture-leadership.code-review': 'review',
  'architecture-leadership.technical-debt-management': 'review',
  'security-compliance.threat-modeling': 'architect',
  'security-compliance.secure-coding': 'build-core',
  'quality.test-strategy': 'architect',
  'quality.test-planning': 'architect',
  'data-ai.data-modeling': 'architect',
};

export function phaseOf(capabilityId: string): Phase {
  return PHASE_BY_CAPABILITY[capabilityId] ?? PHASE_BY_DOMAIN[capabilityId.split('.')[0]!] ?? 'build-core';
}

export interface ExecutionGraph {
  /** Step ids in a valid execution order. */
  order: string[];
  /** Non-empty phases in order; steps inside a phase do not depend on each other. */
  phases: Array<{ name: Phase; steps: string[] }>;
  dependsOn: Record<string, string[]>;
}

/**
 * Workflow Orchestrator, static part (W2.1-09): orders steps by phase and makes every step depend
 * on the steps of the previous non-empty phase, so cross-domain work runs in a safe order
 * (API before UI, implementation before tests, tests before release).
 */
export function buildExecutionGraph(steps: ReadonlyArray<{ id: string; capability: string }>): ExecutionGraph {
  const phases = PHASES.map((name) => ({ name, steps: steps.filter((step) => phaseOf(step.capability) === name).map((step) => step.id) })).filter(
    (phase) => phase.steps.length > 0,
  );
  const dependsOn: Record<string, string[]> = {};
  phases.forEach((phase, index) => {
    for (const step of phase.steps) dependsOn[step] = index === 0 ? [] : [...phases[index - 1]!.steps];
  });
  return { order: phases.flatMap((phase) => phase.steps), phases, dependsOn };
}

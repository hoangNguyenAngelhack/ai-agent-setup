import type { Plan, TaskClassification, TaskType } from '../contracts';

export interface LabelledTask {
  id: string;
  text: string;
  type: TaskType;
  domains: string[];
  simple: boolean;
}

export interface RoutingMetrics {
  tasks: number;
  domainPrecision: number;
  domainRecall: number;
  /** Share of tasks whose highest-scored domain is one of the expected domains. */
  topDomainAccuracy: number;
  /** Domain recall on tasks labelled with more than one domain. */
  multiDomainRecall: number;
  typeAccuracy: number;
  /** Share of tasks labelled simple that were routed with <= 1 agent and <= 3 skills (docs/v2/09 §4). */
  minimality: number;
  failures: string[];
  /** Per task: type, domains (exact set), topDomain, and minimality for tasks labelled simple. */
  outcomes: Record<string, Record<string, boolean>>;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Routing evaluation (Evaluation Engine, docs/v2/05 §5 module 11; docs/v2/09 §4). Pure: the caller
 * supplies the classifier and router, so the same function serves tests and reports.
 */
export function evaluateRouting(
  tasks: readonly LabelledTask[],
  classify: (text: string) => TaskClassification,
  route: (text: string, classification: TaskClassification) => Plan,
): RoutingMetrics {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let multiTruePositive = 0;
  let multiFalseNegative = 0;
  let topDomain = 0;
  let typeCorrect = 0;
  let simpleTotal = 0;
  let simpleMinimal = 0;
  const failures: string[] = [];
  const outcomes: RoutingMetrics['outcomes'] = {};

  for (const task of tasks) {
    const checks: Record<string, boolean> = {};
    outcomes[task.id] = checks;
    const classification = classify(task.text);
    const got = new Set(classification.domains.map((domain) => domain.id));
    const want = new Set(task.domains);
    for (const id of got) {
      if (want.has(id)) truePositive += 1;
      else falsePositive += 1;
    }
    for (const id of want) {
      if (got.has(id)) continue;
      falseNegative += 1;
      if (task.domains.length > 1) multiFalseNegative += 1;
    }
    if (task.domains.length > 1) multiTruePositive += [...want].filter((id) => got.has(id)).length;
    checks.topDomain = Boolean(classification.domains[0] && want.has(classification.domains[0].id));
    if (checks.topDomain) topDomain += 1;
    checks.type = classification.type === task.type;
    if (checks.type) typeCorrect += 1;
    else failures.push(`${task.id} type: expected ${task.type}, got ${classification.type}`);
    checks.domains = [...want].every((id) => got.has(id)) && [...got].every((id) => want.has(id));
    if (!checks.domains) failures.push(`${task.id} domains: expected ${task.domains.join(',')}, got ${[...got].join(',') || 'none'}`);
    if (task.simple) {
      simpleTotal += 1;
      const plan = route(task.text, classification);
      checks.minimality = plan.agents.length <= 1 && plan.skills.length <= 3;
      if (checks.minimality) simpleMinimal += 1;
      else failures.push(`${task.id} minimality: ${plan.agents.length} agent(s), ${plan.skills.length} skill(s)`);
    }
  }

  return {
    tasks: tasks.length,
    domainPrecision: round(truePositive / Math.max(truePositive + falsePositive, 1)),
    domainRecall: round(truePositive / Math.max(truePositive + falseNegative, 1)),
    topDomainAccuracy: round(topDomain / Math.max(tasks.length, 1)),
    multiDomainRecall: round(multiTruePositive / Math.max(multiTruePositive + multiFalseNegative, 1)),
    typeAccuracy: round(typeCorrect / Math.max(tasks.length, 1)),
    minimality: round(simpleMinimal / Math.max(simpleTotal, 1)),
    failures,
    outcomes,
  };
}

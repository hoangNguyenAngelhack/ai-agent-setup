import type { AgentEntry, CapabilityEntry, CatalogEntry, KnowledgeIndex, PolicyDocument, ProfileEntry, Registry, RuleEntry } from '../../registry';
import { matchesAnyGlob } from '../../shared/glob';
import { selectProfileEntries } from '../context';
import type {
  ContextItem,
  ExplainRecord,
  ImpactReport,
  Plan,
  PlanMode,
  PlanOverrides,
  PlanStep,
  ProjectProfile,
  TaskClassification,
  TaskType,
} from '../contracts';
import { buildExecutionGraph, PHASES, phaseOf } from '../orchestration';
import { PolicyEngine } from '../policy';
import { mergeImpact } from './impact-merge';

export interface RouteInput {
  id: string;
  task: string;
  mode: PlanMode;
  classification: TaskClassification;
  registry: Registry;
  knowledge: KnowledgeIndex;
  profile: ProfileEntry;
  policies: PolicyDocument[];
  /** null when the plan is made outside a detected project. */
  project: ProjectProfile | null;
  overrides: PlanOverrides;
  /** Measured always-loaded catalog bytes for the profile (Context Engine). */
  contextT0Bytes: number;
  /** Changed files analysed by Impact Analysis, when known. */
  impact?: ImpactReport | null;
}

const SIMPLE_MAX_SKILLS = 3;
const MAX_SKILLS = 6;
const MAX_CAPABILITIES = 6;
const SAME_DOMAIN_SHARE = 0.6;
const SECOND_CAPABILITY_SHARE = 0.8;
const BYTES_PER_TOKEN = 4;
const CODE_CHANGING: ReadonlySet<TaskType> = new Set(['feature', 'bug', 'refactor', 'test', 'ops']);
/** When the task text has no type cue, the owner of the main capability decides the type. */
const TYPE_BY_AGENT: Record<string, TaskType> = {
  'agent.analyst': 'analysis',
  'agent.designer': 'analysis',
  'agent.architect': 'analysis',
  'agent.writer': 'docs',
  'agent.reviewer': 'review',
  'agent.security-auditor': 'review',
  'agent.tester': 'test',
  'agent.operator': 'ops',
  'agent.implementer': 'feature',
};
const WORKFLOW_BY_TYPE: Partial<Record<TaskType, string>> = {
  feature: 'wf.build',
  bug: 'wf.fix-issue',
  refactor: 'wf.simplify',
  test: 'wf.test',
  review: 'wf.review',
};

/** Accumulates the plan and its explanation while routing. */
class RouteState {
  readonly explain: ExplainRecord = {
    domains: [],
    agents: [],
    excluded: [],
    skills: [],
    rules: [],
    assumptions: [],
    tools: { allow: [], approvalRequired: [], denied: [] },
    cost: { contextBytes: 0, steps: 0, approxTokens: 0, label: 'estimated', basis: '' },
    verification: [],
    overrides: [],
    conflicts: [],
    context: [],
    impact: null,
  };
  blocking = false;
  needsApproval = false;

  conflict(message: string, blocking: boolean): void {
    this.explain.conflicts.push(message);
    if (blocking) this.blocking = true;
    else this.needsApproval = true;
  }

  override(field: string, value: unknown, effect: string): void {
    this.explain.overrides.push({ field, value, effect });
  }
}

function inProfile(input: RouteInput): Set<string> {
  return new Set(selectProfileEntries(input.registry, input.profile).map((entry) => entry.id));
}

function projectSignals(project: ProjectProfile | null): Set<string> {
  if (!project) return new Set();
  return new Set([...project.languages, ...project.frameworks, ...project.signals, ...project.buildTools, ...project.testRunners]);
}

function capabilityOf(registry: Registry, id: string): CapabilityEntry {
  return registry.get(id) as CapabilityEntry;
}

function domainsFor(input: RouteInput, state: RouteState): string[] {
  const requested = input.overrides.domains;
  if (!requested) {
    for (const domain of input.classification.domains) {
      state.explain.domains.push({ id: domain.id, confidence: domain.confidence, why: `matched ${domain.matched.concat(topTerms(input, domain.id)).slice(0, 6).join(', ') || 'capability terms'}` });
    }
    return input.classification.domains.map((domain) => domain.id);
  }
  const unknown = requested.filter((id) => input.registry.get(id)?.kind !== 'Domain');
  if (unknown.length > 0) state.conflict(`Unknown domain(s): ${unknown.join(', ')}`, true);
  const valid = requested.filter((id) => !unknown.includes(id));
  state.override('domains', requested, 'replaced the classified domains');
  for (const id of valid) state.explain.domains.push({ id, confidence: 1, why: 'selected by you' });
  return valid;
}

function topTerms(input: RouteInput, domainId: string): string[] {
  return input.classification.capabilities.filter((capability) => capability.id.startsWith(`${domainId}.`)).slice(0, 1).flatMap((capability) => capability.matched);
}

/** Minimal capability set (05 §7.3 step 2): one owner for simple tasks, top 1–2 per domain otherwise. */
function selectCapabilities(input: RouteInput, domains: string[], state: RouteState): CapabilityEntry[] {
  const scored = input.classification.capabilities.filter((capability) => domains.includes(capability.id.split('.')[0]!));
  const picked: CapabilityEntry[] = [];
  for (const domainId of domains) {
    const ranked = scored.filter((capability) => capability.id.startsWith(`${domainId}.`));
    if (ranked.length === 0) {
      const domain = input.registry.get(domainId);
      const fallback = domain?.kind === 'Domain' ? domain.capabilities[0] : undefined;
      if (fallback) {
        picked.push(capabilityOf(input.registry, fallback));
        state.explain.assumptions.push(`No capability of ${domainId} matched the task; using ${fallback}`);
      }
      continue;
    }
    const top = ranked[0]!;
    const topEntry = capabilityOf(input.registry, top.id);
    picked.push(topEntry);
    if (input.classification.simple && !input.overrides.domains) {
      const owner = topEntry.defaultAgents[0];
      for (const next of ranked.slice(1)) {
        const entry = capabilityOf(input.registry, next.id);
        if (next.score >= top.score * SAME_DOMAIN_SHARE && entry.defaultAgents[0] === owner && picked.length < 3) picked.push(entry);
      }
    } else if (ranked[1] && ranked[1].score >= top.score * SECOND_CAPABILITY_SHARE) {
      picked.push(capabilityOf(input.registry, ranked[1].id));
    }
  }
  return picked.slice(0, MAX_CAPABILITIES);
}

function agentsDeclaring(registry: Registry, capabilityId: string): AgentEntry[] {
  return registry.list('Agent').filter((agent) => agent.aliasOf === null && agent.capabilities.includes(capabilityId));
}

function declares(registry: Registry, agentId: string, capabilityId: string): boolean {
  const agent = registry.get(agentId);
  return agent?.kind === 'Agent' && agent.capabilities.includes(capabilityId);
}

/** A selected agent that declares the capability, else the first selected agent, else the default owner. */
function preferredAgent(registry: Registry, capability: CapabilityEntry, forcedIds: string[]): string | undefined {
  return forcedIds.find((id) => declares(registry, id, capability.id)) ?? forcedIds[0] ?? capability.defaultAgents[0];
}

function resolveAgentId(registry: Registry, id: string): string | null {
  const entry = registry.get(id);
  if (entry?.kind !== 'Agent') return null;
  return entry.aliasOf ?? entry.id;
}

/** Assigns an agent to each capability, applying forced and excluded agents (05 §7.4–7.5). */
function assignAgents(input: RouteInput, capabilities: CapabilityEntry[], state: RouteState): Map<string, string> {
  const forced = (input.overrides.agents ?? []).map((id) => ({ id, resolved: resolveAgentId(input.registry, id) }));
  const excluded = new Set((input.overrides.excludeAgents ?? []).map((id) => resolveAgentId(input.registry, id) ?? id));
  for (const unknown of forced.filter((agent) => !agent.resolved)) state.conflict(`Unknown agent: ${unknown.id}`, true);
  const forcedIds = forced.flatMap((agent) => (agent.resolved ? [agent.resolved] : []));
  if (input.overrides.agents) state.override('agents', input.overrides.agents, `assigned ${forcedIds.join(', ')}`);
  if (input.overrides.excludeAgents) state.override('excludeAgents', input.overrides.excludeAgents, 'replaced where another agent declares the capability');

  const assignment = new Map<string, string>();
  for (const capability of capabilities) {
    const preferred = preferredAgent(input.registry, capability, forcedIds);
    if (!preferred) {
      state.conflict(`${capability.id} has no agent`, true);
      continue;
    }
    if (forcedIds.includes(preferred) && !declares(input.registry, preferred, capability.id)) {
      state.explain.assumptions.push(`${preferred} does not declare ${capability.id}; assigned because you selected it`);
    }
    if (!excluded.has(preferred)) {
      assignment.set(capability.id, preferred);
      continue;
    }
    const alternative = agentsDeclaring(input.registry, capability.id).find((agent) => !excluded.has(agent.id));
    if (alternative) {
      assignment.set(capability.id, alternative.id);
      state.explain.excluded.push({ id: preferred, why: `excluded by you; ${alternative.id} also declares ${capability.id}` });
    } else {
      state.conflict(`${preferred} is the only agent for ${capability.id}; excluding it leaves the step without an agent (not re-added silently)`, true);
    }
  }
  return assignment;
}

function skillMatchesProject(skill: CatalogEntry, signals: Set<string>): boolean {
  const required = skill.requiredContext.projectSignals;
  return required.length === 0 || signals.size === 0 || required.some((signal) => signals.has(signal));
}

function selectSkills(input: RouteInput, capabilities: CapabilityEntry[], profileIds: Set<string>, state: RouteState): string[] {
  const signals = projectSignals(input.project);
  if (signals.size === 0) state.explain.assumptions.push('No project stack detected; stack-specific skills are not filtered');
  const limit = input.classification.simple ? SIMPLE_MAX_SKILLS : MAX_SKILLS;
  const chosen: string[] = [];
  for (const capability of capabilities) {
    for (const skillId of capability.skills) {
      const skill = input.registry.get(skillId);
      if (!skill || !profileIds.has(skillId) || chosen.includes(skillId) || chosen.length >= limit) continue;
      if (!skillMatchesProject(skill, signals)) {
        state.explain.excluded.push({ id: skillId, why: `needs ${skill.requiredContext.projectSignals.join(' or ')}, not detected in the project` });
        continue;
      }
      chosen.push(skillId);
      const matched = skill.requiredContext.projectSignals.filter((signal) => signals.has(signal));
      state.explain.skills.push({ id: skillId, bytes: input.knowledge.body(skillId)?.bytes ?? 0, why: `guides ${capability.id}${matched.length ? `; project uses ${matched.join(', ')}` : ''}` });
    }
  }
  for (const skillId of input.overrides.skills ?? []) {
    if (input.registry.get(skillId)?.kind !== 'Skill') state.conflict(`Unknown skill: ${skillId}`, true);
    else if (!chosen.includes(skillId)) {
      chosen.push(skillId);
      state.explain.skills.push({ id: skillId, bytes: input.knowledge.body(skillId)?.bytes ?? 0, why: 'selected by you' });
    }
  }
  if (input.overrides.skills) state.override('skills', input.overrides.skills, 'added to the plan');
  return chosen;
}

function selectGates(input: RouteInput, type: TaskType): string[] {
  const profileGates = input.profile.gates;
  const gates = CODE_CHANGING.has(type) ? [...profileGates] : type === 'docs' ? profileGates.filter((gate) => gate === 'gate.documentation') : [];
  if (input.classification.risk === 'high' && CODE_CHANGING.has(type) && !gates.includes('gate.security-scan')) gates.push('gate.security-scan');
  return gates;
}

/** Tool intents of the chosen agents, narrowed by --allow-tools and checked against policy. */
function resolveTools(input: RouteInput, agentIds: string[], gates: string[], state: RouteState): void {
  const agents = agentIds.map((id) => input.registry.get(id) as AgentEntry);
  let allow = [...new Set(agents.flatMap((agent) => agent.tools.allow))];
  const denied = new Set(agents.flatMap((agent) => agent.tools.deny));
  const restriction = input.overrides.allowTools;
  if (restriction) {
    const before = allow;
    allow = allow.filter((intent) => restriction.some((allowed) => intent === allowed || intent.startsWith(`${allowed}:`)));
    for (const intent of before.filter((intent) => !allow.includes(intent))) denied.add(intent);
    state.override('allowTools', restriction, `narrowed tools to ${allow.join(', ') || 'none'}`);
    const widening = restriction.filter((intent) => !before.some((existing) => existing === intent || existing.startsWith(`${intent}:`)));
    if (widening.length > 0) state.explain.assumptions.push(`Ignored tools no selected agent may use: ${widening.join(', ')} (overrides can only narrow)`);
  }
  const engine = new PolicyEngine(input.policies);
  const approvalRequired: string[] = [];
  for (const intent of allow) {
    const effect = engine.evaluate({ type: 'intent', intent }).effect;
    if (effect === 'deny') denied.add(intent);
    if (effect === 'ask') approvalRequired.push(intent);
  }
  allow = allow.filter((intent) => !denied.has(intent));
  if (gates.length > 0 && !allow.some((intent) => intent.startsWith('cmd'))) {
    state.conflict(`Required gates (${gates.join(', ')}) need command execution, which the allowed tools exclude; gates required by the profile cannot be removed`, true);
  }
  state.explain.tools = { allow, approvalRequired, denied: [...denied] };
}

function estimateCost(input: RouteInput, skills: string[], rules: string[], steps: number, state: RouteState): number {
  const bytesOf = (id: string) => input.knowledge.body(id)?.bytes ?? 0;
  const contextBytes = input.contextT0Bytes + [...skills, ...rules].reduce((sum, id) => sum + bytesOf(id), 0);
  state.explain.cost = {
    contextBytes,
    steps,
    approxTokens: Math.ceil((contextBytes * Math.max(steps, 1)) / BYTES_PER_TOKEN),
    label: 'estimated',
    basis: `catalog bytes are measured; tokens assume ${BYTES_PER_TOKEN} bytes per token and the context loaded once per step (heuristic, not a measurement)`,
  };
  return contextBytes;
}

/** Applies --budget per mode (05 §7.5): automatic drops skills, hybrid asks, manual rejects. */
function applyBudget(input: RouteInput, skills: string[], rules: string[], steps: number, state: RouteState): string[] {
  const budget = input.overrides.budgetBytes;
  let contextBytes = estimateCost(input, skills, rules, steps, state);
  if (budget === undefined || contextBytes <= budget) return skills;
  state.override('budgetBytes', budget, `estimated context ${contextBytes} bytes exceeds the budget`);
  if (input.mode === 'manual') {
    state.conflict(`Estimated context ${contextBytes} bytes exceeds the budget ${budget}`, true);
    return skills;
  }
  if (input.mode === 'hybrid') {
    state.conflict(`Estimated context ${contextBytes} bytes exceeds the budget ${budget}; approve or edit the plan`, false);
    return skills;
  }
  const kept = [...skills];
  while (kept.length > 0 && contextBytes > budget) {
    const dropped = kept.pop()!;
    state.explain.excluded.push({ id: dropped, why: 'dropped to fit the context budget' });
    state.explain.skills = state.explain.skills.filter((skill) => skill.id !== dropped);
    contextBytes = estimateCost(input, kept, rules, steps, state);
  }
  if (contextBytes > budget) state.conflict(`Context still exceeds the budget (${contextBytes} > ${budget}) without any skill`, false);
  return kept;
}

function effectiveType(input: RouteInput, capabilities: CapabilityEntry[], assignment: Map<string, string>, state: RouteState): TaskType {
  if (input.classification.typeCues.length > 0) return input.classification.type;
  const owner = capabilities[0] ? assignment.get(capabilities[0].id) : undefined;
  const inferred = (owner && TYPE_BY_AGENT[owner]) || input.classification.type;
  state.explain.assumptions.push(`No task-type cue in the text; treated as ${inferred} because ${owner ?? 'no agent'} owns the main capability`);
  return inferred;
}

function addRiskReview(input: RouteInput, capabilities: CapabilityEntry[]): CapabilityEntry | null {
  if (input.classification.risk !== 'high' || !CODE_CHANGING.has(input.classification.type)) return null;
  const securityRelated = input.classification.domains.some((domain) => domain.id === 'security-compliance') || input.classification.riskReasons.some((reason) => /secret|credential|password|authentication|personal/.test(reason));
  const reviewId = securityRelated ? 'security-compliance.vulnerability-assessment' : 'architecture-leadership.code-review';
  return capabilities.some((capability) => capability.id === reviewId) ? null : capabilityOf(input.registry, reviewId);
}

function stepApproval(input: RouteInput, approveAt: ReadonlySet<string>, gates: string[], first: boolean, last: boolean): PlanStep['approval'] {
  if (approveAt.has('each-step')) return 'required';
  if (first && input.classification.risk === 'high') return 'required';
  if (last && approveAt.has('gates') && gates.length > 0) return 'required';
  return 'none';
}

/** Steps in execution-phase order with dependencies on the previous phase (W2.1-09). */
function buildSteps(input: RouteInput, capabilities: CapabilityEntry[], assignment: Map<string, string>, gates: string[], approveAt: ReadonlySet<string>) {
  const ordered = [...capabilities].sort((a, b) => PHASES.indexOf(phaseOf(a.id)) - PHASES.indexOf(phaseOf(b.id)));
  const assigned = ordered.filter((capability) => assignment.has(capability.id));
  const graph = buildExecutionGraph(assigned.map((capability) => ({ id: capability.id, capability: capability.id })));
  const steps: PlanStep[] = assigned.map((capability, index) => {
    const last = index === assigned.length - 1;
    return {
      id: capability.id,
      capability: capability.id,
      agent: assignment.get(capability.id)!,
      gates: last ? gates : [],
      approval: stepApproval(input, approveAt, gates, index === 0, last),
      dependsOn: graph.dependsOn[capability.id] ?? [],
    };
  });
  return { steps, phases: graph.phases.map((phase) => ({ name: phase.name, steps: phase.steps })) };
}

/** Path-scoped rules whose globs match a changed file (dynamic T1 context, W2.1-04). */
function pathRules(input: RouteInput, profileIds: Set<string>): Array<{ rule: RuleEntry; file: string }> {
  const files = input.impact?.files ?? [];
  if (files.length === 0) return [];
  return input.registry.list('Rule').flatMap((rule) => {
    if (!profileIds.has(rule.id) || !('paths' in rule.scope)) return [];
    const globs = rule.scope.paths;
    const file = files.find((candidate) => matchesAnyGlob(candidate, globs));
    return file ? [{ rule, file }] : [];
  });
}

/** Rules for the plan: path rules matching changed files first, then rules linked to capabilities. */
function selectRules(input: RouteInput, capabilities: CapabilityEntry[], profileIds: Set<string>, state: RouteState): { rules: string[]; pathMatched: Set<string> } {
  const byPath = pathRules(input, profileIds);
  const linked = capabilities.flatMap((capability) => capability.rules).filter((id) => profileIds.has(id));
  const rules = [...new Set([...byPath.map(({ rule }) => rule.id), ...linked])];
  for (const ruleId of rules) {
    const match = byPath.find(({ rule }) => rule.id === ruleId);
    state.explain.rules.push({ id: ruleId, why: match ? `applies to ${match.file} (path-scoped)` : 'linked to a selected capability' });
  }
  return { rules, pathMatched: new Set(byPath.map(({ rule }) => rule.id)) };
}

/** Ranked context beyond T0: rules matching changed files, then capability rules, then skills. */
function rankContext(input: RouteInput, rules: string[], pathMatched: ReadonlySet<string>, skills: string[], state: RouteState): ContextItem[] {
  const ruleItems: ContextItem[] = rules.map((id) => {
    const rule = input.registry.get(id) as RuleEntry;
    const why = state.explain.rules.find((item) => item.id === id)?.why ?? '';
    return { id, kind: 'rule', tier: 'paths' in rule.scope ? 'T1' : 'T2', bytes: input.knowledge.body(id)?.bytes ?? 0, reason: why };
  });
  const skillItems: ContextItem[] = skills.map((id) => ({
    id,
    kind: 'skill',
    tier: 'T2',
    bytes: input.knowledge.body(id)?.bytes ?? 0,
    reason: state.explain.skills.find((item) => item.id === id)?.why ?? '',
  }));
  const byPathFirst = (item: ContextItem) => (pathMatched.has(item.id) ? 0 : 1);
  return [...ruleItems.sort((a, b) => byPathFirst(a) - byPathFirst(b)), ...skillItems];
}

function explainAgents(input: RouteInput, capabilities: CapabilityEntry[], assignment: Map<string, string>, review: CapabilityEntry | null, state: RouteState): void {
  for (const agentId of new Set(assignment.values())) {
    const owns = capabilities.filter((capability) => assignment.get(capability.id) === agentId).map((capability) => capability.id);
    const why = review && owns.includes(review.id) ? `independent review: risk is high (${input.classification.riskReasons.join('; ')})` : `performs ${owns.join(', ')}`;
    state.explain.agents.push({ id: agentId, why });
  }
  if (input.classification.risk !== 'high') {
    state.explain.excluded.push({ id: 'agent.reviewer / agent.security-auditor', why: `no separate review step: risk is ${input.classification.risk}` });
  }
}

/**
 * hybrid: always a proposal for the user. automatic: ready unless risk, budget or approval points
 * require a person. manual: ready unless the user asked to approve the plan.
 */
function planStatus(input: RouteInput, state: RouteState, approveAt: ReadonlySet<string>): Plan['status'] {
  if (state.blocking) return 'invalid';
  if (input.mode === 'hybrid') return 'proposed';
  if (approveAt.has('plan')) return 'needs-approval';
  const automaticNeedsPerson = state.needsApproval || input.classification.risk === 'high' || approveAt.has('each-step');
  return input.mode === 'automatic' && automaticNeedsPerson ? 'needs-approval' : 'ready';
}

/**
 * Hybrid Agent Router (docs/v2/05 §7): turns a classified task into a minimal plan with an
 * explanation. Overrides narrow the plan; conflicts are reported, never resolved silently.
 */
export function routeTask(rawInput: RouteInput): Plan {
  const input: RouteInput = { ...rawInput, classification: mergeImpact(rawInput.classification, rawInput.impact) };
  const state = new RouteState();
  const profileIds = inProfile(input);
  if (input.impact) {
    const { files, areas, relatedTests, owners, unmappedFiles } = input.impact;
    state.explain.impact = { files, areas: areas.map((area) => area.id), relatedTests, owners, unmappedFiles };
    if (rawInput.classification.domains.length === 0 && input.classification.domains.length > 0) {
      state.explain.assumptions.push('The task text matched no domain; domains were taken from the changed files');
    }
  }
  if (input.classification.domains.length === 0 && !input.overrides.domains) {
    state.conflict('The task did not match any domain; select one with --domain or pass the changed files', true);
  }

  const domains = domainsFor(input, state);
  const capabilities = selectCapabilities(input, domains, state);
  const review = addRiskReview(input, capabilities);
  if (review) capabilities.push(review);
  const assignment = assignAgents(input, capabilities, state);
  const agents = [...new Set(assignment.values())];
  const type = effectiveType(input, capabilities, assignment, state);
  explainAgents(input, capabilities, assignment, review, state);

  const skills = selectSkills(input, capabilities, profileIds, state);
  const { rules, pathMatched } = selectRules(input, capabilities, profileIds, state);

  const workflowId = input.overrides.workflow ?? WORKFLOW_BY_TYPE[type] ?? null;
  if (input.overrides.workflow) {
    if (input.registry.get(input.overrides.workflow)?.kind !== 'Workflow') state.conflict(`Unknown workflow: ${input.overrides.workflow}`, true);
    state.override('workflow', input.overrides.workflow, 'used instead of the type-based workflow');
  }
  const workflow = workflowId && profileIds.has(workflowId) ? workflowId : null;

  const gates = selectGates(input, type);
  state.explain.verification = gates;
  resolveTools(input, agents, gates, state);

  const approveAt = new Set(input.overrides.approveAt ?? []);
  if (input.overrides.approveAt) state.override('approveAt', input.overrides.approveAt, 'added approval points');
  const { steps, phases } = buildSteps(input, capabilities, assignment, gates, approveAt);

  const finalSkills = applyBudget(input, skills, rules, steps.length, state);
  state.explain.context = rankContext(input, rules, pathMatched, finalSkills, state);
  const status = planStatus(input, state, approveAt);

  return {
    schema: 'plan/v1',
    id: input.id,
    task: input.task,
    mode: input.mode,
    status,
    profile: input.profile.id,
    classification: input.classification,
    workflow,
    steps,
    phases,
    agents,
    skills: finalSkills,
    rules,
    gates,
    explain: state.explain,
  };
}

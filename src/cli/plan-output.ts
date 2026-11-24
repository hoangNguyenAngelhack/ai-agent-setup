import type { ImpactOutcome } from '../app/impact';
import type { ImpactReport, Plan } from '../core/contracts';

function section(title: string, lines: string[]): string[] {
  return lines.length > 0 ? [`${title}:`, ...lines.map((line) => `  ${line}`)] : [];
}

type ImpactSummary = Pick<ImpactReport, 'files' | 'relatedTests' | 'owners' | 'unmappedFiles'> & { areaIds: string[] };

function impactLines(impact: ImpactSummary): string[] {
  return [
    `files: ${impact.files.join(', ')}`,
    `areas: ${impact.areaIds.join(', ') || 'none recognised'}`,
    ...(impact.relatedTests.length ? [`related tests: ${impact.relatedTests.join(', ')}`] : []),
    ...impact.owners.map((group) => `owners ${group.owners.join(' ')}: ${group.files.join(', ')}`),
    ...(impact.unmappedFiles.length ? [`not in any known area: ${impact.unmappedFiles.join(', ')}`] : []),
  ];
}

const SOURCE_LABELS: Record<ImpactOutcome['source'], string> = {
  files: 'given files',
  since: 'changes since the given ref',
  'working-tree': 'uncommitted changes',
};

/** Human-readable impact report (W2.1-02). */
export function renderImpact({ source, model, impact }: ImpactOutcome): string {
  const lines = [
    `Impact of ${impact.files.length} file(s) (${SOURCE_LABELS[source]})`,
    `Risk: ${impact.risk}${impact.riskReasons.length ? ` (${impact.riskReasons.join('; ')})` : ''}`,
    `Modules: ${impact.modules.join(', ') || 'none'}`,
    `Capabilities: ${impact.capabilities.join(', ') || 'none'}`,
    ...impactLines({ ...impact, areaIds: impact.areas.map((area) => area.id) }),
    ...(model.truncated ? [`Note: the project scan stopped at ${model.files} files; related tests may be incomplete.`] : []),
  ];
  return `${lines.join('\n')}\n`;
}

/** Human-readable plan with its explanation (docs/v2/05 §7.6). */
export function renderPlan(plan: Plan): string {
  const { classification: c, explain: e } = plan;
  const lines = [
    `Plan ${plan.id} (${plan.mode}, status: ${plan.status}, ${plan.profile})`,
    `Task: ${plan.task}`,
    `Type: ${c.type}${c.typeCues.length ? ` (cues: ${c.typeCues.join(', ')})` : ''} · risk ${c.risk}${c.riskReasons.length ? ` (${c.riskReasons.join('; ')})` : ''} · size ${c.size}`,
    ...section('Domains', e.domains.map((domain) => `${domain.id} (confidence ${domain.confidence}): ${domain.why}`)),
    `Workflow: ${plan.workflow ?? 'none (steps below)'}`,
    ...section('Steps', plan.steps.map((step, index) => `${index + 1}. ${step.capability} → ${step.agent}${step.dependsOn.length ? ` · after ${step.dependsOn.join(', ')}` : ''}${step.gates.length ? ` · gates: ${step.gates.join(', ')}` : ''}${step.approval === 'required' ? ' · approval required' : ''}`)),
    `Phases: ${plan.phases.map((phase) => `${phase.name} [${phase.steps.join(', ')}]`).join(' → ') || 'none'}`,
    ...section('Agents', e.agents.map((agent) => `${agent.id}: ${agent.why}`)),
    ...section('Skills', e.skills.map((skill) => `${skill.id} (${skill.bytes} bytes): ${skill.why}`)),
    ...section('Rules', e.rules.map((rule) => `${rule.id}: ${rule.why}`)),
    ...section('Context (ranked, beyond always-loaded)', e.context.map((item) => `${item.tier} ${item.kind} ${item.id} (${item.bytes} bytes): ${item.reason}`)),
    ...section('Not used', e.excluded.map((item) => `${item.id}: ${item.why}`)),
    `Tools: allow ${e.tools.allow.join(', ') || 'none'}${e.tools.approvalRequired.length ? ` · approval: ${e.tools.approvalRequired.join(', ')}` : ''}${e.tools.denied.length ? ` · denied: ${e.tools.denied.join(', ')}` : ''}`,
    `Cost (${e.cost.label}): ${e.cost.contextBytes} bytes of context, ${e.cost.steps} step(s), about ${e.cost.approxTokens} tokens — ${e.cost.basis}`,
    `Verification: ${e.verification.join(', ') || 'none required'}`,
    ...section('Overrides', e.overrides.map((override) => `${override.field} = ${JSON.stringify(override.value)}: ${override.effect}`)),
    ...(e.impact ? section('Changed files', impactLines({ ...e.impact, areaIds: e.impact.areas })) : []),
    ...section('Assumptions', e.assumptions),
    ...section('Conflicts', e.conflicts),
  ];
  return `${lines.join('\n')}\n`;
}

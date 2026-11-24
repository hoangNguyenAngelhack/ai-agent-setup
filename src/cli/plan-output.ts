import type { Plan } from '../core/contracts';

function section(title: string, lines: string[]): string[] {
  return lines.length > 0 ? [`${title}:`, ...lines.map((line) => `  ${line}`)] : [];
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
    ...section('Steps', plan.steps.map((step, index) => `${index + 1}. ${step.capability} → ${step.agent}${step.gates.length ? ` · gates: ${step.gates.join(', ')}` : ''}${step.approval === 'required' ? ' · approval required' : ''}`)),
    ...section('Agents', e.agents.map((agent) => `${agent.id}: ${agent.why}`)),
    ...section('Skills', e.skills.map((skill) => `${skill.id} (${skill.bytes} bytes): ${skill.why}`)),
    ...section('Rules', e.rules.map((rule) => `${rule.id}: ${rule.why}`)),
    ...section('Not used', e.excluded.map((item) => `${item.id}: ${item.why}`)),
    `Tools: allow ${e.tools.allow.join(', ') || 'none'}${e.tools.approvalRequired.length ? ` · approval: ${e.tools.approvalRequired.join(', ')}` : ''}${e.tools.denied.length ? ` · denied: ${e.tools.denied.join(', ')}` : ''}`,
    `Cost (${e.cost.label}): ${e.cost.contextBytes} bytes of context, ${e.cost.steps} step(s), about ${e.cost.approxTokens} tokens — ${e.cost.basis}`,
    `Verification: ${e.verification.join(', ') || 'none required'}`,
    ...section('Overrides', e.overrides.map((override) => `${override.field} = ${JSON.stringify(override.value)}: ${override.effect}`)),
    ...section('Assumptions', e.assumptions),
    ...section('Conflicts', e.conflicts),
  ];
  return `${lines.join('\n')}\n`;
}

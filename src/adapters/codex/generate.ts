import { stringify as toToml } from 'smol-toml';
import type { RuleEntry } from '../../registry';
import type { GenerationInput, GenerationResult } from '../adapter';
import { collectMcpServers, GenerationContext, slugOf, writeAgentSkill, writeSkills } from '../common/generation-context';
import { instructionPreamble } from '../common/instructions';
import { writePolicyHook } from '../common/policy-hook';

const SKILLS_DIR = '.agents/skills';
const HOOK_DIR = '.codex/hooks/ai-agent-setup';
// Codex runs hooks in the session cwd with no project-root variable; its docs recommend git's root.
const HOOK_COMMAND = `node "$(git rev-parse --show-toplevel)/${HOOK_DIR}/policy-check.cjs" --host codex`;
/** Default sandbox and approval for generated projects (open question OQ-10, docs/v2/10). */
const SANDBOX_DEFAULTS = { sandbox_mode: 'workspace-write', approval_policy: 'on-request' };

function alwaysRulesText(context: GenerationContext): string {
  return context
    .list('Rule')
    .filter((rule) => 'always' in rule.scope)
    .map((rule) => {
      context.record(rule, 'native', ['AGENTS.md']);
      return `## ${rule.name}\n\n${(context.body(rule) ?? '').trim()}`;
    })
    .join('\n\n');
}

function generateScopedRule(context: GenerationContext, rule: RuleEntry): string | null {
  const body = context.body(rule);
  if (body === null || 'always' in rule.scope) return null;
  const scope = 'paths' in rule.scope
    ? `files matching ${rule.scope.paths.join(', ')}`
    : rule.scope.capabilities.map((id) => context.input.registry.get(id)?.name ?? id).join(', ');
  const outputs = writeAgentSkill(context, SKILLS_DIR, slugOf(rule), `${rule.description} Apply when working on ${scope}.`, body, rule);
  context.record(rule, 'emulated', outputs, 'scoped rule delivered as a skill (Codex has no scoped rule files)');
  return slugOf(rule);
}

/** Workflows become skills; a workflow whose name a skill already uses gets a `-workflow` suffix. */
function generateWorkflowSkills(context: GenerationContext, skillNames: ReadonlySet<string>): Map<string, string> {
  const workflowNames = new Map<string, string>();
  for (const workflow of context.list('Workflow')) {
    const body = context.body(workflow);
    if (body === null) continue;
    const preferred = slugOf(workflow);
    const name = skillNames.has(preferred) ? `${preferred}-workflow` : preferred;
    workflowNames.set(workflow.id, name);
    const outputs = writeAgentSkill(context, SKILLS_DIR, name, workflow.description, body, workflow);
    const note = name === preferred ? undefined : `renamed to ${name}: a skill already uses "${preferred}"`;
    context.record(workflow, 'native', outputs, note);
  }
  return workflowNames;
}

function generateAgents(context: GenerationContext): void {
  for (const agent of context.list('Agent')) {
    const body = context.body(agent);
    if (body === null) continue;
    const path = `.codex/agents/${slugOf(agent)}.toml`;
    const definition = { name: slugOf(agent), description: agent.aliasOf ? agent.purpose : agent.description, developer_instructions: body };
    context.write(path, `${toToml(definition)}\n`, agent);
    context.record(agent, 'native', [path]);
  }
}

/** AGENTS.md managed section: preamble plus always-scoped rules, within the profile budget. */
function writeInstructions(context: GenerationContext, workflowNames: ReadonlyMap<string, string>): void {
  const t0 = [instructionPreamble(context, '$', (id) => workflowNames.get(id) ?? id), '## Rules', alwaysRulesText(context)].join('\n\n');
  const budget = context.input.profile.contextBudget.codex;
  if (budget !== undefined && Buffer.byteLength(t0) > budget) {
    context.fail('E_T0_BUDGET', `AGENTS.md managed section is ${Buffer.byteLength(t0)} bytes; profile budget is ${budget}`);
  }
  context.operations.push({ kind: 'section', path: 'AGENTS.md', marker: 't0', style: 'html', content: t0, source: context.input.profile.id });
}

function writeConfig(context: GenerationContext): void {
  const mcpServers = collectMcpServers(context, '.codex/config.toml');
  const config = { ...SANDBOX_DEFAULTS, ...(Object.keys(mcpServers).length > 0 ? { mcp_servers: mcpServers } : {}) };
  context.operations.push({ kind: 'section', path: '.codex/config.toml', marker: 'config', style: 'hash', content: toToml(config).trimEnd(), source: context.input.profile.id });
}

function writeHooks(context: GenerationContext): void {
  writePolicyHook(context, HOOK_DIR);
  const handler = { type: 'command', command: HOOK_COMMAND, timeout: 30, statusMessage: 'Checking ai-agent-setup policy' };
  context.operations.push({
    kind: 'merge-json',
    path: '.codex/hooks.json',
    value: { hooks: { PreToolUse: [{ matcher: '^(Bash|apply_patch)$', hooks: [handler] }] } },
    source: null,
  });
  context.warn(
    'W_CODEX_TRUST',
    'Codex loads .codex/ config, agents and hooks only in trusted projects, and runs these hooks only after they are approved in /hooks.',
  );
}

/** Codex adapter generation (docs/v2/05 §10.4), verified against Codex 0.171 on 2026-11-24. */
export function generateCodex(input: GenerationInput): GenerationResult {
  const context = new GenerationContext('codex', input);
  const skillNames = writeSkills(context, SKILLS_DIR);
  for (const rule of context.list('Rule').filter((entry) => !('always' in entry.scope))) {
    const name = generateScopedRule(context, rule);
    if (name) skillNames.add(name);
  }
  const workflowNames = generateWorkflowSkills(context, skillNames);
  generateAgents(context);
  writeInstructions(context, workflowNames);
  writeConfig(context);
  writeHooks(context);
  return context.result();
}

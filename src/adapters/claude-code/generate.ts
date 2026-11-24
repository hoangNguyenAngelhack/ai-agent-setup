import type { AgentEntry, PolicyDocument, RuleEntry } from '../../registry';
import type { GenerationInput, GenerationResult } from '../adapter';
import { collectMcpServers, GenerationContext, slugOf, withFrontmatter, writeAgentSkill, writeSkills } from '../common/generation-context';
import { instructionPreamble } from '../common/instructions';
import { writePolicyHook } from '../common/policy-hook';

const SKILLS_DIR = '.claude/skills';
const HOOK_DIR = '.claude/hooks/ai-agent-setup';
const HOOK_COMMAND = `node "$CLAUDE_PROJECT_DIR/${HOOK_DIR}/policy-check.cjs" --host claude-code`;

/** Canonical permission intents → Claude Code tool names (docs/v2/05 §9.3, §10.3). */
const TOOLS_BY_INTENT: Record<string, string[]> = {
  'fs.read': ['Read', 'Grep', 'Glob'],
  'fs.write': ['Edit', 'Write'],
  cmd: ['Bash'],
  'cmd.pattern': ['Bash'],
  'net.fetch': ['WebFetch', 'WebSearch'],
};

function toolList(intents: string[]): string {
  const tools = intents.flatMap((intent) => TOOLS_BY_INTENT[intent.split(':')[0]!] ?? []);
  return [...new Set(tools)].join(', ');
}

/**
 * Claude Code permission rules for a token glob. A `*` in the middle of a Claude rule needs text
 * between the spaces (verified 2026-11-24), so each middle `*` also gets a variant without it.
 * Patterns with a wildcard inside a token (`-*r*`) are left to the policy hook: in Claude rules
 * `*` also matches spaces, which would ask for unrelated commands.
 */
export function claudeBashRules(pattern: string): string[] {
  const tokens = pattern.trim().split(/\s+/);
  if (tokens.some((token) => token !== '*' && token.includes('*'))) return [];
  const middleStars = tokens.flatMap((token, index) => (token === '*' && index > 0 && index < tokens.length - 1 ? [index] : []));
  const variants = new Set<string>();
  for (let mask = 0; mask < 2 ** middleStars.length; mask += 1) {
    const dropped = new Set(middleStars.filter((_, bit) => mask & (1 << bit)));
    variants.add(`Bash(${tokens.filter((_, index) => !dropped.has(index)).join(' ')})`);
  }
  return [...variants];
}

function permissionRules(policies: PolicyDocument[], effect: 'ask' | 'deny'): string[] {
  const rules = policies.flatMap((policy) => policy.rules.filter((rule) => rule.effect === effect).flatMap((rule) => rule.match.commands ?? []));
  return [...new Set(rules.flatMap(claudeBashRules))];
}

function generateRule(context: GenerationContext, rule: RuleEntry): void {
  const body = context.body(rule);
  if (body === null) return context.warn('W_NO_BODY', 'Rule has no body', rule.id);
  const name = slugOf(rule);
  if ('always' in rule.scope) {
    context.write(`.claude/rules/${name}.md`, body, rule);
    return context.record(rule, 'native', [`.claude/rules/${name}.md`]);
  }
  if ('paths' in rule.scope) {
    context.write(`.claude/rules/${name}.md`, withFrontmatter({ paths: rule.scope.paths }, body), rule);
    return context.record(rule, 'native', [`.claude/rules/${name}.md`]);
  }
  // Claude Code has no capability-scoped loading: deliver the rule as an on-demand skill.
  const capabilities = rule.scope.capabilities.map((id) => context.input.registry.get(id)?.name ?? id).join(', ');
  const outputs = writeAgentSkill(context, SKILLS_DIR, name, `${rule.description} Apply when working on: ${capabilities}.`, body, rule);
  context.record(rule, 'emulated', outputs, 'capability-scoped rule delivered as a skill');
}

function generateAgent(context: GenerationContext, agent: AgentEntry): void {
  const body = context.body(agent);
  if (body === null) return context.warn('W_NO_BODY', 'Agent has no body; not generated', agent.id);
  const meta: Record<string, unknown> = { name: slugOf(agent), description: agent.aliasOf ? agent.purpose : agent.description };
  // V1 aliases keep V1 behaviour (no tool limits); canonical agents get least-privilege tools.
  if (!agent.aliasOf) {
    if (agent.tools.allow.length > 0) meta.tools = toolList(agent.tools.allow);
    if (agent.tools.deny.length > 0 && toolList(agent.tools.deny)) meta.disallowedTools = toolList(agent.tools.deny);
  }
  const skills = agent.skills.filter((id) => context.has(id)).map((id) => slugOf(context.input.registry.get(id)!));
  if (skills.length > 0) meta.skills = skills;
  const path = `.claude/agents/${slugOf(agent)}.md`;
  context.write(path, withFrontmatter(meta, body), agent);
  context.record(agent, 'native', [path]);
}

function generateWorkflows(context: GenerationContext, skillNames: ReadonlySet<string>): void {
  for (const workflow of context.list('Workflow')) {
    const body = context.body(workflow);
    if (body === null) continue;
    const name = slugOf(workflow);
    const path = `.claude/commands/${name}.md`;
    context.write(path, withFrontmatter({ description: workflow.description }, body), workflow);
    context.record(workflow, 'native', [path]);
    if (skillNames.has(name)) {
      context.warn('W_COMMAND_SHADOWED', `Skill "${name}" takes precedence over the /${name} command in Claude Code (same as V1)`, workflow.id);
    }
  }
}

function generateSettings(context: GenerationContext): void {
  writePolicyHook(context, HOOK_DIR);
  const ask = permissionRules(context.input.policies, 'ask');
  const deny = permissionRules(context.input.policies, 'deny');
  context.operations.push({
    kind: 'merge-json',
    path: '.claude/settings.json',
    value: {
      permissions: { ...(ask.length > 0 ? { ask } : {}), ...(deny.length > 0 ? { deny } : {}) },
      hooks: { PreToolUse: [{ matcher: 'Bash|Write|Edit|MultiEdit', hooks: [{ type: 'command', command: HOOK_COMMAND }] }] },
    },
    source: null,
  });
}

/** Claude Code adapter generation (docs/v2/05 §10.3). */
export function generateClaudeCode(input: GenerationInput): GenerationResult {
  const context = new GenerationContext('claude-code', input);

  context.operations.push({
    kind: 'section',
    path: '.claude/CLAUDE.md',
    marker: 't0',
    style: 'html',
    content: instructionPreamble(context, '/', (id) => slugOf(input.registry.get(id)!)),
    source: input.profile.id,
  });
  for (const rule of context.list('Rule')) generateRule(context, rule);
  const skillNames = writeSkills(context, SKILLS_DIR);
  for (const agent of context.list('Agent')) generateAgent(context, agent);
  generateWorkflows(context, skillNames);

  const mcpServers = collectMcpServers(context, '.mcp.json');
  if (Object.keys(mcpServers).length > 0) {
    context.operations.push({ kind: 'merge-json', path: '.mcp.json', value: { mcpServers }, source: null });
  }
  generateSettings(context);

  return context.result();
}

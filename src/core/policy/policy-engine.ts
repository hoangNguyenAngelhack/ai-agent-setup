import type { PolicyDocument, PolicyEffect, PolicyLayer, PolicyRule } from '../../registry';
import { commandSegments, matchesTokenGlob } from './command-matcher';

export type PolicyAction =
  | { type: 'command'; command: string }
  | { type: 'write'; path: string; content: string }
  | { type: 'intent'; intent: string };

export interface PolicyRuleMatch {
  policyId: string;
  ruleId: string;
  layer: PolicyLayer;
  effect: PolicyEffect;
  description: string;
}

export interface IgnoredAllow extends PolicyRuleMatch {
  /** The rule whose stricter effect won. */
  overriddenBy: string;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  /** Every matching rule, ordered by layer rank then rule order: the explanation trail. */
  matches: PolicyRuleMatch[];
  /** Allow rules that matched but could not loosen a stricter rule (narrow-only, docs/v2/05 §7.4). */
  ignoredAllows: IgnoredAllow[];
}

const LAYER_RANK: Record<PolicyLayer, number> = { mandatory: 0, organization: 1, project: 2, user: 3 };
const RESTRICTION: Record<PolicyEffect, number> = { allow: 0, ask: 1, deny: 2 };

function compile(patterns: string[] | undefined, ignoreCase: boolean | undefined): RegExp[] {
  return (patterns ?? []).map((pattern) => new RegExp(pattern, ignoreCase ? 'i' : ''));
}

function intentMatches(ruleIntent: string, actionIntent: string): boolean {
  return actionIntent === ruleIntent || actionIntent.startsWith(`${ruleIntent}:`);
}

interface CompiledRule {
  policy: PolicyDocument;
  rule: PolicyRule;
  commandRegex: RegExp[];
  contentRegex: RegExp[];
}

/**
 * Evaluates actions against layered policy (docs/v2/05 §9). The effective effect is the most
 * restrictive matching effect across all layers, so lower layers can narrow but never loosen.
 */
export class PolicyEngine {
  private readonly rules: CompiledRule[];

  constructor(policies: readonly PolicyDocument[]) {
    this.rules = [...policies]
      .sort((a, b) => LAYER_RANK[a.layer] - LAYER_RANK[b.layer])
      .flatMap((policy) =>
        policy.rules.map((rule) => ({
          policy,
          rule,
          commandRegex: compile(rule.match.commandRegex, rule.match.ignoreCase),
          contentRegex: compile(rule.match.contentRegex, rule.match.ignoreCase),
        })),
      );
  }

  evaluate(action: PolicyAction): PolicyDecision {
    const matches = this.rules
      .filter((compiled) => this.ruleMatches(compiled, action))
      .map(({ policy, rule }) => ({
        policyId: policy.id,
        ruleId: rule.id,
        layer: policy.layer,
        effect: rule.effect,
        description: rule.description,
      }));

    const winner = matches.reduce<PolicyRuleMatch | undefined>(
      (strictest, match) => (!strictest || RESTRICTION[match.effect] > RESTRICTION[strictest.effect] ? match : strictest),
      undefined,
    );
    const effect = winner?.effect ?? 'allow';
    const ignoredAllows =
      effect === 'allow' || !winner
        ? []
        : matches.filter((match) => match.effect === 'allow').map((match) => ({ ...match, overriddenBy: winner.ruleId }));

    return { effect, matches, ignoredAllows };
  }

  private ruleMatches({ rule, commandRegex, contentRegex }: CompiledRule, action: PolicyAction): boolean {
    switch (action.type) {
      case 'command': {
        const ignoreCase = rule.match.ignoreCase ?? false;
        const segments = commandSegments(action.command);
        const byGlob = (rule.match.commands ?? []).some((pattern) =>
          segments.some((tokens) => matchesTokenGlob(pattern, tokens, ignoreCase)),
        );
        return byGlob || commandRegex.some((regex) => regex.test(action.command));
      }
      case 'write':
        return contentRegex.some((regex) => regex.test(action.content));
      case 'intent':
        return (rule.match.intents ?? []).some((intent) => intentMatches(intent, action.intent));
    }
  }
}

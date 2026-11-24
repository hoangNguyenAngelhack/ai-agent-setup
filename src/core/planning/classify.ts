import type { CapabilityEntry, Registry } from '../../registry';
import type { RiskLevel, TaskClassification, TaskSize, TaskType } from '../contracts';
import { CAPABILITY_PHRASES, HIGH_RISK_CUES, LARGE_TASK_CUES, TYPE_CUES, TYPE_PRECEDENCE } from './lexicon';
import { ngrams, terms } from './text';

const NAME_WEIGHT = 1.5;
const DESCRIPTION_WEIGHT = 0.5;
const DOMAIN_TERM_WEIGHT = 0.5;
const MIN_DOMAIN_SCORE = 1.5;
const MIN_CAPABILITY_SCORE = 1;

/** Tunable scoring parameters; defaults were chosen by a sweep on the development set (docs/v2/08 §9). */
export interface ClassifierOptions {
  /** Score added to a capability for each curated phrase match. */
  phraseWeight: number;
  /** A further domain is kept when its score is at least this share of the best domain's score. */
  secondaryRatio: number;
}

export const DEFAULT_CLASSIFIER_OPTIONS: ClassifierOptions = { phraseWeight: 8, secondaryRatio: 0.7 };
const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

/** Verbs and filler that appear in many capability descriptions and carry no domain signal. */
const GENERIC = new Set(
  terms('add build implement write create define design plan apply check run work team system product support engineer manager specialist developer with across through every each who'),
);

type WeightedTerms = Map<string, number>;

function weightedTerms(capability: CapabilityEntry): WeightedTerms {
  const weights: WeightedTerms = new Map();
  const add = (text: string, weight: number) => {
    for (const term of terms(text)) if (!GENERIC.has(term)) weights.set(term, Math.max(weights.get(term) ?? 0, weight));
  };
  add(capability.description, DESCRIPTION_WEIGHT);
  add(`${capability.name} ${capability.id.split('.')[1]!.replace(/-/g, ' ')}`, NAME_WEIGHT);
  return weights;
}

function phraseIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [phrase, capabilities] of Object.entries(CAPABILITY_PHRASES)) {
    const key = terms(phrase).join(' ');
    if (key) index.set(key, [...(index.get(key) ?? []), ...capabilities]);
  }
  return index;
}

function stemmedCues(cues: Record<string, number>): Array<[string, number]> {
  return Object.entries(cues).map(([cue, weight]) => [terms(cue).join(' '), weight]).filter(([key]) => key !== '') as Array<[string, number]>;
}

/**
 * Deterministic task classifier (Task Planner, docs/v2/05 §5 module 4 and §7.3 step 1). Scores
 * capabilities from catalog text (IDF-weighted) plus a curated phrase lexicon; no model calls.
 */
export class TaskClassifier {
  private readonly capabilities: CapabilityEntry[];
  private readonly termWeights = new Map<string, WeightedTerms>();
  private readonly idf = new Map<string, number>();
  private readonly phrases = phraseIndex();
  private readonly domainTerms = new Map<string, Set<string>>();
  private readonly typeCues = Object.fromEntries(Object.entries(TYPE_CUES).map(([type, cues]) => [type, stemmedCues(cues)])) as Record<TaskType, Array<[string, number]>>;

  constructor(
    private readonly registry: Registry,
    private readonly options: ClassifierOptions = DEFAULT_CLASSIFIER_OPTIONS,
  ) {
    this.capabilities = registry.list('Capability');
    const documentFrequency = new Map<string, number>();
    for (const capability of this.capabilities) {
      const weights = weightedTerms(capability);
      this.termWeights.set(capability.id, weights);
      for (const term of weights.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    for (const [term, frequency] of documentFrequency) this.idf.set(term, Math.log(1 + this.capabilities.length / frequency));
    for (const domain of registry.list('Domain')) {
      this.domainTerms.set(domain.id, new Set(terms(`${domain.name} ${domain.roles.join(' ')}`).filter((term) => !GENERIC.has(term))));
    }
  }

  classify(task: string): TaskClassification {
    const stems = terms(task);
    const grams = ngrams(stems);
    const capabilityScores = this.scoreCapabilities(new Set(stems), grams);
    const domains = this.scoreDomains(capabilityScores, new Set(stems));
    const selectedDomains = new Set(domains.map((domain) => domain.id));
    const capabilities = [...capabilityScores.entries()]
      .filter(([id, score]) => selectedDomains.has(id.split('.')[0]!) && score.score >= MIN_CAPABILITY_SCORE)
      .map(([id, score]) => ({ id, score: round(score.score), matched: score.matched }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const { risk, reasons } = this.assessRisk(domains.map((domain) => domain.id), capabilities, grams);
    const size = this.assessSize(domains.length, risk, grams);
    const { type, cues } = this.classifyType(grams);
    return {
      type,
      typeCues: cues,
      domains,
      capabilities,
      risk,
      riskReasons: reasons,
      size,
      simple: domains.length === 1 && risk !== 'high' && size === 'S',
    };
  }

  private scoreCapabilities(stems: Set<string>, grams: Set<string>): Map<string, { score: number; matched: string[] }> {
    const scores = new Map<string, { score: number; matched: string[] }>();
    const bump = (id: string, amount: number, matched: string) => {
      const current = scores.get(id) ?? { score: 0, matched: [] };
      scores.set(id, { score: current.score + amount, matched: [...current.matched, matched] });
    };
    for (const capability of this.capabilities) {
      for (const [term, weight] of this.termWeights.get(capability.id)!) {
        if (stems.has(term)) bump(capability.id, weight * (this.idf.get(term) ?? 1), term);
      }
    }
    for (const [phrase, ids] of this.phrases) {
      if (grams.has(phrase)) for (const id of ids) bump(id, this.options.phraseWeight, phrase);
    }
    return scores;
  }

  private scoreDomains(capabilityScores: Map<string, { score: number }>, stems: Set<string>): TaskClassification['domains'] {
    const ranked = this.registry
      .list('Domain')
      .map((domain) => {
        const top = domain.capabilities.map((id) => capabilityScores.get(id)?.score ?? 0).sort((a, b) => b - a).slice(0, 2);
        const matched = [...(this.domainTerms.get(domain.id) ?? [])].filter((term) => stems.has(term));
        const score = top.reduce((sum, value) => sum + value, 0) + DOMAIN_TERM_WEIGHT * matched.length;
        return { id: domain.id, score: round(score), confidence: round(score / (score + 3)), matched };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const best = ranked[0];
    if (!best || best.score < MIN_DOMAIN_SCORE) return [];
    return ranked.filter((domain) => domain === best || (domain.score >= MIN_DOMAIN_SCORE && domain.score >= best.score * this.options.secondaryRatio));
  }

  private classifyType(grams: Set<string>): { type: TaskType; cues: string[] } {
    const scores = TYPE_PRECEDENCE.map((type) => {
      const cues = this.typeCues[type].filter(([cue]) => grams.has(cue));
      return { type, cues: cues.map(([cue]) => cue), score: cues.reduce((sum, [, weight]) => sum + weight, 0) };
    });
    const best = scores.reduce((winner, current) => (current.score > winner.score ? current : winner));
    return best.score > 0 ? { type: best.type, cues: best.cues } : { type: 'feature', cues: [] };
  }

  private assessRisk(domainIds: string[], capabilities: TaskClassification['capabilities'], grams: Set<string>): { risk: RiskLevel; reasons: string[] } {
    const reasons: string[] = [];
    let risk: RiskLevel = 'low';
    for (const domainId of domainIds) {
      const top = capabilities.find((capability) => capability.id.startsWith(`${domainId}.`));
      const entry = top ? this.registry.get(top.id) : undefined;
      if (entry?.kind === 'Capability' && RISK_ORDER[entry.riskLevel] > RISK_ORDER[risk]) {
        risk = entry.riskLevel;
        reasons.push(`${entry.id} has risk level ${entry.riskLevel}`);
      }
    }
    for (const [cue, reason] of Object.entries(HIGH_RISK_CUES)) {
      if (grams.has(terms(cue).join(' '))) {
        risk = 'high';
        reasons.push(reason);
      }
    }
    return { risk, reasons };
  }

  private assessSize(domainCount: number, risk: RiskLevel, grams: Set<string>): TaskSize {
    if (domainCount >= 3 || LARGE_TASK_CUES.some((cue) => grams.has(terms(cue).join(' ')))) return 'L';
    if (domainCount === 2 || risk === 'high') return 'M';
    return 'S';
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

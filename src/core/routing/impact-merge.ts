import type { ImpactReport, RiskLevel, TaskClassification } from '../contracts';

const IMPACT_BOOST = 2;
const IMPACT_CONFIDENCE = 0.4;
const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
const FROM_FILES = 'changed files';

/**
 * Folds Impact Analysis into a classification (W2.1-02 → router). Changed files raise risk and boost
 * the capabilities they touch inside the classified domains; they only choose the domains when the
 * task text matched none.
 */
export function mergeImpact(classification: TaskClassification, impact: ImpactReport | null | undefined): TaskClassification {
  if (!impact || impact.files.length === 0) return classification;
  const touched = new Set(impact.capabilities);
  const fromText = classification.domains.length > 0;

  const domains = fromText
    ? classification.domains
    : impact.domains.map((id) => ({ id, score: IMPACT_BOOST, confidence: IMPACT_CONFIDENCE, matched: [FROM_FILES] }));
  const selected = new Set(domains.map((domain) => domain.id));
  const capabilities = classification.capabilities.map((capability) =>
    touched.has(capability.id) ? { ...capability, score: capability.score + IMPACT_BOOST, matched: [...capability.matched, FROM_FILES] } : capability,
  );
  for (const id of impact.capabilities) {
    if (selected.has(id.split('.')[0]!) && !capabilities.some((capability) => capability.id === id)) {
      capabilities.push({ id, score: IMPACT_BOOST, matched: [FROM_FILES] });
    }
  }
  capabilities.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const risk = RISK_ORDER[impact.risk] > RISK_ORDER[classification.risk] ? impact.risk : classification.risk;
  return {
    ...classification,
    domains,
    capabilities,
    risk,
    riskReasons: [...classification.riskReasons, ...impact.riskReasons.map((reason) => `${FROM_FILES}: ${reason}`)],
    simple: domains.length === 1 && risk !== 'high' && classification.size === 'S',
  };
}

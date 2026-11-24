import type { ImpactReport, TaskType } from '../contracts';
import { ngrams, terms } from '../planning';

export type SensitiveCategory = 'payment' | 'credentials' | 'personal-data';

export interface SensitiveFinding {
  category: SensitiveCategory;
  basis: 'changed-files' | 'planned-capability' | 'task-text';
  /** true: a mandatory review is added; false: flagged for assessment or ignored (see `ignored`). */
  mandatory: boolean;
  ignored: boolean;
  reason: string;
}

/** Unlike the router's set, `test` is left out: test work usually touches fixtures, not real data. */
const CODE_CHANGING: ReadonlySet<TaskType> = new Set(['feature', 'bug', 'refactor', 'ops']);

const AREA_CATEGORY: Record<string, SensitiveCategory> = {
  payments: 'payment',
  auth: 'credentials',
  secrets: 'credentials',
  'personal-data': 'personal-data',
};

const CAPABILITY_CATEGORY: Record<string, SensitiveCategory> = {
  'backend.authn-authz': 'credentials',
  'security-compliance.authentication-security': 'credentials',
  'security-compliance.secrets-management': 'credentials',
  'mobile.mobile-security': 'credentials',
  'security-compliance.privacy-assessment': 'personal-data',
};

const TEXT_CUES: Record<SensitiveCategory, string[]> = {
  payment: ['payment', 'billing', 'refund', 'settlement', 'stripe', 'invoice', 'payout', 'financial transaction'],
  credentials: ['token', 'secret', 'api key', 'signing key', 'private key', 'password', 'credential', 'jwt', 'oauth', 'wallet'],
  'personal-data': ['personal data', 'pii', 'gdpr', 'email address', 'phone number', 'date of birth', 'customer data', 'user data'],
};

/**
 * Contexts in which a sensitive word does not mean sensitive impact (ADR-014 non-triggering
 * examples). Each one is scoped so it cannot hide another cue in the same task:
 * - `cue`: cancels only that cue ("design token" explains "token", not "password");
 * - `non-code`: applies only to tasks that do not change code (a fixture in a feature task does not);
 * - `all`: the whole task is that kind of change.
 */
const NON_TRIGGERING: Array<{ phrase: string; why: string; scope: { cue: string } | 'non-code' | 'all' }> = [
  { phrase: 'design token', why: 'design tokens are visual design values', scope: { cue: 'token' } },
  { phrase: 'token usage', why: 'it is about model token usage', scope: { cue: 'token' } },
  { phrase: 'token count', why: 'it is about model token counting', scope: { cue: 'token' } },
  { phrase: 'llm token', why: 'it is about model tokens', scope: { cue: 'token' } },
  { phrase: 'synthetic', why: 'synthetic data is not real data', scope: 'non-code' },
  { phrase: 'fixture', why: 'test fixtures are not real data', scope: 'non-code' },
  { phrase: 'mock', why: 'mocks do not touch real systems', scope: 'non-code' },
  { phrase: 'ui copy', why: 'UI copy does not change behaviour', scope: 'all' },
];

/** The specialist review capability added for each category. */
export const REVIEW_CAPABILITY: Record<SensitiveCategory, string> = {
  payment: 'security-compliance.vulnerability-assessment',
  credentials: 'security-compliance.authentication-security',
  'personal-data': 'security-compliance.privacy-assessment',
};

function stemmed(phrase: string): string {
  return terms(phrase).join(' ');
}

function fromEvidence(impact: ImpactReport | null | undefined, capabilities: readonly string[]): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  for (const area of impact?.areas ?? []) {
    const category = AREA_CATEGORY[area.id];
    if (category) findings.push({ category, basis: 'changed-files', mandatory: true, ignored: false, reason: `changed files touch ${area.id} code (${area.files.join(', ')})` });
  }
  for (const id of capabilities) {
    const category = CAPABILITY_CATEGORY[id];
    if (category) findings.push({ category, basis: 'planned-capability', mandatory: true, ignored: false, reason: `the planned work includes ${id}` });
  }
  return findings;
}

function fromText(task: string, type: TaskType, covered: Set<SensitiveCategory>): SensitiveFinding[] {
  const grams = ngrams(terms(task));
  const present = NON_TRIGGERING.filter(({ phrase }) => grams.has(stemmed(phrase)));
  const codeChanging = CODE_CHANGING.has(type);
  const wholeTask = present.find(({ scope }) => scope === 'all' || (scope === 'non-code' && !codeChanging));
  const findings: SensitiveFinding[] = [];
  for (const [category, cues] of Object.entries(TEXT_CUES) as Array<[SensitiveCategory, string[]]>) {
    if (covered.has(category)) continue;
    const matched = cues.filter((candidate) => grams.has(stemmed(candidate)));
    if (matched.length === 0) continue;
    const explained = (cue: string) => present.find(({ scope }) => typeof scope === 'object' && scope.cue === cue);
    const cue = matched.find((candidate) => !explained(candidate));
    const ignoredWhy = !cue ? explained(matched[0]!)!.why : wholeTask ? wholeTask.why : type === 'docs' ? 'documentation does not change behaviour' : null;
    if (ignoredWhy) {
      findings.push({ category, basis: 'task-text', mandatory: false, ignored: true, reason: `"${cue ?? matched[0]}" mentioned but ignored: ${ignoredWhy}` });
    } else if (codeChanging) {
      findings.push({ category, basis: 'task-text', mandatory: true, ignored: false, reason: `"${cue}" in a ${type} task: ${category} impact is plausible, so the safer review path is taken` });
    } else {
      findings.push({ category, basis: 'task-text', mandatory: false, ignored: false, reason: `"${cue}" in a ${type} task: ${category} impact needs assessment` });
    }
  }
  return findings;
}

/**
 * Impact-based sensitive review (ADR-014): changed files and planned capabilities decide; task text
 * alone only triggers a review when a code-changing task plausibly affects the category.
 */
export function assessSensitivity(input: { task: string; type: TaskType; capabilities: readonly string[]; impact?: ImpactReport | null }): SensitiveFinding[] {
  const evidence = fromEvidence(input.impact, input.capabilities);
  const covered = new Set(evidence.map((finding) => finding.category));
  return [...evidence, ...fromText(input.task, input.type, covered)];
}

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ImpactReport, PlanOverrides } from '../../../src/core/contracts';
import { TaskClassifier } from '../../../src/core/planning';
import { assessSensitivity, routeTask } from '../../../src/core/routing';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../../../src/registry';
import { REPO_ROOT } from '../../helpers/v1-cli';

/** ADR-014: impact-based payment, credential and personal-data review. */
const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const registry = new Registry(report.entries);
const classifier = new TaskClassifier(registry);

function impactOn(area: string, file: string): ImpactReport {
  return {
    files: [file],
    modules: [],
    areas: [{ id: area, files: [file], capabilities: [] }],
    capabilities: [],
    domains: [],
    risk: 'low',
    riskReasons: [],
    relatedTests: [],
    owners: [],
    unmappedFiles: [],
  };
}

function plan(task: string, options: { overrides?: PlanOverrides; impact?: ImpactReport } = {}) {
  return routeTask({
    id: 'plan-sensitivity',
    task,
    mode: 'automatic',
    classification: classifier.classify(task),
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profile: registry.get('profile.standard') as ProfileEntry,
    policies: report.policies,
    project: null,
    overrides: options.overrides ?? {},
    contextT0Bytes: 0,
    impact: options.impact ?? null,
  });
}

describe('assessSensitivity', () => {
  it('should decide from changed files even when the text has no sensitive word', () => {
    const findings = assessSensitivity({ task: 'Tidy up the helper', type: 'refactor', capabilities: [], impact: impactOn('payments', 'src/payments/fee.ts') });

    expect(findings).toEqual([expect.objectContaining({ category: 'payment', basis: 'changed-files', mandatory: true })]);
    expect(findings[0]?.reason).toContain('src/payments/fee.ts');
  });

  it('should decide from a planned credential capability', () => {
    const findings = assessSensitivity({ task: 'Harden login', type: 'feature', capabilities: ['backend.authn-authz'], impact: null });

    expect(findings).toEqual([expect.objectContaining({ category: 'credentials', basis: 'planned-capability', mandatory: true })]);
  });

  it('should not repeat a text finding for a category already proven by evidence', () => {
    const findings = assessSensitivity({ task: 'Rotate the JWT secret', type: 'feature', capabilities: ['backend.authn-authz'], impact: null });

    expect(findings.filter((finding) => finding.category === 'credentials')).toHaveLength(1);
  });

  it('should take the safer path for a sensitive word in a code-changing task', () => {
    const [finding] = assessSensitivity({ task: 'Add refund support', type: 'feature', capabilities: [], impact: null });

    expect(finding).toMatchObject({ category: 'payment', basis: 'task-text', mandatory: true });
  });

  it('should flag a sensitive word in non-code work for assessment', () => {
    const [finding] = assessSensitivity({ task: 'Compare billing providers', type: 'analysis', capabilities: [], impact: null });

    expect(finding).toMatchObject({ category: 'payment', mandatory: false, ignored: false });
  });

  it.each([
    ['Rename the design token for spacing', 'feature'],
    ['Cut LLM token usage', 'refactor'],
    ['Create synthetic payment fixtures', 'test'],
    ['Document the billing module', 'docs'],
  ] as const)('should ignore "%s" and record why', (task, type) => {
    const findings = assessSensitivity({ task, type, capabilities: [], impact: null });

    expect(findings.every((finding) => finding.ignored && !finding.mandatory)).toBe(true);
    expect(findings[0]?.reason).toMatch(/ignored: /);
  });
});

describe('assessSensitivity — scoped exclusions', () => {
  it.each([
    ['Add a stripe refund endpoint and update the mock server', 'feature', 'payment'],
    ['Store user password hashes and add a test fixture', 'feature', 'credentials'],
    ['Rename the design token and rotate the signing key', 'refactor', 'credentials'],
  ] as const)('should still require a review for "%s"', (task, type, category) => {
    const findings = assessSensitivity({ task, type, capabilities: [], impact: null });

    expect(findings).toEqual([expect.objectContaining({ category, mandatory: true })]);
  });
});

describe('routeTask — ADR-014 reviews', () => {
  it('should add a credentials specialist review with a recorded reason', () => {
    const result = plan('Implement JWT refresh tokens with rotation for the login API');

    expect(result.agents).toContain('agent.security-auditor');
    expect(result.classification.risk).toBe('high');
    expect(result.classification.riskReasons.join(' ')).toMatch(/mandatory credentials review/);
    expect(result.explain.sensitivity).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'credentials', mandatory: true })]));
  });

  it('should not add a review for design tokens', () => {
    const result = plan('Define design tokens for color, spacing and typography');

    expect(result.agents).not.toContain('agent.security-auditor');
    expect(result.explain.sensitivity.every((finding) => !finding.mandatory)).toBe(true);
  });

  it('should add a payment review when changed files touch payment code', () => {
    const result = plan('Tidy up the fee helper', { impact: impactOn('payments', 'src/payments/fee.ts') });

    expect(result.steps.map((step) => step.capability)).toContain('security-compliance.vulnerability-assessment');
    expect(result.agents).toContain('agent.security-auditor');
  });

  it('should require approval for work that needs assessment', () => {
    const result = plan('Research which payment providers we could support');

    expect(result.status).toBe('needs-approval');
    expect(result.agents).not.toContain('agent.security-auditor');
    expect(result.explain.assumptions.join(' ')).toMatch(/Requires assessment/);
  });

  it('should refuse an override that removes a mandatory review', () => {
    const result = plan('Add refund processing to the billing service', { overrides: { excludeAgents: ['agent.security-auditor'] } });

    expect(result.status).toBe('invalid');
    expect(result.explain.conflicts.join(' ')).toMatch(/mandatory payment review cannot be removed/);
  });

  it('should not let a forced agent take over a mandatory review', () => {
    const result = plan('implement password reset endpoint', { overrides: { agents: ['agent.implementer'] } });
    const review = result.steps.find((step) => step.capability.startsWith('security-compliance.'));

    expect(review?.agent).toBe('agent.security-auditor');
    expect(result.explain.overrides.map((item) => item.effect).join(' ')).toMatch(/a mandatory review stays with agent.security-auditor/);
  });

  it('should keep an independent code review for non-sensitive high-risk changes', () => {
    const result = plan('Change the production database connection pool size');

    expect(result.steps.map((step) => step.capability)).toContain('architecture-leadership.code-review');
    expect(result.agents).not.toContain('agent.security-auditor');
  });
});

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCatalog, type CapabilityEntry, type DomainEntry } from '../../src/registry';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * Oracle: the 12 domains, their roles and capabilities exactly as approved in
 * docs/v2/EXECUTION-SPECIFICATION.md §4, with the capability slugs from docs/v2/05 §6.7.
 */
const SPEC_DOMAINS: Array<{ ordinal: number; id: string; roles: string[]; capabilities: string[] }> = [
  {
    ordinal: 1,
    id: 'product-business',
    roles: ['Product Manager', 'Product Owner', 'Business Analyst', 'Business Architect', 'Domain Expert', 'Project Manager', 'Requirement Analyst', 'Product Operations'],
    capabilities: ['product-discovery', 'requirement-analysis', 'user-story-creation', 'acceptance-criteria', 'backlog-management', 'scope-definition', 'business-process-analysis', 'stakeholder-analysis', 'product-documentation', 'release-planning'],
  },
  {
    ordinal: 2,
    id: 'design-ux',
    roles: ['UI Designer', 'UX Designer', 'UX Researcher', 'Interaction Designer', 'Visual Designer', 'Design System Engineer', 'Accessibility Specialist'],
    capabilities: ['ux-research', 'user-journey-mapping', 'information-architecture', 'wireframing', 'ui-design', 'interaction-design', 'design-system-definition', 'design-token-management', 'accessibility-evaluation', 'usability-review'],
  },
  {
    ordinal: 3,
    id: 'frontend',
    roles: ['Frontend Engineer', 'React Engineer', 'Vue Engineer', 'Angular Engineer', 'Next.js Engineer', 'Web Performance Engineer', 'Frontend Architect'],
    capabilities: ['application-architecture', 'component-engineering', 'state-management', 'routing', 'api-integration', 'rendering-strategy', 'accessibility', 'performance-optimization', 'design-system-implementation', 'frontend-testing'],
  },
  {
    ordinal: 4,
    id: 'backend',
    roles: ['Backend Engineer', 'Java Engineer', 'Node.js Engineer', 'Python Engineer', 'Go Engineer', '.NET Engineer', 'API Engineer', 'Database Engineer', 'Distributed Systems Engineer'],
    capabilities: ['api-design', 'domain-modeling', 'service-architecture', 'authn-authz', 'database-design', 'caching', 'messaging', 'transactions', 'distributed-systems', 'reliability-scalability'],
  },
  {
    ordinal: 5,
    id: 'mobile',
    roles: ['iOS Engineer', 'Android Engineer', 'React Native Engineer', 'Flutter Engineer', 'Mobile Architect', 'Mobile QA Engineer'],
    capabilities: ['native-development', 'cross-platform-development', 'mobile-architecture', 'navigation-state', 'offline-first', 'push-notifications', 'deep-linking', 'mobile-performance', 'mobile-security', 'app-distribution'],
  },
  {
    ordinal: 6,
    id: 'data-ai',
    roles: ['Data Engineer', 'Analytics Engineer', 'Data Architect', 'Database Administrator', 'Data Scientist', 'ML Engineer', 'AI Engineer', 'LLM Engineer', 'MLOps Engineer'],
    capabilities: ['data-modeling', 'etl-elt', 'data-pipelines', 'data-quality', 'data-governance', 'analytics', 'machine-learning', 'model-evaluation', 'llm-integration', 'rag', 'vector-search', 'mlops'],
  },
  {
    ordinal: 7,
    id: 'devops-sre',
    roles: ['DevOps Engineer', 'Platform Engineer', 'Cloud Architect', 'Site Reliability Engineer', 'Infrastructure Engineer', 'Release Engineer', 'FinOps Engineer'],
    capabilities: ['ci-cd', 'infrastructure-as-code', 'containerization', 'kubernetes', 'cloud-infrastructure', 'deployment-strategies', 'monitoring', 'logging-tracing', 'incident-response', 'disaster-recovery', 'reliability-engineering', 'cost-optimization'],
  },
  {
    ordinal: 8,
    id: 'quality',
    roles: ['QA Engineer', 'Manual Tester', 'Automation Tester', 'SDET', 'API Tester', 'Performance Tester', 'Test Architect', 'Accessibility Tester'],
    capabilities: ['test-strategy', 'test-planning', 'functional-testing', 'integration-testing', 'e2e-testing', 'api-testing', 'performance-testing', 'regression-testing', 'test-automation', 'test-data-management', 'quality-reporting'],
  },
  {
    ordinal: 9,
    id: 'security-compliance',
    roles: ['Application Security Engineer', 'Security Architect', 'DevSecOps Engineer', 'Penetration Tester', 'Privacy Engineer', 'Compliance Specialist', 'Threat Modeling Specialist'],
    capabilities: ['threat-modeling', 'secure-coding', 'vulnerability-assessment', 'dependency-security', 'authentication-security', 'authorization-review', 'secrets-management', 'privacy-assessment', 'compliance-mapping', 'security-testing', 'security-incident-analysis'],
  },
  {
    ordinal: 10,
    id: 'architecture-leadership',
    roles: ['Solution Architect', 'Software Architect', 'Enterprise Architect', 'Technical Lead', 'Engineering Manager', 'Staff Engineer', 'Principal Engineer', 'Code Reviewer'],
    capabilities: ['architecture-design', 'architecture-evaluation', 'adr-management', 'technical-decision-making', 'code-review', 'technical-debt-management', 'system-design', 'engineering-standards', 'mentoring', 'cross-domain-coordination'],
  },
  {
    ordinal: 11,
    id: 'docs-devex',
    roles: ['Technical Writer', 'Documentation Engineer', 'Developer Experience Engineer', 'API Documentation Specialist', 'Developer Advocate', 'Knowledge Manager', 'Release Documentation Specialist'],
    capabilities: ['technical-documentation', 'api-documentation', 'architecture-documentation', 'developer-onboarding', 'knowledge-management', 'changelog-generation', 'release-notes', 'documentation-validation', 'developer-workflow-optimization'],
  },
  {
    ordinal: 12,
    id: 'integration-automation',
    roles: ['Integration Engineer', 'Workflow Engineer', 'Automation Engineer', 'MCP Specialist', 'Internal Tools Engineer', 'Platform Integration Engineer'],
    capabilities: ['api-integrations', 'mcp-integrations', 'workflow-automation', 'event-driven-integrations', 'tool-orchestration', 'internal-developer-tools', 'external-service-integration', 'automation-reliability'],
  },
];

const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const domains = report.entries.filter((entry): entry is DomainEntry => entry.kind === 'Domain');
const capabilities = report.entries.filter((entry): entry is CapabilityEntry => entry.kind === 'Capability');

describe('V2.0 domain catalog foundation (W2.0-05)', () => {
  it('should validate with no errors', () => {
    const errors = report.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');

    expect(errors).toEqual([]);
  });

  it('should contain exactly the 12 approved domains in order', () => {
    const ordered = [...domains].sort((a, b) => a.ordinal - b.ordinal);

    expect(ordered.map((domain) => [domain.ordinal, domain.id])).toEqual(
      SPEC_DOMAINS.map((domain) => [domain.ordinal, domain.id]),
    );
  });

  it.each(SPEC_DOMAINS)('$id should record the approved roles', ({ id, roles }) => {
    expect(domains.find((domain) => domain.id === id)?.roles).toEqual(roles);
  });

  it.each(SPEC_DOMAINS)('$id should contain the approved capabilities', ({ id, capabilities: slugs }) => {
    const expected = slugs.map((slug) => `${id}.${slug}`).sort();

    expect([...(domains.find((domain) => domain.id === id)?.capabilities ?? [])].sort()).toEqual(expected);
    expect(capabilities.filter((capability) => capability.domain === id).map((c) => c.id).sort()).toEqual(expected);
  });

  it('should be at least depth L0 for every domain', () => {
    expect(domains.every((domain) => ['L0', 'L1', 'L2', 'L3'].includes(domain.depthLevel))).toBe(true);
  });

  it('should give every capability at least one default agent', () => {
    const withoutAgent = capabilities.filter((capability) => capability.defaultAgents.length === 0);

    expect(withoutAgent.map((capability) => capability.id)).toEqual([]);
  });
});

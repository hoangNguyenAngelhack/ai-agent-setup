import { describe, expect, it } from 'vitest';
import { buildExecutionGraph, phaseOf } from '../../../src/core/orchestration';

describe('buildExecutionGraph (W2.1-09)', () => {
  it('should order cross-domain steps: API, then UI, then tests, then review', () => {
    const graph = buildExecutionGraph([
      { id: 'test', capability: 'quality.e2e-testing' },
      { id: 'ui', capability: 'frontend.component-engineering' },
      { id: 'review', capability: 'security-compliance.vulnerability-assessment' },
      { id: 'api', capability: 'backend.api-design' },
    ]);

    expect(graph.order).toEqual(['api', 'ui', 'test', 'review']);
    expect(graph.dependsOn).toEqual({ api: [], ui: ['api'], test: ['ui'], review: ['test'] });
  });

  it('should let steps of one phase run in parallel and depend on the whole previous phase', () => {
    const graph = buildExecutionGraph([
      { id: 'api', capability: 'backend.api-design' },
      { id: 'web', capability: 'frontend.component-engineering' },
      { id: 'app', capability: 'mobile.push-notifications' },
      { id: 'docs', capability: 'docs-devex.api-documentation' },
    ]);

    expect(graph.phases).toEqual([
      { name: 'build-core', steps: ['api'] },
      { name: 'build-clients', steps: ['web', 'app'] },
      { name: 'document', steps: ['docs'] },
    ]);
    expect(graph.dependsOn.docs).toEqual(['web', 'app']);
  });

  it('should place design-time security and test planning before implementation', () => {
    expect(phaseOf('security-compliance.threat-modeling')).toBe('architect');
    expect(phaseOf('quality.test-planning')).toBe('architect');
    expect(phaseOf('architecture-leadership.code-review')).toBe('review');
  });
});

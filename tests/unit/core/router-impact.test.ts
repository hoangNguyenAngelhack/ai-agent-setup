import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TaskClassifier } from '../../../src/core/planning';
import { detectProject } from '../../../src/core/project-detection';
import { analyzeImpact, buildProjectModel } from '../../../src/core/project-intelligence';
import { routeTask } from '../../../src/core/routing';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../../../src/registry';
import { REPO_ROOT } from '../../helpers/v1-cli';

/** Router with Impact Analysis (W2.1-02/04/09). */
const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const registry = new Registry(report.entries);
const classifier = new TaskClassifier(registry);
const root = mkdtempSync(join(tmpdir(), 'router-impact-'));
cpSync(join(REPO_ROOT, 'templates', 'backend-nestjs'), root, { recursive: true });
const project = detectProject(root);
const model = buildProjectModel(root, project);

function plan(task: string, files: string[] = [], domains?: string[]) {
  return routeTask({
    id: 'plan-impact',
    task,
    mode: 'hybrid',
    classification: classifier.classify(task),
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profile: registry.get('profile.standard') as ProfileEntry,
    policies: report.policies,
    project,
    overrides: domains ? { domains } : {},
    contextT0Bytes: 13542,
    impact: files.length ? analyzeImpact(model, files) : null,
  });
}

describe('routeTask with changed files', () => {
  it('should raise risk from the touched area and add an independent review', () => {
    const withoutFiles = plan('Add rate limiting to the login endpoint');
    const withFiles = plan('Add rate limiting to the login endpoint', ['src/modules/auth/auth.controller.ts']);

    expect(withoutFiles.classification.risk).not.toBe('high');
    expect(withFiles.classification.risk).toBe('high');
    expect(withFiles.classification.riskReasons.join(' ')).toContain('changed files: authentication and authorization code');
    expect(withFiles.agents).toContain('agent.security-auditor');
  });

  it('should load path-scoped rules only for files that are actually touched, ranked first', () => {
    const touched = plan('Add rate limiting to the login endpoint', ['src/modules/auth/auth.controller.ts']);
    const untouched = plan('Add rate limiting to the login endpoint');

    expect(touched.rules).toContain('rule.typescript-patterns');
    expect(untouched.rules).not.toContain('rule.typescript-patterns');
    expect(touched.explain.context[0]).toMatchObject({ id: 'rule.typescript-patterns', tier: 'T1', reason: 'applies to src/modules/auth/auth.controller.ts (path-scoped)' });
  });

  it('should take the domains from the files when the text matches none, and say so', () => {
    const result = plan('update these files', ['prisma/schema.prisma']);

    expect(result.status).toBe('proposed');
    expect(result.explain.domains.map((domain) => domain.id)).toEqual(['backend']);
    expect(result.explain.assumptions).toContain('The task text matched no domain; domains were taken from the changed files');
  });

  it('should not add domains from files when the text is clear', () => {
    const result = plan('Add a reusable modal component to the React app', ['package.json']);

    expect(result.explain.domains.map((domain) => domain.id)).toEqual(['frontend']);
    expect(result.classification.risk).toBe('medium');
  });

  it('should report the impact in the explanation', () => {
    const result = plan('Fix the login bug', ['src/modules/auth/auth.service.ts', 'nest-cli.json']);

    expect(result.explain.impact).toEqual({
      files: ['src/modules/auth/auth.service.ts', 'nest-cli.json'],
      areas: ['auth'],
      relatedTests: [],
      owners: [],
      unmappedFiles: ['nest-cli.json'],
    });
  });

  it('should order cross-domain steps by phase with dependencies, whatever order the domains come in', () => {
    // Domains are given explicitly so this checks ordering, not classifier recall (multi-domain recall is 0.732).
    const result = plan('Add a paginated orders endpoint and show it in a sortable table on the dashboard', [], ['frontend', 'backend']);
    const api = result.steps.find((step) => step.capability.startsWith('backend.'))!;
    const ui = result.steps.find((step) => step.capability.startsWith('frontend.'))!;

    expect(result.steps.indexOf(api)).toBeLessThan(result.steps.indexOf(ui));
    expect(ui.dependsOn).toContain(api.id);
    expect(result.phases.map((phase) => phase.name)).toEqual(['build-core', 'build-clients']);
  });
});

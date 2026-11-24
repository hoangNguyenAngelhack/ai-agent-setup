import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlanMode, PlanOverrides, ProjectProfile } from '../../../src/core/contracts';
import { TaskClassifier } from '../../../src/core/planning';
import { routeTask } from '../../../src/core/routing';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../../../src/registry';
import { fixtures, writeCatalog } from '../../helpers/catalog-fixture';
import { REPO_ROOT } from '../../helpers/v1-cli';

const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const registry = new Registry(report.entries);
const classifier = new TaskClassifier(registry);

function project(frameworks: string[], languages = ['typescript']): ProjectProfile {
  return { root: '/p', languages, frameworks, packageManagers: [], buildTools: [], testRunners: [], ci: [], signals: [], workspaces: [] };
}

function plan(task: string, options: { overrides?: PlanOverrides; mode?: PlanMode; project?: ProjectProfile | null } = {}) {
  return routeTask({
    id: 'plan-test',
    task,
    mode: options.mode ?? 'hybrid',
    classification: classifier.classify(task),
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profile: registry.get('profile.standard') as ProfileEntry,
    policies: report.policies,
    project: options.project === undefined ? null : options.project,
    overrides: options.overrides ?? {},
    contextT0Bytes: 13542,
  });
}

describe('routeTask — automatic selection (05 §7.3)', () => {
  it('should keep a simple task to one agent and at most three skills', () => {
    const result = plan('Add a reusable modal component with focus trap to the React app', { project: project(['react']) });

    expect(result.agents).toEqual(['agent.implementer']);
    expect(result.skills.length).toBeLessThanOrEqual(3);
    expect(result.skills).toContain('skill.react-frontend');
    expect(result.workflow).toBe('wf.build');
    expect(result.status).toBe('proposed');
    expect(result.explain.excluded.map((item) => item.id)).toContain('agent.reviewer / agent.security-auditor');
  });

  it('should pick the skill that matches the project stack and explain the others', () => {
    const express = plan('Add a paginated GET /orders endpoint with filtering by status', { project: project(['express']) });
    const nest = plan('Add a paginated GET /orders endpoint with filtering by status', { project: project(['nestjs']) });
    const go = plan('Add a paginated GET /orders endpoint with filtering by status', { project: project(['gin'], ['go']) });

    expect(express.skills).toContain('skill.nodejs-backend');
    expect(express.skills).not.toContain('skill.nestjs-backend');
    expect(nest.skills).toContain('skill.nestjs-backend');
    expect(go.skills).not.toContain('skill.nodejs-backend');
    expect(go.explain.excluded.find((item) => item.id === 'skill.nodejs-backend')?.why).toContain('express or fastify');
  });

  it('should state the assumption when no project is detected', () => {
    expect(plan('Write a PRD for a referral program').explain.assumptions).toContain('No project stack detected; stack-specific skills are not filtered');
  });

  it('should add an independent security review and require approval for high-risk work', () => {
    const result = plan('Implement JWT refresh tokens with rotation for the login API', { mode: 'automatic' });

    expect(result.classification.risk).toBe('high');
    expect(result.agents).toContain('agent.security-auditor');
    expect(result.steps[0]?.approval).toBe('required');
    expect(result.gates).toContain('gate.security-scan');
    expect(result.status).toBe('needs-approval');
  });

  it('should estimate cost and label it as an estimate', () => {
    const { cost } = plan('Fix the N+1 query in the GET /users endpoint').explain;

    expect(cost.label).toBe('estimated');
    expect(cost.contextBytes).toBeGreaterThan(13542);
    expect(cost.basis).toContain('heuristic');
  });

  it('should not gate review or analysis work with build gates', () => {
    expect(plan('Write a PRD for a referral program').gates).toEqual([]);
    expect(plan('Add a reusable modal component to the React app').gates).toEqual(expect.arrayContaining(['gate.build', 'gate.unit-tests']));
  });

  it('should be deterministic', () => {
    expect(plan('Add Playwright end-to-end tests for login')).toEqual(plan('Add Playwright end-to-end tests for login'));
  });

  it('should refuse a task that matches no domain', () => {
    const result = plan('hello there');

    expect(result.status).toBe('invalid');
    expect(result.explain.conflicts[0]).toContain('--domain');
  });
});

describe('routeTask — overrides and conflicts (05 §7.4–7.5)', () => {
  it('should replace the classified domains with selected ones', () => {
    const result = plan('hello there', { overrides: { domains: ['docs-devex'] } });

    expect(result.status).toBe('proposed');
    expect(result.explain.domains).toEqual([{ id: 'docs-devex', confidence: 1, why: 'selected by you' }]);
    expect(result.explain.assumptions).toEqual(expect.arrayContaining([expect.stringContaining('No capability of docs-devex matched'), expect.stringContaining('treated as docs')]));
    expect(result.gates).toEqual([]);
  });

  it('should reject unknown domains, agents, skills and workflows', () => {
    expect(plan('Add a modal component', { overrides: { domains: ['nope'] } }).status).toBe('invalid');
    expect(plan('Add a modal component', { overrides: { agents: ['agent.nope'] } }).status).toBe('invalid');
    expect(plan('Add a modal component', { overrides: { skills: ['skill.nope'] } }).status).toBe('invalid');
    expect(plan('Add a modal component', { overrides: { workflow: 'wf.nope' } }).status).toBe('invalid');
  });

  it('should resolve a V1 agent name to its canonical agent', () => {
    expect(plan('Add a modal component', { overrides: { agents: ['agent.frontend'] } }).agents).toEqual(['agent.implementer']);
  });

  it('should never re-add an excluded agent that is the only one for a step', () => {
    const result = plan('Add a modal component', { overrides: { excludeAgents: ['agent.implementer'] } });

    expect(result.status).toBe('invalid');
    expect(result.agents).not.toContain('agent.implementer');
    expect(result.explain.conflicts.join(' ')).toContain('not re-added silently');
  });

  it('should keep profile gates when tools are narrowed and declare the plan invalid instead', () => {
    const result = plan('Add a modal component', { overrides: { allowTools: ['fs.read'] } });

    expect(result.status).toBe('invalid');
    expect(result.gates).toEqual(expect.arrayContaining(['gate.build']));
    expect(result.explain.conflicts.join(' ')).toContain('cannot be removed');
  });

  it('should only narrow tools and ignore attempts to widen them', () => {
    const result = plan('Add a modal component', { overrides: { allowTools: ['fs.read', 'fs.write', 'cmd', 'pkg.publish', 'net.fetch'] } });

    expect(result.status).toBe('proposed');
    expect(result.explain.tools.allow).not.toContain('pkg.publish');
    expect(result.explain.tools.allow).not.toContain('net.fetch');
    expect(result.explain.assumptions.join(' ')).toContain('overrides can only narrow');
  });

  it('should never allow an intent an agent denies', () => {
    const { tools } = plan('Add a modal component').explain;

    expect(tools.denied).toEqual(expect.arrayContaining(['pkg.publish', 'vcs.push']));
    expect(tools.allow).not.toEqual(expect.arrayContaining(['pkg.publish']));
  });

  it.each([
    ['automatic', 'ready'],
    ['hybrid', 'proposed'],
    ['manual', 'invalid'],
  ] as const)('should apply a too-small budget in %s mode (status %s)', (mode, expectedStatus) => {
    const result = plan('Add a reusable modal component to the React app', { mode, overrides: { budgetBytes: 14000 } });

    expect(result.status).toBe(expectedStatus);
    expect(result.explain.overrides.map((override) => override.field)).toContain('budgetBytes');
    if (mode === 'automatic') {
      // 05 §7.5: automatic mode downgrades and reports; it does not ask when the result fits.
      expect(result.skills).toEqual([]);
      expect(result.explain.excluded.some((item) => item.why === 'dropped to fit the context budget')).toBe(true);
    } else {
      expect(result.explain.conflicts.join(' ')).toContain('exceeds the budget');
    }
  });

  it('should add approval points without removing anything', () => {
    const result = plan('Add a modal component', { mode: 'automatic', overrides: { approveAt: ['each-step'] } });

    expect(result.steps.every((step) => step.approval === 'required')).toBe(true);
    expect(result.status).toBe('needs-approval');
  });

  it('should use a selected workflow', () => {
    expect(plan('Add a modal component', { overrides: { workflow: 'wf.spec' } }).workflow).toBe('wf.spec');
  });
});

describe('routeTask — excluded agent with an alternative', () => {
  it('should substitute another agent that declares the capability and explain it', () => {
    const entries = [
      fixtures.domain('demo', ['demo.do-thing']),
      fixtures.capability('demo.do-thing', 'demo', { name: 'Widget polishing', description: 'Polish widgets until they shine.', defaultAgents: ['agent.worker'] }),
      fixtures.agent('agent.worker', ['demo.do-thing'], { tools: { allow: ['fs.read', 'cmd'], deny: [] } }),
      fixtures.agent('agent.helper', ['demo.do-thing'], { tools: { allow: ['fs.read', 'cmd'], deny: [] } }),
      fixtures.profile('profile.fixture'),
    ];
    const fixtureReport = validateCatalog(writeCatalog(entries));
    const fixtureRegistry = new Registry(fixtureReport.entries);

    const result = routeTask({
      id: 'plan-fixture',
      task: 'Polish the widgets',
      mode: 'manual',
      classification: new TaskClassifier(fixtureRegistry).classify('Polish the widgets'),
      registry: fixtureRegistry,
      knowledge: new KnowledgeIndex(fixtureReport.loaded),
      profile: fixtureRegistry.get('profile.fixture') as ProfileEntry,
      policies: fixtureReport.policies,
      project: null,
      overrides: { excludeAgents: ['agent.worker'] },
      contextT0Bytes: 0,
    });

    expect(result.status).toBe('ready');
    expect(result.agents).toEqual(['agent.helper']);
    expect(result.explain.excluded).toContainEqual({ id: 'agent.worker', why: 'excluded by you; agent.helper also declares demo.do-thing' });
  });
});

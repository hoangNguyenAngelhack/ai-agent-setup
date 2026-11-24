import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TaskClassifier } from '../../src/core/planning';
import { routeTask } from '../../src/core/routing';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../../src/registry';
import { writeTree } from './fs-tree';
import { REPO_ROOT } from './v1-cli';

const report = validateCatalog(join(REPO_ROOT, 'catalog'));
const registry = new Registry(report.entries);

export const PLAN_ID = 'plan-20261124T100000Z-abcdef';

/**
 * A project with one saved two-step plan (backend → frontend, starter profile) and passing gate
 * commands for build and unit tests.
 */
export function projectWithPlan(): string {
  const task = 'Implement the orders API endpoint and build the orders page in the React app';
  const plan = routeTask({
    id: PLAN_ID,
    task,
    mode: 'hybrid',
    classification: new TaskClassifier(registry).classify(task),
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profile: registry.get('profile.starter') as ProfileEntry,
    policies: report.policies,
    project: null,
    overrides: { domains: ['backend', 'frontend'] },
    contextT0Bytes: 0,
  });
  const root = writeTree({
    'scripts/ok.js': 'console.log("ok")',
    'scripts/fail.js': 'process.exit(1)',
    '.ai-agent-setup/gates.json': JSON.stringify({ gates: { 'gate.build': { command: 'node scripts/ok.js' }, 'gate.unit-tests': { command: 'node scripts/ok.js' } } }),
  });
  mkdirSync(join(root, '.ai-agent-setup', 'runs', PLAN_ID), { recursive: true });
  writeFileSync(join(root, '.ai-agent-setup', 'runs', PLAN_ID, 'plan.json'), JSON.stringify(plan));
  return root;
}

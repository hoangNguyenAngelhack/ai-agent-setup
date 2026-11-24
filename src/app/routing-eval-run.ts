import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { evaluateRouting, evaluateSensitivity, type LabelledTask, type RoutingMetrics, type SensitivityCase, type SensitivityMetrics } from '../core/evaluation';
import type { TaskClassification } from '../core/contracts';
import { TaskClassifier } from '../core/planning';
import { routeTask } from '../core/routing';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../registry';

const PACKAGE_ROOT = join(__dirname, '..', '..');

function evalRouter(packageRoot: string) {
  const report = validateCatalog(join(packageRoot, 'catalog'));
  const registry = new Registry(report.entries);
  const knowledge = new KnowledgeIndex(report.loaded);
  const profile = registry.get('profile.standard') as ProfileEntry;
  const classifier = new TaskClassifier(registry);
  const route = (text: string, classification: TaskClassification) =>
    routeTask({ id: 'eval', task: text, mode: 'automatic', classification, registry, knowledge, profile, policies: report.policies, project: null, overrides: {}, contextT0Bytes: 0 });
  return { classifier, route };
}

function readItems<T>(packageRoot: string, file: string): T[] {
  return (parse(readFileSync(join(packageRoot, 'benchmarks', 'eval', file), 'utf8')) as { items: T[] }).items;
}

/** Runs the bundled routing evaluation set against the bundled catalog (automatic mode, no project). */
export function runRoutingEvaluation(packageRoot: string = PACKAGE_ROOT): RoutingMetrics {
  const { classifier, route } = evalRouter(packageRoot);
  return evaluateRouting(readItems<LabelledTask>(packageRoot, 'classification.yaml'), (text) => classifier.classify(text), route);
}

/** Runs the sensitive-impact review cases (ADR-014) against the bundled catalog. */
export function runSensitivityEvaluation(packageRoot: string = PACKAGE_ROOT): SensitivityMetrics {
  const { classifier, route } = evalRouter(packageRoot);
  return evaluateSensitivity(readItems<SensitivityCase>(packageRoot, 'sensitivity.yaml'), (text) => route(text, classifier.classify(text)));
}

if (require.main === module) {
  for (const [name, run] of [['routing', runRoutingEvaluation], ['sensitivity', runSensitivityEvaluation]] as const) {
    const { failures, ...metrics } = run();
    process.stdout.write(`${name}: ${JSON.stringify(metrics, null, 2)}\n${failures.length} failure(s):\n${failures.join('\n')}\n`);
  }
}

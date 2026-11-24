import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { evaluateRouting, type LabelledTask, type RoutingMetrics } from '../core/evaluation';
import { TaskClassifier } from '../core/planning';
import { routeTask } from '../core/routing';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../registry';

const PACKAGE_ROOT = join(__dirname, '..', '..');

/** Runs the bundled routing evaluation set against the bundled catalog (automatic mode, no project). */
export function runRoutingEvaluation(packageRoot: string = PACKAGE_ROOT): RoutingMetrics {
  const report = validateCatalog(join(packageRoot, 'catalog'));
  const registry = new Registry(report.entries);
  const knowledge = new KnowledgeIndex(report.loaded);
  const profile = registry.get('profile.standard') as ProfileEntry;
  const classifier = new TaskClassifier(registry);
  const { items } = parse(readFileSync(join(packageRoot, 'benchmarks', 'eval', 'classification.yaml'), 'utf8')) as { items: LabelledTask[] };
  return evaluateRouting(
    items,
    (text) => classifier.classify(text),
    (text, classification) =>
      routeTask({ id: 'eval', task: text, mode: 'automatic', classification, registry, knowledge, profile, policies: report.policies, project: null, overrides: {}, contextT0Bytes: 0 }),
  );
}

if (require.main === module) {
  const { failures, ...metrics } = runRoutingEvaluation();
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n${failures.length} failure(s):\n${failures.join('\n')}\n`);
}

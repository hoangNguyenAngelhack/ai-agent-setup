import { join, relative, resolve } from 'node:path';
import { checkContextBudget, measureContext, selectProfileEntries } from '../core/context';
import { ADAPTER_IDS, ENTITY_KINDS, KnowledgeIndex, Registry, validateCatalog } from '../registry';

/** `catalog validate`: prints diagnostics and per-kind counts; returns the process exit code. */
export function runCatalogValidate(catalogDir: string, write: (line: string) => void): number {
  const report = validateCatalog(catalogDir);
  const registry = new Registry(report.entries);

  for (const diagnostic of report.diagnostics) {
    const file = diagnostic.file ? relative(catalogDir, diagnostic.file) : '';
    write(`${diagnostic.severity} ${diagnostic.code} ${diagnostic.entryId ?? '-'} ${file}: ${diagnostic.message}`);
  }

  const counts = registry.countByKind();
  const summary = ENTITY_KINDS.filter((kind) => counts[kind]).map((kind) => `${kind}: ${counts[kind]}`);
  const errors = report.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = report.diagnostics.length - errors;
  write(`Catalog ${catalogDir}`);
  write(`  ${summary.join(', ') || 'no entries'}`);
  write(`  ${errors} errors, ${warnings} warnings`);
  if (report.ok) writeContextSummary(registry, new KnowledgeIndex(report.loaded), write);

  return report.ok ? 0 : 1;
}

/** Measured always-loaded (T0) catalog bytes per profile and adapter budget (docs/v2/05 §8). */
function writeContextSummary(registry: Registry, knowledge: KnowledgeIndex, write: (line: string) => void): void {
  for (const profile of registry.list('Profile')) {
    const context = measureContext(selectProfileEntries(registry, profile), knowledge);
    const budgets = ADAPTER_IDS.map((adapter) => {
      const check = checkContextBudget(context, profile, adapter);
      if (check.budget === null) return `${adapter} budget not set`;
      return `${adapter} budget ${check.budget}: ${check.withinBudget ? 'within' : 'OVER'}`;
    });
    write(`  Context T0 ${profile.id}: ${context.tiers.T0.bytes} bytes (measured); ${budgets.join('; ')}`);
  }
}

if (require.main === module) {
  const catalogDir = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, '..', '..', 'catalog');
  process.exitCode = runCatalogValidate(catalogDir, (line) => process.stdout.write(`${line}\n`));
}

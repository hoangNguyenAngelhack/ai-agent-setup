import { basename } from 'node:path';
import type { ImpactReport, ProjectModel, RiskLevel } from '../contracts';
import { matchesAnyGlob } from '../../shared/glob';
import { areaRulesFor, AREA_RULES } from './areas';
import { ownersOf } from './codeowners';
import { moduleOf } from './model';

const TEST_PATTERNS = AREA_RULES.find((rule) => rule.id === 'tests')!.patterns;
const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** Test files whose name starts with the changed file's name, e.g. auth.service.ts → auth.service.spec.ts. */
function relatedTests(model: ProjectModel, files: string[]): string[] {
  const tests = model.paths.filter((path) => matchesAnyGlob(path, TEST_PATTERNS));
  return unique(
    files.flatMap((file) => {
      if (matchesAnyGlob(file, TEST_PATTERNS)) return [file];
      const stem = basename(file).replace(/\.[^.]+$/, '');
      return tests.filter((test) => basename(test).startsWith(`${stem}.`));
    }),
  );
}

function groupOwners(model: ProjectModel, files: string[]): ImpactReport['owners'] {
  const groups = new Map<string, { owners: string[]; files: string[] }>();
  for (const file of files) {
    const owners = ownersOf(file, model.owners);
    if (owners.length === 0) continue;
    const key = owners.join(' ');
    const group = groups.get(key) ?? { owners, files: [] };
    group.files.push(file);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Impact Analysis (W2.1-02): what a set of changed files touches, and how risky it is. */
export function analyzeImpact(model: ProjectModel, changedFiles: readonly string[]): ImpactReport {
  const files = unique(changedFiles.map((file) => file.replace(/^\.\//, '')));
  const byArea = new Map<string, ImpactReport['areas'][number]>();
  const unmappedFiles: string[] = [];

  for (const file of files) {
    const rules = areaRulesFor(file);
    if (rules.length === 0) unmappedFiles.push(file);
    for (const rule of rules) {
      const known = model.areas.find((area) => area.id === rule.id);
      const area = byArea.get(rule.id) ?? { id: rule.id, files: [], capabilities: known?.capabilities ?? rule.capabilities, ...(rule.risk ? { risk: rule.risk } : {}) };
      area.files.push(file);
      byArea.set(rule.id, area);
    }
  }

  const areas = [...byArea.values()];
  const capabilities = unique(areas.flatMap((area) => area.capabilities));
  let risk: RiskLevel = 'low';
  const riskReasons: string[] = [];
  for (const area of areas) {
    if (!area.risk) continue;
    riskReasons.push(`${area.risk.reason} (${area.files.join(', ')})`);
    if (RISK_ORDER[area.risk.level] > RISK_ORDER[risk]) risk = area.risk.level;
  }

  return {
    files,
    modules: unique(files.map(moduleOf)),
    areas,
    capabilities,
    domains: unique(capabilities.map((id) => id.split('.')[0]!)),
    risk,
    riskReasons,
    relatedTests: relatedTests(model, files),
    owners: groupOwners(model, files),
    unmappedFiles,
  };
}

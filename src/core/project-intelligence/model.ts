import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { ProjectArea, ProjectModel, ProjectModule, ProjectProfile } from '../contracts';
import { areaRulesFor, capabilitiesOf } from './areas';
import { CODEOWNERS_LOCATIONS, parseCodeowners } from './codeowners';

const DEFAULT_MAX_FILES = 20_000;
const MODULE_DEPTH = 3;
const SAMPLE_SIZE = 3;
const SKIPPED = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'target', 'bin', 'obj', '__pycache__']);
/** Hidden directories are skipped (VCS data, editor and tool state) except CI configuration. */
const VISIBLE_HIDDEN = new Set(['.github', '.gitlab', '.circleci']);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.go': 'go', '.java': 'java', '.kt': 'kotlin', '.cs': 'csharp', '.rb': 'ruby', '.php': 'php',
  '.rs': 'rust', '.swift': 'swift', '.dart': 'dart', '.sql': 'sql', '.vue': 'vue', '.svelte': 'svelte',
};

function listFiles(root: string, maxFiles: number): { paths: string[]; truncated: boolean } {
  const paths: string[] = [];
  let truncated = false;
  const walk = (relative: string) => {
    let entries;
    try {
      entries = readdirSync(join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const entry of entries) {
      if (paths.length >= maxFiles) {
        truncated = true;
        return;
      }
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIPPED.has(entry.name) || (entry.name.startsWith('.') && !VISIBLE_HIDDEN.has(entry.name))) continue;
        walk(path);
      } else if (entry.isFile()) paths.push(path);
    }
  };
  walk('');
  return { paths, truncated };
}

export function moduleOf(path: string): string {
  const parts = path.split('/').slice(0, -1);
  return parts.length === 0 ? '.' : parts.slice(0, MODULE_DEPTH).join('/');
}

function readOwners(root: string): ProjectModel['owners'] {
  for (const location of CODEOWNERS_LOCATIONS) {
    try {
      return parseCodeowners(readFileSync(join(root, location), 'utf8'));
    } catch {
      // not present at this location
    }
  }
  return [];
}

/**
 * Project Intelligence (docs/v2/05 §5 module 2): a bounded scan into modules, areas (with risk)
 * and CODEOWNERS rules. Deterministic; reads only file names and CODEOWNERS.
 */
export function buildProjectModel(root: string, profile: ProjectProfile, maxFiles = DEFAULT_MAX_FILES): ProjectModel {
  const { paths, truncated } = listFiles(root, maxFiles);
  const modules = new Map<string, ProjectModule>();
  const areas = new Map<string, ProjectArea>();

  for (const path of paths) {
    const module = modules.get(moduleOf(path)) ?? { path: moduleOf(path), files: 0, languages: [], areas: [] };
    module.files += 1;
    const language = LANGUAGE_BY_EXTENSION[extname(path).toLowerCase()];
    if (language && !module.languages.includes(language)) module.languages.push(language);
    for (const rule of areaRulesFor(path)) {
      const area = areas.get(rule.id) ?? { id: rule.id, files: 0, capabilities: capabilitiesOf(rule, profile), ...(rule.risk ? { risk: rule.risk } : {}), sample: [] };
      area.files += 1;
      if (area.sample.length < SAMPLE_SIZE) area.sample.push(path);
      areas.set(rule.id, area);
      if (!module.areas.includes(rule.id)) module.areas.push(rule.id);
    }
    modules.set(module.path, module);
  }

  return {
    root,
    files: paths.length,
    truncated,
    paths,
    modules: [...modules.values()].sort((a, b) => a.path.localeCompare(b.path)),
    areas: [...areas.values()],
    owners: readOwners(root),
  };
}

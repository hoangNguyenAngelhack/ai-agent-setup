import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { SchemaValidator } from '../../registry';

/** One benchmark task (docs/v2/09 §5.3); contract `benchmark-task/v1`. */
export interface BenchmarkTask {
  schema: 'benchmark-task/v1';
  id: string;
  category: string;
  domains: string[];
  fixture: string;
  prompt: string;
  scope: string[];
  acceptance: {
    hiddenTests?: { files: string; target?: string; command: string };
    rubric?: { threshold: number; criteria: string[] };
  };
  timeLimit: number;
  securityChecks?: Array<{ name: string; command: string }>;
}

const PACKAGE_ROOT = join(__dirname, '..', '..', '..');
const TASK_SCHEMA = 'urn:ai-agent-setup:contracts:v1:benchmark-task';

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

/** Every `*.yaml` under `<suite>/tasks`, validated, with its fixture and hidden test folders present. */
export function loadSuite(suiteDir: string): BenchmarkTask[] {
  const dir = join(suiteDir, 'tasks');
  if (!isDirectory(dir)) throw new Error(`No tasks directory in ${suiteDir}`);
  const validator = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas'));
  const tasks = readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => {
      const task = parse(readFileSync(join(dir, name), 'utf8')) as BenchmarkTask;
      const check = validator.validate(TASK_SCHEMA, task);
      if (!check.valid) throw new Error(`${name}: ${check.errors.join('; ')}`);
      if (!isDirectory(join(suiteDir, task.fixture))) throw new Error(`${name}: fixture ${task.fixture} not found`);
      const hidden = task.acceptance.hiddenTests;
      if (hidden && !isDirectory(join(suiteDir, hidden.files))) throw new Error(`${name}: hidden tests ${hidden.files} not found`);
      return task;
    });
  const ids = tasks.map((task) => task.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`Duplicate task id ${duplicate}`);
  if (!tasks.length) throw new Error(`No task in ${dir}`);
  return tasks;
}

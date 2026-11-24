import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

/** Ported from V1 bin/cli.js (copyTemplate, replacePlaceholders, mergeUIConfig) with F-06 fixed. */
export const PROJECT_TYPES = ['backend', 'frontend', 'fullstack', 'mobile'] as const;
export const FRAMEWORKS_BY_TYPE = {
  backend: ['express', 'nestjs'],
  frontend: ['nextjs', 'vite'],
  mobile: ['expo', 'cli'],
  fullstack: [],
} as const;
export const UI_LIBRARIES = ['shadcn', 'antd', 'chakra', 'semantic'] as const;
export const DATABASES = ['postgresql', 'mysql', 'sqlite', 'none'] as const;
export const TIERS = ['starter', 'standard', 'strict'] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type Framework = 'express' | 'nestjs' | 'nextjs' | 'vite' | 'expo' | 'cli';
export type UiLibrary = (typeof UI_LIBRARIES)[number];
export type Database = (typeof DATABASES)[number];
export type Tier = (typeof TIERS)[number];

export interface TemplateValues {
  projectName: string;
  author: string;
  email: string;
  tier: Tier;
  db: Database;
}

const TEXT_EXTENSIONS = new Set(['.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.prisma', '.yml', '.yaml', '.env', '.example', '.sh']);

/** Same mapping as V1 (bin/cli.js:419-428). */
export function templateName(type: ProjectType, framework: Framework | null): string {
  if (type === 'frontend') return framework === 'nextjs' ? 'frontend-nextjs' : 'frontend-vite';
  if (type === 'mobile') return framework === 'expo' ? 'mobile-expo' : 'mobile-cli';
  if (type === 'backend') return framework === 'nestjs' ? 'backend-nestjs' : 'backend';
  return 'fullstack';
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else copyFileSync(from, to);
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function replaceInFile(path: string, values: TemplateValues): void {
  const name = path.split(/[\\/]/).at(-1) ?? '';
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase()) && !name.startsWith('.') && name !== 'package.json') return;
  const original = readFileSync(path, 'utf8');
  const replaced = original
    .replace(/\{\{PROJECT_NAME\}\}/g, values.projectName)
    .replace(/\{\{AUTHOR_NAME\}\}/g, values.author)
    .replace(/\{\{AUTHOR_EMAIL\}\}/g, values.email)
    .replace(/\{\{TIER\}\}/g, capitalize(values.tier))
    .replace(/\{\{DATABASE\}\}/g, values.db);
  if (replaced !== original) writeFileSync(path, replaced);
}

export function replacePlaceholders(target: string, values: TemplateValues): void {
  if (!statSync(target).isDirectory()) return replaceInFile(target, values);
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    replacePlaceholders(join(target, entry.name), values);
  }
}

export function copyTemplate(templatesDir: string, name: string, dest: string, values: TemplateValues): void {
  const source = join(templatesDir, name);
  if (!existsSync(source)) throw new Error(`Template "${name}" not found in ${templatesDir}`);
  copyDirRecursive(source, dest);
  replacePlaceholders(dest, values);
}

interface UiConfig {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  files?: Array<{ src: string; dest: string }>;
  tailwindMerge?: { important?: boolean; corePlugins?: { preflight?: boolean } };
}

function patchTailwindConfig(projectDir: string, merge: NonNullable<UiConfig['tailwindMerge']>): void {
  const file = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs'].map((name) => join(projectDir, name)).find(existsSync);
  if (!file) return;
  let content = readFileSync(file, 'utf8');
  if (merge.important) {
    content = content.replace('export default {', 'export default {\n  important: true,').replace('module.exports = {', 'module.exports = {\n  important: true,');
  }
  if (merge.corePlugins?.preflight === false) {
    content = content.includes('plugins: [')
      ? content.replace('plugins: [', 'corePlugins: {\n    preflight: false,\n  },\n  plugins: [')
      : content.replace(/plugins:/, 'corePlugins: {\n    preflight: false,\n  },\n  plugins:');
  }
  writeFileSync(file, content);
}

/** Merges a UI library overlay into a frontend project (V1 mergeUIConfig). */
export function mergeUiLibrary(templatesDir: string, ui: UiLibrary, projectDir: string, values: TemplateValues): void {
  const uiDir = join(templatesDir, 'ui-configs', ui);
  const config = JSON.parse(readFileSync(join(uiDir, 'config.json'), 'utf8')) as UiConfig;

  const packagePath = join(projectDir, 'package.json');
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as Record<string, Record<string, string>>;
    pkg.dependencies = { ...pkg.dependencies, ...config.dependencies };
    pkg.devDependencies = { ...pkg.devDependencies, ...config.devDependencies };
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
  }

  for (const mapping of config.files ?? []) {
    const src = join(uiDir, mapping.src);
    const dest = join(projectDir, mapping.dest);
    if (!existsSync(src)) continue;
    if (statSync(src).isDirectory()) copyDirRecursive(src, dest);
    else {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
    replacePlaceholders(dest, values);
  }
  if (config.tailwindMerge) patchTailwindConfig(projectDir, config.tailwindMerge);
}

const DATABASE_URLS: Record<Exclude<Database, 'postgresql' | 'none'>, (projectName: string) => string> = {
  mysql: (projectName) => `mysql://user:password@localhost:3306/${projectName}_dev`,
  sqlite: () => 'file:./dev.db',
};

/**
 * Applies `--db` to templates that use Prisma (fixes F-06: V1 ignored it). Returns warnings for
 * choices the template cannot honour.
 */
export function applyDatabase(projectDir: string, db: Database, projectName: string): string[] {
  const schemaPath = join(projectDir, 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath) || db === 'postgresql') return [];
  if (db === 'none') return ['This template uses Prisma and needs a database; kept PostgreSQL (--db none applies only to templates without Prisma).'];

  writeFileSync(schemaPath, readFileSync(schemaPath, 'utf8').replace('provider = "postgresql"', `provider = "${db}"`));
  const envPath = join(projectDir, '.env.example');
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, 'utf8').replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${DATABASE_URLS[db](projectName)}"`);
    writeFileSync(envPath, env);
  }
  return [`Switched Prisma to ${db}. Check that the template's schema features are supported by ${db} before migrating.`];
}

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectProfile } from '../core/contracts';
import { detectProject } from '../core/project-detection';
import { readManifest, MANIFEST_PATH } from '../installer';
import { GATES, gateReportErrors, resolveCommand, runGates, renderGateReport, validateGateConfig, type Ecosystem, type GateConfig, type GateReport, type ProjectFacts } from '../quality';
import { Registry, SchemaValidator, validateCatalog } from '../registry';
import { ensureIgnoredDir, GATES_DIR, newRunId, projectIdentity, projectPath, readJsonLines, runDir, sha256, writeJson } from './run-files';

const PACKAGE_ROOT = join(__dirname, '..', '..');
const CONFIG_PATH = '.ai-agent-setup/gates.json';
const RECORD_SCHEMA = 'urn:ai-agent-setup:contracts:v1:gate-record';
const REPORT_SCHEMA = 'urn:ai-agent-setup:contracts:v1:gate-report';

const LOCKFILES: Array<[file: string, manager: string]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

/** Test runners and linters with default commands: used only when the project declares them. */
const DECLARED_TOOLS: Ecosystem[] = ['rspec', 'minitest', 'rubocop', 'phpunit', 'pest', 'phpstan', 'ruff', 'mypy', 'swiftlint', 'ktlint', 'detekt', 'ctest'];

/** Coverage tools the project declares, keyed by how they run (Gradle or Maven, RSpec or Minitest). */
function coverageEcosystems(profile: ProjectProfile): Ecosystem[] {
  const tools = new Set(profile.coverageTools);
  return [
    ...(tools.has('pytest-cov') ? (['pytest-cov'] as const) : []),
    ...(tools.has('jacoco') && profile.buildTools.includes('gradle') ? (['jacoco-gradle'] as const) : []),
    ...(tools.has('jacoco') && profile.buildTools.includes('maven') ? (['jacoco-maven'] as const) : []),
    ...(tools.has('coverlet') ? (['coverlet'] as const) : []),
    ...(tools.has('simplecov') && profile.testRunners.includes('rspec') ? (['simplecov-rspec'] as const) : []),
    ...(tools.has('simplecov') && profile.testRunners.includes('minitest') ? (['simplecov-minitest'] as const) : []),
  ];
}

/** The stacks a project's gates can use, in priority order (the first with a default command wins). */
function stackEcosystems(profile: ProjectProfile): Set<Ecosystem> {
  const ecosystems = new Set<Ecosystem>();
  if (profile.languages.includes('go')) ecosystems.add('go');
  if (profile.languages.includes('python')) ecosystems.add('python');
  if (profile.buildTools.includes('dotnet')) ecosystems.add('dotnet');
  if (profile.languages.includes('rust')) ecosystems.add('rust');
  if (profile.buildTools.includes('maven')) ecosystems.add('maven');
  if (profile.buildTools.includes('gradle')) ecosystems.add('gradle');
  if (profile.buildTools.includes('swiftpm')) ecosystems.add('swiftpm');
  if (profile.buildTools.includes('cmake')) ecosystems.add('cmake');
  if (profile.buildTools.includes('bundler')) ecosystems.add('bundler');
  if (profile.buildTools.includes('composer')) ecosystems.add('composer');
  for (const ecosystem of coverageEcosystems(profile)) ecosystems.add(ecosystem);
  // Flutter before plain Dart: a Flutter app is tested and analysed with the flutter tool.
  if (profile.frameworks.includes('flutter')) ecosystems.add('flutter');
  else if (profile.languages.includes('dart')) ecosystems.add('dart');
  for (const tool of DECLARED_TOOLS) if (profile.testRunners.includes(tool) || profile.linters.includes(tool)) ecosystems.add(tool);
  // Android Lint after the declared linters, so ktlint or detekt win when the project uses them.
  if (profile.frameworks.includes('android') && profile.buildTools.includes('gradle')) ecosystems.add('android');
  return ecosystems;
}

/** Reads what the gate engine needs from the project (scripts, package manager, stacks). */
export function projectFacts(root: string): ProjectFacts {
  const ecosystems = stackEcosystems(detectProject(root));
  let scripts: Record<string, string> = {};
  const hasPackageJson = existsSync(join(root, 'package.json'));
  if (hasPackageJson) {
    ecosystems.add('node');
    try {
      scripts = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {};
    } catch {
      scripts = {};
    }
  }
  const lockfiles = LOCKFILES.map(([file]) => file).filter((file) => existsSync(join(root, file)));
  const manager = LOCKFILES.find(([file]) => lockfiles.includes(file))?.[1] ?? (hasPackageJson ? 'npm' : null);
  return { ecosystems: [...ecosystems], nodePackageManager: manager, scripts, lockfiles };
}

export function readGateConfig(root: string): GateConfig {
  const file = join(root, CONFIG_PATH);
  if (!existsSync(file)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${CONFIG_PATH} is not valid JSON: ${(error as Error).message}`);
  }
  const { config, problems } = validateGateConfig(raw);
  if (problems.length) throw new Error(`${CONFIG_PATH}: ${problems.join('; ')}`);
  return config;
}

/** Required gates = the profile's gates (installed profile, else the given one) plus configured extras. */
export function requiredGates(root: string, profileId: string | undefined, config: GateConfig): { profile: string; gates: string[] } {
  const installed = existsSync(join(root, MANIFEST_PATH)) ? readManifest(root)?.profile : undefined;
  const id = profileId ?? installed ?? 'profile.standard';
  const report = validateCatalog(join(PACKAGE_ROOT, 'catalog'));
  const profile = new Registry(report.entries).get(id);
  if (profile?.kind !== 'Profile') throw new Error(`Unknown profile "${id}"`);
  return { profile: id, gates: [...new Set([...profile.gates, ...(config.required ?? [])])] };
}

export interface GateRunOptions {
  root: string;
  gates?: string[];
  skip?: string[];
  runId?: string;
  profileId?: string;
  signal?: AbortSignal;
  now?: () => Date;
}

export interface GateRunOutcome {
  report: GateReport;
  profile: string;
  reportPath: string;
  /** Project-relative folder of this invocation's records (`…/gates/g<n>`). */
  recordsDir: string;
}

const GATE_ID = /^gate\.[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Each gate invocation of a run gets its own folder (`gates/g1`, `gates/g2`, …), so evidence that an
 * earlier event points to is never overwritten.
 */
function nextInvocation(dir: string): string {
  const used = existsSync(join(dir, 'gates')) ? readdirSync(join(dir, 'gates')).filter((name) => /^g\d+$/.test(name)).length : 0;
  return `g${used + 1}`;
}

/**
 * A report that fails the gate-report contract is never stored as it stands: PASS becomes
 * NOT_VERIFIED with the errors (FAIL and NOT_VERIFIED are kept). Still invalid: nothing is written.
 */
export function checkedGateReport(report: GateReport, validateSchema: (value: unknown) => { valid: boolean; errors: string[] }): GateReport {
  const errorsOf = (value: GateReport) => {
    const check = validateSchema(value);
    return check.valid ? gateReportErrors(value) : check.errors;
  };
  const errors = errorsOf(report);
  if (errors.length === 0) return report;
  if (report.status !== 'PASS') throw new Error(`Gate report ${report.runId} is invalid: ${errors.join('; ')}`);
  const downgraded: GateReport = { ...report, status: 'NOT_VERIFIED', reason: `report failed contract validation: ${errors.join('; ')}` };
  const remaining = errorsOf(downgraded).filter((error) => !error.startsWith('/status:'));
  if (remaining.length) throw new Error(`Gate report ${report.runId} is invalid: ${remaining.join('; ')}`);
  return downgraded;
}

/** Runs the gates, stores records, report and history under .ai-agent-setup (git-ignored). */
export async function runQualityGates(options: GateRunOptions): Promise<GateRunOutcome> {
  const now = options.now ?? (() => new Date());
  const config = readGateConfig(options.root);
  const required = requiredGates(options.root, options.profileId, config);
  const invalid = [...(options.gates ?? []), ...(options.skip ?? [])].filter((id) => !GATE_ID.test(id));
  if (invalid.length) throw new Error(`Invalid gate id(s): ${invalid.join(', ')} (expected gate.<name>)`);
  const runId = options.runId ?? newRunId(now());
  const dir = runDir(options.root, runId);
  const invocation = nextInvocation(dir);
  const recordsDir = join(dir, 'gates', invocation);
  mkdirSync(recordsDir, { recursive: true });
  mkdirSync(join(dir, 'evidence', invocation), { recursive: true });
  const validator = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas'));
  const engineReport = await runGates(
    { gates: options.gates ?? [], required: required.gates, skip: options.skip ?? [] },
    {
      runId,
      root: options.root,
      project: projectIdentity(options.root),
      environment: { platform: process.platform, arch: process.arch, node: process.version, ci: Boolean(process.env.CI) },
      facts: projectFacts(options.root),
      config,
      evidence: {
        write: (gate, name, content) => {
          const file = join(dir, 'evidence', invocation, `${gate}.${name}`);
          writeFileSync(file, content);
          return { path: projectPath(options.root, file), checksum: sha256(content) };
        },
      },
      validate: (record) => validator.validate(RECORD_SCHEMA, record),
      now,
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  const report = checkedGateReport(engineReport, (value) => validator.validate(REPORT_SCHEMA, value));
  for (const record of report.records) writeJson(join(recordsDir, `${record.gate}.json`), record);
  writeJson(join(recordsDir, 'report.json'), report);
  writeFileSync(join(recordsDir, 'report.md'), renderGateReport(report));
  const history = join(ensureIgnoredDir(options.root, GATES_DIR), 'history.jsonl');
  for (const record of report.records) {
    appendFileSync(history, `${JSON.stringify({ runId, gate: record.gate, status: record.status, at: record.endedAt, durationMs: record.durationMs, commit: record.project.commit, reason: record.reason })}\n`);
  }
  return { report, profile: required.profile, reportPath: projectPath(options.root, join(recordsDir, 'report.md')), recordsDir: projectPath(options.root, recordsDir) };
}

export interface GateListing {
  id: string;
  category: string;
  support: string;
  required: boolean;
  command: string | null;
  source: string;
}

/** Every registered gate with its support status and the command it would run in this project. */
export function listGates(root: string, profileId?: string): { profile: string; gates: GateListing[]; unknownRequired: string[] } {
  const config = readGateConfig(root);
  const facts = projectFacts(root);
  const required = requiredGates(root, profileId, config);
  const gates = GATES.map((definition) => {
    const resolved = definition.support === 'composite' ? { command: null, source: 'composite' } : resolveCommand(definition, facts, config);
    return { id: definition.id, category: definition.category, support: definition.support, required: required.gates.includes(definition.id), command: resolved.command, source: resolved.source };
  });
  return { profile: required.profile, gates, unknownRequired: required.gates.filter((id) => !GATES.some((definition) => definition.id === id)) };
}

export interface HistoryEntry {
  runId: string;
  gate: string;
  status: string;
  at: string;
  durationMs: number;
  commit: string | null;
  reason: string | null;
}

export function readGateHistory(root: string, gate?: string): HistoryEntry[] {
  return readJsonLines<HistoryEntry>(join(root, GATES_DIR, 'history.jsonl')).items.filter((entry) => !gate || entry.gate === gate);
}

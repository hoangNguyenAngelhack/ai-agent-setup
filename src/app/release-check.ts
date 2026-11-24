import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { SchemaValidator } from '../registry';
import { redactText } from '../shared/redact';
import { projectIdentity } from './run-files';

/**
 * Release readiness (W2.2-08). Automated gates are run and measured: PASS, FAIL, or NOT_VERIFIED when
 * a gate could not run (for example `npm audit` without network). Decisions that belong to people
 * (version, ADR acceptance, real-host verification, CI on the release commit) are the sign-off list in
 * docs/v2/13-release-checklist.md; a box is ticked there in a reviewed change, never by this script.
 * READY needs every gate PASS and every sign-off ticked.
 */
const PACKAGE_ROOT = join(__dirname, '..', '..');

export const RELEASE_CHECK_SCHEMA = 'urn:ai-agent-setup:contracts:v1:release-check';
export const CHECKLIST_FILE = join('docs', 'v2', '13-release-checklist.md');

export type GateStatus = 'PASS' | 'FAIL' | 'NOT_VERIFIED';

export interface ReleaseGate {
  id: string;
  title: string;
  status: GateStatus;
  evidence: string;
}

export interface SignOff {
  id: string;
  item: string;
  owner: string;
  done: boolean;
}

export interface ReleaseReport {
  schemaVersion: 'release-check/v1';
  generatedAt: string;
  package: { name: string; version: string };
  project: { commit: string | null; dirty: boolean };
  gates: ReleaseGate[];
  signOff: SignOff[];
  status: 'READY' | 'NOT_READY';
  blockers: string[];
}

export type CommandResult = { code: number | null; stdout: string; stderr: string };
export type Runner = (command: string, args: string[]) => CommandResult;

export const runCommand: Runner = (command, args) => {
  // npm is a .cmd shim on Windows and needs a shell there.
  const result = spawnSync(command, args, { cwd: PACKAGE_ROOT, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? result.error?.message ?? '' };
};

const lastLine = (text: string) => text.trim().split('\n').filter(Boolean).at(-1) ?? '';
const gate = (id: string, title: string, status: GateStatus, evidence: string): ReleaseGate => ({ id, title, status, evidence });

/** The output line worth keeping as evidence: the last one matching `summary`, else the last line. */
function evidenceLine(result: CommandResult, summary?: RegExp): string {
  const lines = `${result.stdout}\n${result.stderr}`.split('\n').map((line) => line.trim());
  return (summary && lines.filter((line) => summary.test(line)).at(-1)) || lastLine(result.stdout) || lastLine(result.stderr);
}

function commandGate(run: Runner, id: string, title: string, command: string, args: string[], summary?: RegExp): ReleaseGate {
  const result = run(command, args);
  const shown = `${command} ${args.join(' ')}`;
  if (result.code === null) return gate(id, title, 'NOT_VERIFIED', `${shown} did not run: ${lastLine(result.stderr) || 'no exit code'}`);
  const tail = evidenceLine(result, summary);
  return gate(id, title, result.code === 0 ? 'PASS' : 'FAIL', `${shown}: exit ${result.code}${tail ? `; ${tail.slice(0, 200)}` : ''}`);
}

/** `npm audit --json`: no high or critical advisory. An audit that could not reach the registry proves nothing. */
export function auditGate(result: CommandResult): ReleaseGate {
  const title = 'No high or critical advisory in dependencies';
  let report: { metadata?: { vulnerabilities?: Record<string, number> }; error?: { summary?: string } };
  try {
    report = JSON.parse(result.stdout) as typeof report;
  } catch {
    return gate('audit', title, 'NOT_VERIFIED', `npm audit gave no report: ${lastLine(result.stderr) || 'empty output'}`);
  }
  const counts = report.metadata?.vulnerabilities;
  if (!counts) return gate('audit', title, 'NOT_VERIFIED', `npm audit failed: ${report.error?.summary ?? 'no vulnerability counts'}`);
  const serious = (counts.high ?? 0) + (counts.critical ?? 0);
  const summary = ['critical', 'high', 'moderate', 'low'].map((level) => `${counts[level] ?? 0} ${level}`).join(', ');
  return gate('audit', title, serious ? 'FAIL' : 'PASS', `npm audit: ${summary}`);
}

const REQUIRED_FILES = ['package.json', 'README.md', 'LICENSE', 'bin/cli.js'];
const REQUIRED_DIRS = ['dist/', 'catalog/schemas/'];
const FORBIDDEN: Array<[RegExp, string]> = [
  [/(^|\/)\.env(\.(?!example$)[^/]*)?$/, 'environment file'],
  [/\.(pem|key|p12|pfx)$/, 'key material'],
  [/(^|\/)(tests?|coverage|node_modules)\//, 'development files'],
  [/(^|\/)\.ai-agent-setup\//, 'toolkit run state'],
  [/(^|\/)settings\.local\.json$/, 'local settings'],
  // docs/v2/07 §5: removed in 2.0, generated from catalog/ instead.
  [/^templates\/\.(claude|agents)\//, 'V1 template configuration removed in 2.0 (07 §5)'],
];

/** Problems with the file list `npm pack` would publish. */
export function packageProblems(files: string[]): string[] {
  const missing = [
    ...REQUIRED_FILES.filter((file) => !files.includes(file)).map((file) => `missing ${file}`),
    ...REQUIRED_DIRS.filter((dir) => !files.some((file) => file.startsWith(dir))).map((dir) => `missing ${dir}`),
  ];
  const forbidden = files.flatMap((file) => FORBIDDEN.filter(([pattern]) => pattern.test(file)).map(([, why]) => `${file}: ${why}`));
  return [...missing, ...forbidden];
}

export function packedFiles(run: Runner): { files: string[] } | { error: string } {
  const result = run('npm', ['pack', '--dry-run', '--json']);
  try {
    const [entry] = JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>;
    return { files: entry!.files.map((file) => file.path).sort() };
  } catch {
    return { error: `npm pack --dry-run gave no file list: ${lastLine(result.stderr) || `exit ${result.code}`}` };
  }
}

/** High-confidence secret rules only: placeholders such as `JWT_SECRET=...` in templates are not secrets. */
const SECRET_RULES = new Set(['private-key', 'url-credentials', 'github-token', 'api-key', 'slack-token', 'aws-access-key', 'jwt']);
const MAX_SCANNED_BYTES = 1024 * 1024;
/** Example connection strings (`user:password@localhost`, `USER:PASSWORD@HOST`) are not credentials. */
const EXAMPLE_URL_CREDENTIALS = /:\/\/[^\s/:@]+:[^\s/@]+@(?=(localhost|127\.0\.0\.1|[A-Z_]+)(?![A-Za-z0-9.-]*\.[a-z]))/g;

export function secretFindings(root: string, files: string[]): string[] {
  return files.flatMap((file) => {
    const path = join(root, file);
    if (!existsSync(path) || statSync(path).size > MAX_SCANNED_BYTES) return [];
    const text = readFileSync(path, 'utf8');
    if (text.includes('\0')) return [];
    const scanned = text
      .split('\n')
      .filter((line) => !line.includes('secret-scan:allow'))
      .join('\n')
      .replace(EXAMPLE_URL_CREDENTIALS, '://');
    return Object.entries(redactText(scanned).redactions)
      .filter(([label]) => SECRET_RULES.has(label))
      .map(([label, count]) => `${file}: ${count} ${label}`);
  });
}

function markdownFiles(root: string): string[] {
  const walk = (dir: string): string[] =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
          const path = `${dir}/${entry.name}`;
          if (entry.isDirectory()) return walk(path);
          return entry.name.endsWith('.md') ? [path] : [];
        })
      : [];
  return [...['README.md', 'README.vi.md', 'CHANGELOG.md'].filter((file) => existsSync(join(root, file))), ...walk('docs'), ...walk('benchmarks')];
}

const LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Relative links in the documentation that point to no file (code blocks are skipped). */
export function brokenLinks(root: string, files: string[] = markdownFiles(root)): string[] {
  return files.flatMap((file) => {
    const text = readFileSync(join(root, file), 'utf8').replace(/```[\s\S]*?```/g, '');
    return [...text.matchAll(LINK)].flatMap(([, target]) => {
      if (/^([a-z]+:|#)/i.test(target!)) return [];
      const path = decodeURI(target!.split('#')[0]!.split('?')[0]!);
      const absolute = resolve(root, dirname(file), path);
      const inside = !relative(root, absolute).startsWith(`..${sep}`);
      return inside && existsSync(absolute) ? [] : [`${file}: ${target}`];
    });
  });
}

/** The lowest Node version the package accepts must be one CI tests (docs/v2/10 OQ-07). */
export function enginesGate(enginesNode: string | undefined, ciWorkflow: string): ReleaseGate {
  const title = 'Lowest supported Node version is tested in CI';
  const declared = /^>=\s*(\d+)/.exec(enginesNode ?? '')?.[1];
  const matrix = /^\s*node:\s*\[([^\]]+)\]/m.exec(ciWorkflow)?.[1];
  const tested = matrix?.split(',').map((item) => Number.parseInt(item.trim().replace(/['"]/g, ''), 10)).filter(Number.isFinite);
  if (!declared || !tested?.length) return gate('engines', title, 'NOT_VERIFIED', `cannot read engines.node (${enginesNode ?? 'missing'}) or the CI node matrix`);
  const lowest = Math.min(...tested);
  const evidence = `engines.node ${enginesNode}; CI tests Node ${tested.join(', ')}`;
  return Number(declared) === lowest ? gate('engines', title, 'PASS', evidence) : gate('engines', title, 'FAIL', `${evidence}: Node ${declared} is accepted but never tested; decide OQ-07 (docs/v2/10)`);
}

const SIGN_OFF = /^- \[( |x)\] \*\*(S\d+)\*\* (.+?) — owner: (.+)$/;

export function readSignOff(checklist: string): SignOff[] {
  return checklist.split('\n').flatMap((line) => {
    const match = SIGN_OFF.exec(line.trim());
    return match ? [{ id: match[2]!, item: match[3]!, owner: match[4]!, done: match[1] === 'x' }] : [];
  });
}

const fileGate = (id: string, title: string, problems: string[], ok: string): ReleaseGate =>
  gate(id, title, problems.length ? 'FAIL' : 'PASS', problems.length ? `${problems.length}: ${problems.slice(0, 10).join('; ')}${problems.length > 10 ? '; …' : ''}` : ok);

const readText = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/** Gates that run a command; those that need `dist/` are NOT_VERIFIED after a failed build. */
function commandGates(run: Runner, version: string): ReleaseGate[] {
  const build = commandGate(run, 'build', 'Build', 'npm', ['run', 'build']);
  const built = build.status === 'PASS';
  const afterBuild = (id: string, title: string, command: string, args: string[]) =>
    built ? commandGate(run, id, title, command, args) : gate(id, title, 'NOT_VERIFIED', 'the build failed, so this gate could not run');
  return [
    build,
    commandGate(run, 'typecheck', 'Typecheck', 'npm', ['run', 'typecheck']),
    commandGate(run, 'lint', 'Lint with no warnings', 'npm', ['run', 'lint']),
    commandGate(run, 'tests', 'Tests with coverage thresholds', 'npm', ['run', 'test:coverage'], /^Tests\s+\d+/),
    afterBuild('catalog', 'Catalog validates', 'node', ['dist/cli/catalog-validate.js']),
    afterBuild('eval-regressions', 'No regression against the evaluation baseline', 'node', ['dist/app/eval-regression.js']),
    auditGate(run('npm', ['audit', '--json'])),
    cliVersionGate(run('node', ['bin/cli.js', '--version']).stdout.trim(), version, built),
  ];
}

function cliVersionGate(printed: string, version: string, built: boolean): ReleaseGate {
  const title = 'CLI reports the package version';
  const evidence = `--version printed "${printed.slice(0, 80)}"; package.json ${version}`;
  if (!built) return gate('cli-version', title, 'NOT_VERIFIED', evidence);
  return gate('cli-version', title, printed.includes(version) ? 'PASS' : 'FAIL', evidence);
}

function packageGates(root: string, run: Runner): ReleaseGate[] {
  const contents = 'Published files: required present, nothing private';
  const secrets = 'No secret in published files';
  const packed = packedFiles(run);
  if ('error' in packed) return [gate('package-contents', contents, 'NOT_VERIFIED', packed.error), gate('package-secrets', secrets, 'NOT_VERIFIED', packed.error)];
  return [
    fileGate('package-contents', contents, packageProblems(packed.files), `${packed.files.length} files`),
    fileGate('package-secrets', secrets, secretFindings(root, packed.files), `${packed.files.length} files scanned`),
  ];
}

function changelogGate(changelog: string, version: string): ReleaseGate {
  const heading = `## [${version}]`;
  const listed = changelog.includes(heading);
  return gate('changelog', 'CHANGELOG has an entry for the package version', listed ? 'PASS' : 'FAIL', listed ? `${heading} found` : `no "${heading}" heading in CHANGELOG.md`);
}

function blockersOf(gates: ReleaseGate[], signOff: SignOff[]): string[] {
  return [
    ...gates.filter((item) => item.status !== 'PASS').map((item) => `gate ${item.id}: ${item.status}`),
    ...(signOff.length ? [] : [`no sign-off list in ${CHECKLIST_FILE}`]),
    ...signOff.filter((item) => !item.done).map((item) => `sign-off ${item.id} open: ${item.item} (${item.owner})`),
  ];
}

export function checkRelease(options: { root?: string; run?: Runner; now?: Date } = {}): ReleaseReport {
  const root = options.root ?? PACKAGE_ROOT;
  const run = options.run ?? runCommand;
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; version: string; engines?: { node?: string } };
  const gates = [
    ...commandGates(run, pkg.version),
    ...packageGates(root, run),
    fileGate('docs-links', 'Relative documentation links resolve', brokenLinks(root), 'all relative links resolve'),
    enginesGate(pkg.engines?.node, readText(join(root, '.github', 'workflows', 'ci.yml'))),
    changelogGate(readText(join(root, 'CHANGELOG.md')), pkg.version),
  ];
  const signOff = readSignOff(readText(join(root, CHECKLIST_FILE)));
  const blockers = blockersOf(gates, signOff);
  const { commit, dirty } = projectIdentity(root);
  const report: ReleaseReport = {
    schemaVersion: 'release-check/v1',
    generatedAt: (options.now ?? new Date()).toISOString(),
    package: { name: pkg.name, version: pkg.version },
    project: { commit, dirty },
    gates,
    signOff,
    status: blockers.length ? 'NOT_READY' : 'READY',
    blockers,
  };
  const check = new SchemaValidator(join(PACKAGE_ROOT, 'catalog', 'schemas')).validate(RELEASE_CHECK_SCHEMA, report);
  if (!check.valid) throw new Error(`Release check report is invalid: ${check.errors.join('; ')}`);
  return report;
}

export function renderReleaseReport(report: ReleaseReport): string {
  const lines = [
    `# Release check: ${report.package.name}@${report.package.version}: ${report.status}`,
    '',
    `- Commit: ${report.project.commit ?? 'none'}${report.project.dirty ? ' (uncommitted changes)' : ''}; generated ${report.generatedAt}`,
    '',
    '| Gate | Status | Evidence |',
    '|---|---|---|',
    ...report.gates.map((item) => `| ${item.title} | ${item.status} | ${item.evidence.replace(/\|/g, '\\|')} |`),
    '',
    `## Sign-off (${CHECKLIST_FILE.split(sep).join('/')})`,
    '',
    ...report.signOff.map((item) => `- [${item.done ? 'x' : ' '}] ${item.id} ${item.item} (owner: ${item.owner})`),
  ];
  if (report.blockers.length) lines.push('', '## Blockers', '', ...report.blockers.map((item) => `- ${item}`));
  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const report = checkRelease();
  process.stdout.write(process.argv.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : renderReleaseReport(report));
  process.exitCode = report.status === 'READY' ? 0 : 1;
}

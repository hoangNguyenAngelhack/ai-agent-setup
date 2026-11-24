import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createProject } from '../app/create';
import { runSetup, type SetupOutcome } from '../app/setup';
import { doctor, rollback, type ConflictStrategy, type PlannedChange } from '../installer';
import { ADAPTER_IDS, type AdapterId } from '../registry';
import { oneOf, parseArgs, single, UsageError, type ParsedArgs } from './args';
import { runCatalogValidate } from './catalog-validate';
import { resolveCreateConfig, type Ask } from './create-config';

const PACKAGE_ROOT = join(__dirname, '..', '..');
const BIN = 'create-ai-agent-setup';
const STRATEGIES: readonly ConflictStrategy[] = ['write-new', 'skip', 'backup-overwrite'];

export interface CliIO {
  cwd: string;
  write: (text: string) => void;
  error: (text: string) => void;
  /** Interactive question; null when stdin is not a terminal. */
  ask: Ask | null;
}

const HELP = `${BIN} — Universal AI Engineering OS toolkit (V2 preview)

Usage:
  ${BIN} [project-name] [options]        Create a new project (V1 compatible)
  ${BIN} create <project-name> [options]
  ${BIN} setup [dir] [options]           Add AI engineering configuration to an existing project
  ${BIN} diff [dir] [options]            Show what setup would change (no writes)
  ${BIN} doctor [dir]                    Check an install against its manifest
  ${BIN} rollback [dir] [--force]        Undo the latest install transaction
  ${BIN} catalog validate [catalog-dir]  Validate a catalog

Create options (V1):
  -t, --type <type>        backend, frontend, fullstack, mobile
  -f, --framework <fw>     backend: express, nestjs · frontend: nextjs, vite · mobile: expo, cli
  -u, --ui <library>       frontend only: shadcn, antd, chakra, semantic
  -T, --tier <tier>        starter, standard, strict (selects the profile)
  -d, --db <database>      postgresql, mysql, sqlite, none
  -c, --codegraph          Run the third-party CodeGraph setup (network)
  -H, --honesty            Include the honesty rule
  -y, --yes                Use defaults; do not prompt

Setup / diff options:
  -a, --adapter <ids>      claude-code, codex (comma separated; default: detected, else claude-code)
      --profile <id>       Profile id (default profile.standard)
      --strategy <s>       Conflicts: write-new (default), skip, backup-overwrite
      --enable-tool <id>   Opt in to a tool entry, e.g. tool.mcp-github (repeatable)
      --dry-run            Plan only
  -y, --yes                Apply without asking

  -h, --help               Show this help
  -v, --version            Show the version
`;

function packageVersion(): string {
  return (JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;
}

function adaptersOf(args: ParsedArgs): AdapterId[] | undefined {
  return args.values.get('adapter')?.map((id) => oneOf('adapter', id, ADAPTER_IDS)!);
}

function changeNote(change: PlannedChange): string {
  if (change.target !== change.path) return `  ← conflict: ${change.reason}`;
  if (change.action === 'skip') return `  (${change.reason})`;
  return '';
}

function printPlan(outcome: SetupOutcome, io: CliIO, withDiffs: boolean): number {
  const pending = outcome.plan.changes.filter((change) => change.action !== 'unchanged');
  io.write(`Project: ${outcome.project.languages.join(', ') || 'unknown stack'}${outcome.project.frameworks.length ? ` (${outcome.project.frameworks.join(', ')})` : ''}\n`);
  io.write(`Adapters: ${outcome.adapters.join(', ')} · profile ${outcome.plan.meta.profile}\n`);
  for (const change of pending) {
    const note = changeNote(change);
    io.write(`  ${change.action.padEnd(9)} ${change.target}${note}\n`);
    if (withDiffs && change.diff) io.write(`${change.diff}\n`);
  }
  const unchanged = outcome.plan.changes.length - pending.length;
  io.write(`${pending.length} change(s), ${unchanged} unchanged.\n`);
  for (const diagnostic of outcome.diagnostics) io.write(`warning ${diagnostic.code}: ${diagnostic.message}\n`);
  return pending.length;
}

async function commandSetup(args: ParsedArgs, io: CliIO, diffOnly: boolean): Promise<number> {
  const root = resolve(io.cwd, args.positionals[0] ?? '.');
  const adapters = adaptersOf(args);
  const options = {
    root,
    ...(adapters ? { adapters } : {}),
    ...(single(args, 'profile') ? { profileId: single(args, 'profile')! } : {}),
    enabledTools: args.values.get('enable-tool') ?? [],
    conflictStrategy: oneOf('strategy', single(args, 'strategy'), STRATEGIES) ?? 'write-new',
  };
  const preview = runSetup({ ...options, dryRun: true });
  const pending = printPlan(preview, io, diffOnly);
  if (diffOnly || args.switches.has('dry-run') || pending === 0) {
    if (pending === 0) io.write('Already up to date.\n');
    return 0;
  }
  if (!args.switches.has('yes')) {
    if (!io.ask) {
      io.error('Not applied: re-run with --yes to apply, or use --dry-run / diff to review.\n');
      return 1;
    }
    if (!/^y(es)?$/i.test((await io.ask(`Apply ${pending} change(s)? (y/N): `)).trim())) {
      io.write('Cancelled. Nothing was written.\n');
      return 1;
    }
  }
  const applied = runSetup(options).applied;
  io.write(applied ? `Applied transaction ${applied.transactionId}. Undo with: ${BIN} rollback\n` : 'Already up to date.\n');
  return 0;
}

async function commandCreate(args: ParsedArgs, io: CliIO): Promise<number> {
  const ask: Ask = io.ask ?? (async () => '');
  const config = await resolveCreateConfig(args, ask);
  io.write(`Creating ${config.projectName} (${[config.type, config.framework, config.ui].filter(Boolean).join('/')}, ${config.tier}, adapters: ${config.adapters.join(', ')})…\n`);
  const outcome = createProject({ cwd: io.cwd, ...config });
  io.write(`Created ${outcome.projectDir} from template ${outcome.template}; ${outcome.setup.applied?.created.length ?? 0} AI configuration file(s) installed.\n`);
  for (const warning of [...outcome.warnings, ...outcome.setup.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)]) {
    io.write(`warning ${warning}\n`);
  }
  io.write(`\nNext steps:\n  cd ${config.projectName}\n  npm install\n  cp .env.example .env\n`);
  return 0;
}

function commandDoctor(args: ParsedArgs, io: CliIO): number {
  const report = doctor(resolve(io.cwd, args.positionals[0] ?? '.'));
  if (report.healthy) io.write(`Healthy: ${report.manifest!.files.length} managed file(s), ${report.manifest!.sections.length} managed section(s).\n`);
  for (const issue of report.issues) io.write(`${issue.code}${issue.path ? ` ${issue.path}` : ''}: ${issue.message}\n`);
  return report.healthy ? 0 : 1;
}

function commandRollback(args: ParsedArgs, io: CliIO): number {
  const result = rollback(resolve(io.cwd, args.positionals[0] ?? '.'), { force: args.switches.has('force') });
  io.write(`Rolled back ${result.transactionId}: restored ${result.restored.length} file(s), removed ${result.removed.length} file(s).\n`);
  return 0;
}

export async function main(argv: readonly string[], io: CliIO): Promise<number> {
  try {
    const args = parseArgs(argv);
    switch (args.command) {
      case 'help':
        io.write(HELP);
        return 0;
      case 'version':
        io.write(`${BIN} ${packageVersion()}\n`);
        return 0;
      case 'create':
        return await commandCreate(args, io);
      case 'setup':
        return await commandSetup(args, io, false);
      case 'diff':
        return await commandSetup(args, io, true);
      case 'doctor':
        return commandDoctor(args, io);
      case 'rollback':
        return commandRollback(args, io);
      case 'catalog':
        if (args.positionals[0] !== 'validate') throw new UsageError('Usage: catalog validate [catalog-dir]');
        return runCatalogValidate(resolve(io.cwd, args.positionals[1] ?? join(PACKAGE_ROOT, 'catalog')), (line) => io.write(`${line}\n`));
    }
  } catch (error) {
    io.error(`Error: ${(error as Error).message}\n`);
    if (error instanceof UsageError) io.error(`Run ${BIN} --help for usage.\n`);
    return 1;
  }
}

function terminalAsk(): Ask {
  return (question) =>
    new Promise((resolveAnswer) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (answer) => {
        rl.close();
        resolveAnswer(answer);
      });
    });
}

/** Entry point used by bin/cli.js. */
export function run(argv: readonly string[]): void {
  const io: CliIO = {
    cwd: process.cwd(),
    write: (text) => process.stdout.write(text),
    error: (text) => process.stderr.write(text),
    ask: process.stdin.isTTY ? terminalAsk() : null,
  };
  void main(argv, io).then((code) => {
    process.exitCode = code;
  });
}

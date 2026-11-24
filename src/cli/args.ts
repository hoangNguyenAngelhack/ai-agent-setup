export const COMMANDS = ['create', 'setup', 'diff', 'doctor', 'rollback', 'catalog', 'plan', 'explain', 'impact', 'gates', 'run', 'isolation', 'report'] as const;
export type Command = (typeof COMMANDS)[number] | 'help' | 'version';

export class UsageError extends Error {}

/** Options that take a value. V1 short flags keep their meaning (docs/v2/07 §3). */
const VALUE_FLAGS: Record<string, string> = {
  '-t': 'type',
  '--type': 'type',
  '-f': 'framework',
  '--framework': 'framework',
  '-u': 'ui',
  '--ui': 'ui',
  '-T': 'tier',
  '--tier': 'tier',
  '-d': 'db',
  '--db': 'db',
  '-a': 'adapter',
  '--adapter': 'adapter',
  '--profile': 'profile',
  '--strategy': 'strategy',
  '--enable-tool': 'enable-tool',
  '--mode': 'mode',
  '--domain': 'domain',
  '--agent': 'agent',
  '--exclude-agent': 'exclude-agent',
  '--skill': 'skill',
  '--workflow': 'workflow',
  '--allow-tools': 'allow-tools',
  '--budget': 'budget',
  '--approve-at': 'approve-at',
  '--project': 'project',
  '--files': 'files',
  '--since': 'since',
  '--gate': 'gate',
  '--skip': 'skip',
  '--run': 'run',
  '--host': 'host',
  '--step': 'step',
  '--message': 'message',
  '--reason': 'reason',
  '--evidence': 'evidence',
  '--by': 'by',
  '--timeout': 'timeout',
  '--event-command': 'event-command',
  '--isolation': 'isolation',
  '--pass-env': 'pass-env',
  '--network': 'network',
};

const SWITCHES: Record<string, string> = {
  '-y': 'yes',
  '--yes': 'yes',
  '-c': 'codegraph',
  '--codegraph': 'codegraph',
  '-H': 'honesty',
  '--honesty': 'honesty',
  '-h': 'help',
  '--help': 'help',
  '-v': 'version',
  '--version': 'version',
  '--dry-run': 'dry-run',
  '--force': 'force',
  '--json': 'json',
  '--changed': 'changed',
  '--decline': 'decline',
  '--kpi': 'kpi',
};

export interface ParsedArgs {
  command: Command;
  positionals: string[];
  values: Map<string, string[]>;
  switches: Set<string>;
}

/**
 * Parses argv. A first argument that is not a command keeps the V1 meaning
 * (`create-ai-agent-setup my-app -t backend` creates `my-app`).
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const values = new Map<string, string[]>();
  const switches = new Set<string>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    if (SWITCHES[flag]) {
      switches.add(SWITCHES[flag]);
    } else if (VALUE_FLAGS[flag]) {
      const value = inline ?? argv[(index += 1)];
      if (value === undefined || value.startsWith('-')) throw new UsageError(`Option ${flag} needs a value`);
      const name = VALUE_FLAGS[flag];
      values.set(name, [...(values.get(name) ?? []), ...value.split(',').map((part) => part.trim()).filter(Boolean)]);
    } else if (arg.startsWith('-')) {
      throw new UsageError(`Unknown option ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  const first = positionals[0];
  const explicit = first !== undefined && (COMMANDS as readonly string[]).includes(first);
  const command: Command = switches.has('help') ? 'help' : switches.has('version') ? 'version' : explicit ? (first as Command) : 'create';
  return { command, positionals: explicit ? positionals.slice(1) : positionals, values, switches };
}

export function single(args: ParsedArgs, name: string): string | undefined {
  const list = args.values.get(name);
  if (list && list.length > 1) throw new UsageError(`Option --${name} accepts one value`);
  return list?.[0];
}

export function oneOf<T extends string>(name: string, value: string | undefined, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) throw new UsageError(`Invalid --${name} "${value}". Valid: ${allowed.join(', ') || '(none)'}`);
  return value as T;
}

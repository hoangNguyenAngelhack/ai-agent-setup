import { ADAPTER_IDS, type AdapterId } from '../registry';
import {
  DATABASES,
  FRAMEWORKS_BY_TYPE,
  PROJECT_TYPES,
  TIERS,
  UI_LIBRARIES,
  type Database,
  type Framework,
  type ProjectType,
  type Tier,
  type UiLibrary,
} from '../app/templates';
import { oneOf, single, UsageError, type ParsedArgs } from './args';

export type Ask = (question: string) => Promise<string>;

/** Frameworks V1 picked with `-y` (bin/cli.js:228-285); interactive defaults are the first option. */
const YES_DEFAULT_FRAMEWORK: Partial<Record<ProjectType, Framework>> = { backend: 'express', frontend: 'vite', mobile: 'expo' };

export interface CreateConfig {
  projectName: string;
  type: ProjectType;
  framework: Framework | null;
  ui: UiLibrary | null;
  tier: Tier;
  db: Database;
  author: string;
  email: string;
  adapters: AdapterId[];
  honesty: boolean;
  codegraph: boolean;
}

async function choose<T extends string>(ask: Ask, title: string, options: Array<[T, string]>, fallback: T): Promise<T> {
  const menu = options.map(([value, label], index) => `  ${index + 1}) ${value.padEnd(10)} - ${label}`).join('\n');
  const answer = (await ask(`${title}\n${menu}\n→ Choose (1-${options.length}) [${options.findIndex(([value]) => value === fallback) + 1}]: `)).trim();
  return options[Number(answer) - 1]?.[0] ?? fallback;
}

async function yesNo(ask: Ask, question: string, given: boolean): Promise<boolean> {
  if (given) return true;
  return /^y(es)?$/i.test((await ask(`${question}\n→ (y/N): `)).trim());
}

/**
 * Resolves `create` options from flags, asking only for what is missing (V1 prompt order, plus the
 * AI host). With `--yes` it uses the V1 `-y` defaults and asks nothing.
 */
export async function resolveCreateConfig(args: ParsedArgs, ask: Ask): Promise<CreateConfig> {
  const yes = args.switches.has('yes');
  const projectName = args.positionals[0] ?? (await ask('Project name:\n→ ')).trim();

  const type: ProjectType =
    oneOf('type', single(args, 'type'), PROJECT_TYPES) ??
    (yes ? 'backend' : await choose<ProjectType>(ask, 'Project type:', [['backend', 'Node.js API server'], ['frontend', 'Web application'], ['fullstack', 'Next.js + tRPC + Prisma + NextAuth'], ['mobile', 'React Native app']], 'backend'));

  const frameworks = FRAMEWORKS_BY_TYPE[type] as readonly Framework[];
  const frameworkFlag = single(args, 'framework');
  if (frameworkFlag !== undefined && frameworks.length === 0) throw new UsageError(`--framework is not used for ${type} projects`);
  const framework: Framework | null =
    frameworks.length === 0
      ? null
      : (oneOf('framework', frameworkFlag, frameworks) ??
        (yes
          ? YES_DEFAULT_FRAMEWORK[type]!
          : await choose(ask, `${type} framework:`, frameworks.map((value) => [value, value] as [Framework, string]), frameworks[0]!)));

  const uiFlag = oneOf('ui', single(args, 'ui'), UI_LIBRARIES);
  if (uiFlag && type !== 'frontend') throw new UsageError('--ui is only used for frontend projects');
  const ui: UiLibrary | null =
    type !== 'frontend'
      ? null
      : (uiFlag ?? (yes ? 'shadcn' : await choose<UiLibrary>(ask, 'UI library:', [['shadcn', 'Radix + Tailwind (recommended)'], ['antd', 'Enterprise + Tailwind'], ['chakra', 'Simple, accessible'], ['semantic', 'Classic UI framework']], 'shadcn')));

  const tier: Tier =
    oneOf('tier', single(args, 'tier'), TIERS) ??
    (yes ? 'standard' : await choose<Tier>(ask, 'Rule tier (profile):', [['starter', 'MVP, prototypes (50% coverage)'], ['standard', 'Production apps (80% coverage)'], ['strict', 'Enterprise (95% coverage)']], 'standard'));

  const usesDatabase = type === 'backend' || type === 'fullstack';
  const dbFlag = oneOf('db', single(args, 'db'), DATABASES);
  const db: Database = !usesDatabase
    ? 'none'
    : (dbFlag ?? (yes ? 'postgresql' : await choose<Database>(ask, 'Database:', [['postgresql', 'Recommended'], ['mysql', 'MySQL'], ['sqlite', 'Development only'], ['none', 'No database']], 'postgresql')));

  const author = yes ? 'Developer' : (await ask('Author name:\n→ [Developer]: ')).trim() || 'Developer';
  const email = yes ? 'dev@example.com' : (await ask('Author email:\n→ [dev@example.com]: ')).trim() || 'dev@example.com';

  const adapterFlag = args.values.get('adapter');
  const adapters: AdapterId[] = adapterFlag
    ? adapterFlag.map((id) => oneOf('adapter', id, ADAPTER_IDS)!)
    : yes
      ? ['claude-code']
      : await choose<'claude-code' | 'codex' | 'both'>(ask, 'AI coding host:', [['claude-code', 'Claude Code'], ['codex', 'OpenAI Codex'], ['both', 'Claude Code and Codex']], 'claude-code').then(
          (choice) => (choice === 'both' ? ['claude-code', 'codex'] : [choice]),
        );

  const codegraph = yes ? args.switches.has('codegraph') : await yesNo(ask, 'Setup CodeGraph? (third-party code graph; benefits unverified)', args.switches.has('codegraph'));
  const honesty = yes ? args.switches.has('honesty') : await yesNo(ask, 'Include honesty rule? (acknowledge uncertainty, never fabricate sources)', args.switches.has('honesty'));

  return { projectName, type, framework, ui, tier, db, author, email, adapters, honesty, codegraph };
}

import { stringify } from 'yaml';
import { selectProfileEntries } from '../../core/context';
import { STACKS } from '../../core/project-detection';
import type {
  AdapterId,
  CatalogEntry,
  ContentFile,
  Diagnostic,
  EntryOfKind,
  EntityKind,
} from '../../registry';
import type { FileOperation } from '../../shared/file-operations';
import type { GeneratedItem, GenerationInput, GenerationResult, Support } from '../adapter';

/** An entry for given stacks fits a project with one of them; with no stack detected, all fit. */
function fitsStacks(entry: CatalogEntry, stacks: ReadonlySet<string>): boolean {
  if (stacks.size === 0) return true;
  const wanted = entry.requiredContext.projectSignals.filter((signal) => STACKS.has(signal));
  return wanted.length === 0 || wanted.some((stack) => stacks.has(stack));
}

/** Everything an adapter needs while generating, plus the accumulated result. */
export class GenerationContext {
  readonly operations: FileOperation[] = [];
  readonly items: GeneratedItem[] = [];
  readonly diagnostics: Diagnostic[] = [];
  private readonly selected: CatalogEntry[];

  constructor(
    readonly adapter: AdapterId,
    readonly input: GenerationInput,
  ) {
    const enabledTools = new Set(input.enabledTools);
    const stacks = new Set(input.projectStacks ?? []);
    this.selected = selectProfileEntries(input.registry, input.profile)
      .filter((entry) => entry.kind !== 'Tool' || enabledTools.has(entry.id))
      .filter((entry) => fitsStacks(entry, stacks))
      .filter((entry) => this.isSupported(entry))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  list<K extends EntityKind>(kind: K): Array<EntryOfKind<K>> {
    return this.selected.filter((entry): entry is EntryOfKind<K> => entry.kind === kind);
  }

  has(id: string): boolean {
    return this.selected.some((entry) => entry.id === id);
  }

  body(entry: CatalogEntry): string | null {
    const file = this.input.knowledge.body(entry.id);
    return file ? this.input.knowledge.read(file) : null;
  }

  resources(entry: CatalogEntry): Array<{ file: ContentFile; content: string }> {
    return this.input.knowledge.resources(entry.id).map((file) => ({ file, content: this.input.knowledge.read(file) }));
  }

  write(path: string, content: string, entry: CatalogEntry | null): void {
    this.operations.push({ kind: 'write', path, content, source: entry ? `${entry.id}@${entry.version}` : null });
  }

  record(entry: CatalogEntry, support: Support, outputs: string[], note?: string): void {
    this.items.push({ entryId: entry.id, support, outputs, ...(note ? { note } : {}) });
  }

  warn(code: string, message: string, entryId?: string): void {
    this.diagnostics.push({ code, severity: 'warning', message, ...(entryId ? { entryId } : {}) });
  }

  fail(code: string, message: string, entryId?: string): void {
    this.diagnostics.push({ code, severity: 'error', message, ...(entryId ? { entryId } : {}) });
  }

  result(): GenerationResult {
    return { adapter: this.adapter, operations: this.operations, items: this.items, diagnostics: this.diagnostics };
  }

  private isSupported(entry: CatalogEntry): boolean {
    if (entry.supportedAdapters[this.adapter] !== 'unsupported') return true;
    const reason = entry.unsupportedReasons?.[this.adapter] ?? 'no reason given';
    this.warn('W_UNSUPPORTED_SKIPPED', `Skipped: unsupported on ${this.adapter} (${reason})`, entry.id);
    return false;
  }
}

/** File-system name of an entry: the id without its kind prefix (`skill.tdd` → `tdd`). */
export function slugOf(entry: CatalogEntry): string {
  if (entry.kind === 'Workflow' && entry.entry) return entry.entry;
  const dot = entry.id.indexOf('.');
  return dot === -1 ? entry.id : entry.id.slice(dot + 1);
}

export function withFrontmatter(meta: Record<string, unknown>, body: string): string {
  return `---\n${stringify(meta, { lineWidth: 0 }).trimEnd()}\n---\n\n${body.replace(/^\n+/, '')}`;
}

function basenameOf(reference: string): string {
  return reference.split('/').at(-1) ?? reference;
}

/**
 * Writes an Agent Skills directory (`<root>/<name>/SKILL.md` + `references/`), the format both hosts
 * read. Resources are copied next to the skill and linked from a Resources section.
 */
export function writeAgentSkill(
  context: GenerationContext,
  root: string,
  name: string,
  description: string,
  body: string,
  entry: CatalogEntry,
  extraMeta: Record<string, unknown> = {},
): string[] {
  const directory = `${root}/${name}`;
  const resources = context.resources(entry);
  const links = resources.map(({ file }) => `- [references/${basenameOf(file.reference)}](references/${basenameOf(file.reference)})`);
  const fullBody = links.length > 0 ? `${body.trimEnd()}\n\n## Resources\n\n${links.join('\n')}\n` : body;

  context.write(`${directory}/SKILL.md`, withFrontmatter({ name, description, ...extraMeta }, fullBody), entry);
  for (const { file, content } of resources) context.write(`${directory}/references/${basenameOf(file.reference)}`, content, entry);
  return [`${directory}/SKILL.md`];
}

/** Writes every selected skill in Agent Skills format; returns the names used. */
export function writeSkills(context: GenerationContext, root: string): Set<string> {
  const names = new Set<string>();
  for (const skill of context.list('Skill')) {
    const body = context.body(skill);
    if (body === null) {
      context.warn('W_NO_BODY', 'Skill has no body', skill.id);
      continue;
    }
    names.add(slugOf(skill));
    context.record(skill, 'native', writeAgentSkill(context, root, slugOf(skill), skill.triggers, body, skill));
  }
  return names;
}

/** Enabled MCP server definitions keyed by server name; command tools are reported, not generated. */
export function collectMcpServers(context: GenerationContext, output: string): Record<string, Record<string, unknown>> {
  const servers: Record<string, Record<string, unknown>> = {};
  for (const tool of context.list('Tool')) {
    if (tool.type !== 'mcp' || !tool.mcp) {
      context.record(tool, 'unsupported', [], 'command tools run at install time, not generated');
      continue;
    }
    servers[slugOf(tool).replace(/^mcp-/, '')] = tool.mcp;
    context.record(tool, 'native', [output]);
  }
  return servers;
}

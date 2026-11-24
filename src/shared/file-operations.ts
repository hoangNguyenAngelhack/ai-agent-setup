/**
 * File operations produced by adapters and applied by the installer (docs/v2/05 §10.1, §11).
 * Adapters never touch the file system; paths are relative to the project root, with `/`.
 */
export type FileOperation =
  | {
      kind: 'write';
      path: string;
      content: string;
      /** Catalog entry the file comes from (`id@version`), or null for generated glue. */
      source: string | null;
    }
  | {
      /** Managed section inside a file the user may also edit (instructions, TOML config). */
      kind: 'section';
      path: string;
      marker: string;
      style: 'html' | 'hash';
      content: string;
      source: string | null;
    }
  | {
      /** Deep merge into a JSON file: objects merge, arrays union, scalars are replaced. */
      kind: 'merge-json';
      path: string;
      value: Record<string, unknown>;
      source: string | null;
    };

export const SECTION_PREFIX = 'ai-agent-setup';

export function sectionMarkers(marker: string, style: 'html' | 'hash'): { begin: string; end: string } {
  return style === 'html'
    ? { begin: `<!-- ${SECTION_PREFIX}:begin ${marker} -->`, end: `<!-- ${SECTION_PREFIX}:end ${marker} -->` }
    : { begin: `# ${SECTION_PREFIX}:begin ${marker}`, end: `# ${SECTION_PREFIX}:end ${marker}` };
}

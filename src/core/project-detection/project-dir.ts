import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', 'bin', 'obj', 'target', 'vendor', '.venv', 'venv']);

/** Read-only, error-tolerant view of one directory of a project. */
export class ProjectDir {
  constructor(readonly path: string) {}

  has(relativePath: string): boolean {
    return existsSync(join(this.path, relativePath));
  }

  read(relativePath: string): string | null {
    try {
      return readFileSync(join(this.path, relativePath), 'utf8');
    } catch {
      return null;
    }
  }

  readJson(relativePath: string): Record<string, unknown> | null {
    const text = this.read(relativePath);
    if (text === null) return null;
    try {
      const value: unknown = JSON.parse(text);
      return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  /** Concatenated lower-case text of the files that exist; used for keyword detection. */
  text(...relativePaths: string[]): string {
    return relativePaths
      .map((relativePath) => this.read(relativePath) ?? '')
      .join('\n')
      .toLowerCase();
  }

  list(relativePath = '.'): string[] {
    try {
      return readdirSync(join(this.path, relativePath));
    } catch {
      return [];
    }
  }

  /** Relative file paths matching `test`, searching at most `maxDepth` directory levels deep. */
  find(test: (fileName: string) => boolean, maxDepth: number): string[] {
    const results: string[] = [];
    const walk = (dir: string, depth: number): void => {
      for (const name of this.list(dir)) {
        const relativePath = dir === '.' ? name : `${dir}/${name}`;
        if (isDirectory(join(this.path, relativePath))) {
          if (depth < maxDepth && !SKIPPED_DIRECTORIES.has(name)) walk(relativePath, depth + 1);
        } else if (test(name)) {
          results.push(relative(this.path, join(this.path, relativePath)).split(sep).join('/'));
        }
      }
    };
    walk('.', 0);
    return results.sort();
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

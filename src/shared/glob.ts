const cache = new Map<string, RegExp>();

function escape(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

/**
 * Converts a glob to an anchored regular expression for `/`-separated relative paths.
 * Supports `**` (any number of directories, including none), `*`, `?` and `{a,b}`.
 */
export function globToRegExp(glob: string): RegExp {
  const cached = cache.get(glob);
  if (cached) return cached;
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index]!;
    if (char === '*' && glob[index + 1] === '*') {
      const slashAfter = glob[index + 2] === '/';
      source += slashAfter ? '(?:.*/)?' : '.*';
      index += slashAfter ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (char === '{') {
      const close = glob.indexOf('}', index);
      if (close === -1) source += '\\{';
      else {
        source += `(?:${glob.slice(index + 1, close).split(',').map((part) => part.split('').map(escape).join('')).join('|')})`;
        index = close;
      }
    } else source += escape(char);
  }
  const regex = new RegExp(`^${source}$`);
  cache.set(glob, regex);
  return regex;
}

export function matchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path);
}

export function matchesAnyGlob(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}

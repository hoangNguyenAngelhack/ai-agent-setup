/** Prefixes that run the rest of the command line unchanged. */
const WRAPPER_COMMANDS = new Set(['sudo', 'doas', 'nohup', 'time', 'command', 'exec', 'env']);
const SHELL_INTERPRETERS = new Set(['sh', 'bash', 'zsh', 'dash']);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
/** `-c`, or combined short flags ending in c such as `-lc`. */
const SCRIPT_FLAG = /^-[a-z]*c$/;

/** Splits a command line on `&&`, `||`, `;`, `|` and newlines, ignoring separators inside quotes. */
function splitSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]!;
    if (quote) {
      if (char === quote) quote = null;
      current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ';' || char === '\n' || char === '|' || (char === '&' && command[index + 1] === '&')) {
      if (char === '&' || (char === '|' && command[index + 1] === '|')) index += 1;
      segments.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  segments.push(current);
  return segments.map((segment) => segment.trim()).filter((segment) => segment.length > 0);
}

/** Whitespace tokenizer that keeps quoted strings as single tokens (quotes removed). */
function tokenize(segment: string): string[] {
  return [...segment.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
}

function stripWrappers(tokens: string[]): string[] {
  let start = 0;
  while (start < tokens.length && (WRAPPER_COMMANDS.has(tokens[start]!) || ENV_ASSIGNMENT.test(tokens[start]!))) start += 1;
  return tokens.slice(start);
}

/**
 * Token lists of every simple command inside a command line, including scripts passed to
 * `sh|bash|zsh|dash -c "..."` (or `-lc`), with `sudo`/`env`/`VAR=value` prefixes removed.
 */
export function commandSegments(command: string): string[][] {
  return splitSegments(command).flatMap((segment) => {
    const tokens = stripWrappers(tokenize(segment));
    const script = SHELL_INTERPRETERS.has(tokens[0] ?? '') && SCRIPT_FLAG.test(tokens[1] ?? '') ? tokens[2] : undefined;
    return script !== undefined ? commandSegments(script) : [tokens];
  });
}

function tokenMatches(patternToken: string, token: string, ignoreCase: boolean): boolean {
  if (!patternToken.includes('*')) {
    return ignoreCase ? patternToken.toLowerCase() === token.toLowerCase() : patternToken === token;
  }
  const source = patternToken.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${source}$`, ignoreCase ? 'i' : '').test(token);
}

/**
 * Matches a token glob against a token list, anchored at both ends. A pattern token that is exactly
 * `*` matches zero or more tokens; a `*` inside a token matches characters within one token.
 */
export function matchesTokenGlob(pattern: string, tokens: readonly string[], ignoreCase = false): boolean {
  const patternTokens = pattern.trim().split(/\s+/);
  const memo = new Map<string, boolean>();
  const match = (p: number, t: number): boolean => {
    const key = `${p}:${t}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (p === patternTokens.length) result = t === tokens.length;
    else if (patternTokens[p] === '*') result = match(p + 1, t) || (t < tokens.length && match(p, t + 1));
    else result = t < tokens.length && tokenMatches(patternTokens[p]!, tokens[t]!, ignoreCase) && match(p + 1, t + 1);
    memo.set(key, result);
    return result;
  };
  return match(0, 0);
}

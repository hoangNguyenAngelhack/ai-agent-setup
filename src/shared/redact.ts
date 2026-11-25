/**
 * Removes secrets, access tokens and common personal data from text before it is stored in run
 * artifacts or evidence logs. Pattern-based: it reduces accidental disclosure, it does not prove
 * that a text is free of sensitive data.
 */
const RULES: Array<[label: string, pattern: RegExp, replace?: string]> = [
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ['url-credentials', /(?<=:\/\/)[^\s/:@]+:[^\s/@]+(?=@)/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g],
  ['api-key', /\b(?:sk|pk|rk)[-_](?:live[-_]|test[-_]|proj[-_])?[A-Za-z0-9_-]{16,}/g],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
  ['bearer', /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [REDACTED:bearer]'],
  [
    'assignment',
    /\b(\w*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)\w*["']?\s*[:=]\s*)("[^"\n]*"|'[^'\n]*'|[^\s,;"']+)/gi,
    '$1[REDACTED:assignment]',
  ],
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
  ['phone', /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g],
];

export interface Redacted {
  text: string;
  /** Count per rule label; empty when nothing was replaced. */
  redactions: Record<string, number>;
}

export function redactText(input: string): Redacted {
  const redactions: Record<string, number> = {};
  let text = input;
  for (const [label, pattern, replace] of RULES) {
    text = text.replace(pattern, (...match: unknown[]) => {
      redactions[label] = (redactions[label] ?? 0) + 1;
      if (!replace) return `[REDACTED:${label}]`;
      return replace.replace(/\$(\d)/g, (_, index: string) => {
        const group = match[Number(index)];
        return typeof group === 'string' ? group : '';
      });
    });
  }
  return { text, redactions };
}

/** Deep copy of a JSON value with every string redacted. */
/** Key names whose values the `assignment` rule removes from text (`token=…`, `"api_key": "…"`). */
const SENSITIVE_KEY = /password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential/i;
const REDACTED_ASSIGNMENT = '[REDACTED:assignment]';

function redactStructured(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value).text;
  if (Array.isArray(value)) return value.map(redactStructured);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        redactText(key).text,
        SENSITIVE_KEY.test(key) && item !== null && typeof item !== 'object' ? REDACTED_ASSIGNMENT : redactStructured(item),
      ]),
    );
  }
  return value;
}

/**
 * Redacts one line of a host's JSON stream and keeps it valid JSON. Every key and string goes
 * through the same rules as redactText, and a scalar under a sensitive key name is replaced as the
 * `assignment` rule would; a line that is not JSON is redacted as text. redactText on a JSON line
 * leaves unbalanced quotes and braces, which made stored transcripts unreadable.
 */
export function redactJsonLine(line: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return redactText(line).text;
  }
  return parsed !== null && typeof parsed === 'object' ? JSON.stringify(redactStructured(parsed)) : redactText(line).text;
}

export function redactValue<T>(value: T): T {
  if (typeof value === 'string') return redactText(value).text as T;
  if (Array.isArray(value)) return (value as unknown[]).map((item) => redactValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactValue(item)])) as T;
  }
  return value;
}

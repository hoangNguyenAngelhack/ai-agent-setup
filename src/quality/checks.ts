import { redactText } from '../shared/redact';

/** Credential formats taken from the redaction rules; the broad `assignment` rule is replaced below. */
const SECRET_LABELS = new Set(['private-key', 'url-credentials', 'github-token', 'api-key', 'slack-token', 'aws-access-key', 'jwt', 'bearer']);
/** A quoted literal (8+ chars with a digit or symbol, not an interpolation) assigned to a secret-like name. */
const LITERAL_ASSIGNMENT = /\b\w*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)\w*["']?\s*[:=]\s*["'](?=[^"'\s$]*[\d_+/=!@#%^&*-])[^"'\s$]{8,}["']/i;

export interface SecretFinding {
  file: string;
  line: number;
  kinds: string[];
}

/** Inline marker for deliberate fake secrets in test fixtures; allowed lines are counted, not hidden. */
export const ALLOW_MARKER = 'secret-scan:allow';

function lineFinding(file: string, line: number, text: string): SecretFinding | 'allowed' | null {
  const kinds = Object.keys(redactText(text).redactions).filter((label) => SECRET_LABELS.has(label));
  if (LITERAL_ASSIGNMENT.test(text)) kinds.push('assignment');
  if (!kinds.length) return null;
  return text.includes(ALLOW_MARKER) ? 'allowed' : { file, line, kinds };
}

export interface SecretScan {
  findings: SecretFinding[];
  /** Locations skipped because of the allow marker. */
  allowed: string[];
}

/** Scans whole files (untracked files have no diff); NUL bytes mark binary content, which is skipped. */
export function scanFilesForSecrets(files: Array<{ path: string; content: string }>): SecretScan {
  const result: SecretScan = { findings: [], allowed: [] };
  for (const { path, content } of files) {
    if (content.includes('\0')) continue;
    content.split('\n').forEach((text, index) => {
      const finding = lineFinding(path, index + 1, text);
      if (finding === 'allowed') result.allowed.push(`${path}:${index + 1}`);
      else if (finding) result.findings.push(finding);
    });
  }
  return result;
}

/** Scans the added lines of a unified diff for secrets; reports locations and kinds, never values. */
export function scanDiffForSecrets(diff: string): SecretFinding[] {
  return scanDiff(diff).findings;
}

export function scanDiff(diff: string): SecretScan {
  const result: SecretScan = { findings: [], allowed: [] };
  let file = '';
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      file = text.replace(/^\+\+\+ (b\/)?/, '');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(text);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (text.startsWith('+')) {
      const finding = lineFinding(file, line, text.slice(1));
      if (finding === 'allowed') result.allowed.push(`${file}:${line}`);
      else if (finding) result.findings.push(finding);
      line += 1;
    } else if (!text.startsWith('-')) line += 1;
  }
  return result;
}

export interface AuditCounts {
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

/** Reads `npm audit --json`; null when the output is not an audit report (offline, registry error). */
export function parseNpmAudit(output: string): AuditCounts | null {
  try {
    const report = JSON.parse(output) as { error?: unknown; metadata?: { vulnerabilities?: Partial<AuditCounts> } };
    const counts = report.metadata?.vulnerabilities;
    if (report.error || !counts) return null;
    return { critical: counts.critical ?? 0, high: counts.high ?? 0, moderate: counts.moderate ?? 0, low: counts.low ?? 0 };
  } catch {
    return null;
  }
}

export const COVERAGE_METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
export type CoverageMetric = (typeof COVERAGE_METRICS)[number];

/**
 * Total coverage per metric from an Istanbul `json-summary` file. A metric is `null` (not
 * applicable) only when the report states `total: 0` (older Istanbul then writes pct "Unknown").
 * Returns null — never a pass — when a metric is missing or malformed, when pct is "Unknown" without
 * `total: 0`, or when lines are not applicable (nothing was measured).
 */
export function parseCoverageSummary(text: string): Record<CoverageMetric, number | null> | null {
  try {
    const total = (JSON.parse(text) as { total?: Partial<Record<CoverageMetric, { pct?: unknown; total?: unknown }>> }).total;
    const values = COVERAGE_METRICS.map((metric) => {
      const entry = total?.[metric];
      if (!entry) return undefined;
      if (entry.total === 0) return null;
      return typeof entry.pct === 'number' ? entry.pct : undefined;
    });
    if (values.some((value) => value === undefined) || values[COVERAGE_METRICS.indexOf('lines')] === null) return null;
    return Object.fromEntries(COVERAGE_METRICS.map((metric, index) => [metric, values[index]!])) as Record<CoverageMetric, number | null>;
  } catch {
    return null;
  }
}

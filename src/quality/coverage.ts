import { COVERAGE_METRICS, parseCoverageSummary, type CoverageMetric } from './checks';

/**
 * Coverage reports of every stack (polyglot gates). The format is recognised from the content; each is
 * read from its documented shape. A metric the format does not report, or with nothing to measure, is
 * null (not measured): it never passes or fails on its own. A report with no measured metric, or in an
 * unknown format, gives null, which the gate reports as NOT_VERIFIED.
 */
export interface CoverageReport {
  format: string;
  totals: Record<CoverageMetric, number | null>;
}

type Totals = Partial<Record<CoverageMetric, number | null>>;

const percent = (covered: number, total: number): number | null => (total > 0 ? Math.round((covered / total) * 10000) / 100 : null);

function report(format: string, totals: Totals): CoverageReport | null {
  const complete = Object.fromEntries(COVERAGE_METRICS.map((metric) => [metric, totals[metric] ?? null])) as Record<CoverageMetric, number | null>;
  return COVERAGE_METRICS.some((metric) => complete[metric] !== null) ? { format, totals: complete } : null;
}

const attribute = (tag: string, name: string): number | null => {
  const value = new RegExp(`\\b${name}="([0-9.]+)"`).exec(tag)?.[1];
  return value === undefined ? null : Number(value);
};

/** LCOV tracefile: LF/LH lines, BRF/BRH branches, FNF/FNH functions, summed over every file. */
function lcov(text: string): CoverageReport | null {
  if (!/^(TN|SF):/m.test(text)) return null;
  const sum = (key: string) => [...text.matchAll(new RegExp(`^${key}:(\\d+)$`, 'gm'))].reduce((total, match) => total + Number(match[1]), 0);
  return report('LCOV', { lines: percent(sum('LH'), sum('LF')), branches: percent(sum('BRH'), sum('BRF')), functions: percent(sum('FNH'), sum('FNF')) });
}

/** Cobertura XML: the root `<coverage>` element's counts, or its rates when the counts are absent. */
function cobertura(text: string): CoverageReport | null {
  const root = /<coverage\b[^>]*>/.exec(text)?.[0];
  if (!root) return null;
  const metric = (kind: 'lines' | 'branches', rate: string) => {
    const valid = attribute(root, `${kind}-valid`);
    const covered = attribute(root, `${kind}-covered`);
    if (valid === 0) return null;
    if (valid !== null && covered !== null) return percent(covered, valid);
    const value = attribute(root, rate);
    return value === null ? null : Math.round(value * 10000) / 100;
  };
  return report('Cobertura', { lines: metric('lines', 'line-rate'), branches: metric('branches', 'branch-rate') });
}

/** JaCoCo XML: the counters that belong to the whole report, not to its packages or groups. */
function jacoco(text: string): CoverageReport | null {
  if (!/<report\b/.test(text)) return null;
  const top = text.replace(/<(package|group)\b[\s\S]*?<\/\1>/g, '');
  const counter = (type: string) => {
    const tag = new RegExp(`<counter type="${type}"[^>]*>`).exec(top)?.[0];
    if (!tag) return null;
    const covered = attribute(tag, 'covered') ?? 0;
    return percent(covered, covered + (attribute(tag, 'missed') ?? 0));
  };
  return report('JaCoCo', { statements: counter('INSTRUCTION'), branches: counter('BRANCH'), functions: counter('METHOD'), lines: counter('LINE') });
}

/** Go coverprofile: statement coverage; a block listed more than once (several packages) counts once. */
function goProfile(text: string): CoverageReport | null {
  if (!text.startsWith('mode: ')) return null;
  const blocks = new Map<string, { statements: number; covered: boolean }>();
  for (const match of text.matchAll(/^(\S+:\d+\.\d+,\d+\.\d+) (\d+) (\d+)$/gm)) {
    const previous = blocks.get(match[1]!);
    blocks.set(match[1]!, { statements: Number(match[2]), covered: (previous?.covered ?? false) || Number(match[3]) > 0 });
  }
  const all = [...blocks.values()];
  return report('Go coverprofile', { statements: percent(all.filter((block) => block.covered).reduce((sum, block) => sum + block.statements, 0), all.reduce((sum, block) => sum + block.statements, 0)) });
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null);
const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** llvm-cov export (Swift, cargo llvm-cov --json): regions stand for statements. */
function llvmCov(json: Json): CoverageReport | null {
  if (json.type !== 'llvm.coverage.json.export' || !Array.isArray(json.data)) return null;
  const totals = object(object(json.data[0])?.totals);
  const metric = (name: string) => {
    const entry = object(totals?.[name]);
    const count = number(entry?.count);
    const covered = number(entry?.covered);
    return count === null || covered === null ? null : percent(covered, count);
  };
  return report('llvm-cov', { statements: metric('regions'), branches: metric('branches'), functions: metric('functions'), lines: metric('lines') });
}

/** SimpleCov `.last_run.json`: line (and branch) percentages; older versions write `covered_percent`. */
function simpleCov(json: Json): CoverageReport | null {
  const result = object(json.result);
  if (!result) return null;
  return report('SimpleCov', { lines: number(result.line) ?? number(result.covered_percent), branches: number(result.branch) });
}

export function parseCoverageReport(text: string): CoverageReport | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    let json: Json | null;
    try {
      json = object(JSON.parse(trimmed));
    } catch {
      return null;
    }
    if (!json) return null;
    if ('total' in json) {
      const totals = parseCoverageSummary(trimmed);
      return totals ? { format: 'Istanbul json-summary', totals } : null;
    }
    return llvmCov(json) ?? simpleCov(json);
  }
  if (trimmed.startsWith('<')) return /<coverage\b/.test(trimmed) ? cobertura(trimmed) : jacoco(trimmed);
  return goProfile(trimmed) ?? lcov(trimmed);
}

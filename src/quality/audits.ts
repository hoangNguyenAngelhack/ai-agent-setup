import type { Ecosystem } from './gates';

/**
 * Dependency audit tools beyond npm (polyglot gates). Each tool prints its own result; it is read
 * fail-closed: PASS needs exit code 0 and the tool's "no vulnerabilities" sentence, the vulnerability
 * sentence is FAIL, and anything else is NOT_VERIFIED. The sentences follow the tools' documented
 * output and were NOT verified against installed tools (none was installed where this was written):
 * a mismatch shows up as NOT_VERIFIED, never as a false PASS.
 */
export interface AuditTool {
  ecosystem: Ecosystem;
  command: string;
  /** Printed when the audit found nothing. */
  clean: RegExp;
  /** Printed when the audit found vulnerabilities; group 1, when present, is their number. */
  vulnerable: RegExp;
}

export const AUDIT_TOOLS: readonly AuditTool[] = [
  { ecosystem: 'go', command: 'govulncheck ./...', clean: /No vulnerabilities found/, vulnerable: /Your code is affected by (\d+) vulnerabilit/ },
  { ecosystem: 'python', command: 'pip-audit', clean: /No known vulnerabilities found/, vulnerable: /Found (\d+) known vulnerabilit/ },
  { ecosystem: 'rust', command: 'cargo audit', clean: /Scanning \S*Cargo\.lock for vulnerabilities/, vulnerable: /error: (\d+) vulnerabilit(?:y|ies) found/ },
  { ecosystem: 'bundler', command: 'bundle exec bundle-audit check --update', clean: /No vulnerabilities found/, vulnerable: /Vulnerabilities found!/ },
  { ecosystem: 'composer', command: 'composer audit', clean: /No security vulnerability advisories found/, vulnerable: /Found (\d+) security vulnerability advisor/ },
  { ecosystem: 'dotnet', command: 'dotnet list package --vulnerable --include-transitive', clean: /has no vulnerable packages/, vulnerable: /has the following vulnerable packages/ },
];

export interface AuditVerdict {
  status: 'PASS' | 'FAIL' | 'NOT_VERIFIED';
  reason: string | null;
}

export function interpretAudit(tool: AuditTool, exitCode: number, output: string): AuditVerdict {
  const vulnerable = tool.vulnerable.exec(output);
  if (vulnerable) {
    const count = vulnerable[1];
    const what = count ? `${count} known ${count === '1' ? 'vulnerability' : 'vulnerabilities'}` : 'known vulnerabilities';
    return { status: 'FAIL', reason: `${tool.command}: ${what}` };
  }
  if (exitCode === 0 && tool.clean.test(output)) return { status: 'PASS', reason: null };
  return { status: 'NOT_VERIFIED', reason: `${tool.command} did not report a result it could be judged on (exit code ${exitCode}); run it and check its output` };
}

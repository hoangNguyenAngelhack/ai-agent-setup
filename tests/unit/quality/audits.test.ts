import { describe, expect, it } from 'vitest';
import { projectFacts } from '../../../src/app/gates';
import { AUDIT_TOOLS, interpretAudit, resolveCommand, GATES } from '../../../src/quality';
import { writeTree } from '../../helpers/fs-tree';

/**
 * Dependency audit beyond npm (polyglot gates). The tools are not installed here, so the result is
 * read fail-closed: PASS needs exit code 0 and the tool's own "no vulnerabilities" sentence; a
 * vulnerability sentence is FAIL; anything else is NOT_VERIFIED, never PASS.
 */
const audit = GATES.find((gate) => gate.id === 'gate.dependency-audit')!;
const tool = (ecosystem: string) => AUDIT_TOOLS.find((item) => item.ecosystem === ecosystem)!;

describe('dependency audit for every stack', () => {
  it('should pick the audit tool of the project stack', () => {
    const command = (tree: Record<string, string>) => resolveCommand(audit, projectFacts(writeTree(tree)), {});

    expect(command({ 'package.json': '{}', 'package-lock.json': '{}' })).toMatchObject({ command: 'npm audit --json', source: 'built-in' });
    expect(command({ 'go.mod': 'module x\n' })).toMatchObject({ command: 'govulncheck ./...', source: 'built-in' });
    expect(command({ 'requirements.txt': 'flask\n' })).toMatchObject({ command: 'pip-audit', source: 'built-in' });
    expect(command({ 'Cargo.toml': '[package]\n' })).toMatchObject({ command: 'cargo audit', source: 'built-in' });
    expect(command({ Gemfile: "gem 'rails'\n" })).toMatchObject({ command: 'bundle exec bundle-audit check --update', source: 'built-in' });
    expect(command({ 'composer.json': '{}' })).toMatchObject({ command: 'composer audit', source: 'built-in' });
    expect(command({ 'svc.csproj': '<Project />' })).toMatchObject({ command: 'dotnet list package --vulnerable --include-transitive', source: 'built-in' });
    // No audit tool for this stack: no command, and the reason says how to configure one.
    expect(command({ 'pom.xml': '<project/>' })).toMatchObject({ command: null, source: 'none' });
  });

  it.each([
    ['go', 0, 'Scanning your code and 42 packages across 7 dependent modules for known vulnerabilities...\n\nNo vulnerabilities found.\n', 'PASS'],
    ['go', 3, '=== Symbol Results ===\n\nVulnerability #1: GO-2024-0001\n\nYour code is affected by 1 vulnerability from 1 module.\n', 'FAIL'],
    ['python', 0, 'No known vulnerabilities found\n', 'PASS'],
    ['python', 1, 'Found 2 known vulnerabilities in 1 package\nName    Version ID\n', 'FAIL'],
    ['rust', 0, '    Fetching advisory database\n    Scanning Cargo.lock for vulnerabilities (120 crate dependencies)\n', 'PASS'],
    ['rust', 1, 'Crate: time\nID: RUSTSEC-2020-0071\nerror: 1 vulnerability found!\n', 'FAIL'],
    ['bundler', 0, 'Updating ruby-advisory-db ...\nNo vulnerabilities found\n', 'PASS'],
    ['bundler', 1, 'Name: actionpack\nVersion: 6.1.0\nVulnerabilities found!\n', 'FAIL'],
    ['composer', 0, 'No security vulnerability advisories found.\n', 'PASS'],
    ['composer', 1, 'Found 3 security vulnerability advisories affecting 2 packages:\n', 'FAIL'],
    ['dotnet', 0, "The given project `Api` has no vulnerable packages given the current sources.\n", 'PASS'],
    ['dotnet', 0, "Project `Api` has the following vulnerable packages\n   [net8.0]:\n   > System.Text.Json  8.0.0  8.0.0  High\n", 'FAIL'],
  ] as const)('%s: exit %i → %s', (ecosystem, exitCode, output, status) => {
    expect(interpretAudit(tool(ecosystem), exitCode, output).status).toBe(status);
  });

  it('should never pass an audit it could not read', () => {
    for (const item of AUDIT_TOOLS) {
      // A clean exit without the clean sentence (unexpected output, another tool version).
      expect(interpretAudit(item, 0, 'something else\n'), item.ecosystem).toMatchObject({ status: 'NOT_VERIFIED' });
      // A failure without the vulnerability sentence (network error, missing lockfile).
      expect(interpretAudit(item, 2, 'error: could not fetch the advisory database\n'), item.ecosystem).toMatchObject({ status: 'NOT_VERIFIED' });
    }
    // The clean sentence with a failing exit code is not a pass either.
    expect(interpretAudit(tool('python'), 1, 'No known vulnerabilities found\n').status).toBe('NOT_VERIFIED');
  });

  it('should report the number of vulnerabilities when the tool states it', () => {
    expect(interpretAudit(tool('go'), 3, 'Your code is affected by 4 vulnerabilities from 2 modules.')).toMatchObject({ status: 'FAIL', reason: expect.stringMatching(/4 known vulnerabilit/) as unknown });
  });
});

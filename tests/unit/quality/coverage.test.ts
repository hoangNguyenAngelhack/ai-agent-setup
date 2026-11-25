import { describe, expect, it } from 'vitest';
import { projectFacts } from '../../../src/app/gates';
import { coverageArtifact, GATES, parseCoverageReport, resolveCommand, runGates } from '../../../src/quality';
import { writeTree } from '../../helpers/fs-tree';

/**
 * Coverage reports of every stack (polyglot gates). Each format is read from its documented shape; a
 * metric the format does not report is null (not measured), never a pass; a report with no measured
 * metric, or that is not a known format, is null.
 */
describe('coverage report formats', () => {
  it('should read LCOV (Istanbul, Flutter, cargo-llvm-cov, gcov/lcov) summed over files', () => {
    const lcov = ['TN:', 'SF:lib/a.dart', 'FNF:4', 'FNH:3', 'LF:10', 'LH:9', 'BRF:4', 'BRH:2', 'end_of_record', 'SF:lib/b.dart', 'FNF:0', 'FNH:0', 'LF:10', 'LH:7', 'end_of_record', ''].join('\n');
    expect(parseCoverageReport(lcov)).toEqual({ format: 'LCOV', totals: { statements: null, branches: 50, functions: 75, lines: 80 } });
  });

  it('should read Cobertura XML (pytest-cov, coverlet, PHPUnit, gcovr) from counts, falling back to rates', () => {
    const counts = '<?xml version="1.0" ?>\n<coverage line-rate="0.8333" branch-rate="0.5" lines-covered="25" lines-valid="30" branches-covered="5" branches-valid="10" version="7.4">\n<packages/></coverage>';
    expect(parseCoverageReport(counts)).toEqual({ format: 'Cobertura', totals: { statements: null, branches: 50, functions: null, lines: 83.33 } });
    expect(parseCoverageReport('<coverage line-rate="0.9" branch-rate="0" branches-valid="0" lines-valid="40" lines-covered="36"></coverage>')).toEqual({
      format: 'Cobertura',
      totals: { statements: null, branches: null, functions: null, lines: 90 },
    });
  });

  it('should read JaCoCo XML from the report-level counters only', () => {
    const jacoco = [
      '<?xml version="1.0"?><report name="app">',
      '<package name="a"><class name="a/X"><counter type="LINE" missed="100" covered="0"/></class>',
      '<counter type="LINE" missed="100" covered="0"/></package>',
      '<counter type="INSTRUCTION" missed="20" covered="80"/><counter type="BRANCH" missed="3" covered="7"/>',
      '<counter type="LINE" missed="10" covered="90"/><counter type="METHOD" missed="1" covered="9"/>',
      '</report>',
    ].join('');
    expect(parseCoverageReport(jacoco)).toEqual({ format: 'JaCoCo', totals: { statements: 80, branches: 70, functions: 90, lines: 90 } });
  });

  it('should read a Go coverprofile as statement coverage, counting each block once', () => {
    const profile = ['mode: atomic', 'example.com/x/a.go:3.10,5.2 2 1', 'example.com/x/a.go:7.10,9.2 3 0', 'example.com/x/a.go:7.10,9.2 3 4', 'example.com/x/b.go:1.1,2.2 5 0', ''].join('\n');
    expect(parseCoverageReport(profile)).toEqual({ format: 'Go coverprofile', totals: { statements: 50, branches: null, functions: null, lines: null } });
  });

  it('should read llvm-cov JSON exports (Swift, cargo llvm-cov --json)', () => {
    const json = JSON.stringify({
      type: 'llvm.coverage.json.export',
      data: [{ totals: { lines: { count: 200, covered: 170, percent: 85 }, functions: { count: 20, covered: 18, percent: 90 }, branches: { count: 0, covered: 0, percent: 0 }, regions: { count: 100, covered: 75, percent: 75 } } }],
    });
    expect(parseCoverageReport(json)).toEqual({ format: 'llvm-cov', totals: { statements: 75, branches: null, functions: 90, lines: 85 } });
  });

  it('should read SimpleCov .last_run.json in both its current and older shapes', () => {
    expect(parseCoverageReport('{"result":{"line":92.31,"branch":75.0}}')).toEqual({ format: 'SimpleCov', totals: { statements: null, branches: 75, functions: null, lines: 92.31 } });
    expect(parseCoverageReport('{"result":{"covered_percent":88.5}}')).toEqual({ format: 'SimpleCov', totals: { statements: null, branches: null, functions: null, lines: 88.5 } });
  });

  it('should keep reading Istanbul json-summary', () => {
    expect(parseCoverageReport('{"total":{"statements":{"pct":90},"branches":{"pct":81.5},"functions":{"pct":95},"lines":{"pct":88.2}}}')).toEqual({
      format: 'Istanbul json-summary',
      totals: { statements: 90, branches: 81.5, functions: 95, lines: 88.2 },
    });
  });

  it('should refuse anything that is not a known report or measures nothing', () => {
    for (const text of ['', 'hello', '{"lines":88}', '<coverage></coverage>', 'TN:\nSF:a\nLF:0\nLH:0\nend_of_record\n', 'mode: set\n', '<report></report>', '{"result":{}}']) {
      expect(parseCoverageReport(text), JSON.stringify(text)).toBeNull();
    }
  });
});

describe('coverage gate for every stack', () => {
  const gate = GATES.find((item) => item.id === 'gate.coverage-80')!;
  const resolved = (tree: Record<string, string>) => {
    const facts = projectFacts(writeTree(tree));
    const command = resolveCommand(gate, facts, {});
    return { command: command.command, artifact: coverageArtifact(command) };
  };

  it('should run each stack coverage tool and read its report', () => {
    expect(resolved({ 'go.mod': 'module x\n' })).toEqual({ command: 'go test ./... -coverprofile=coverage.out', artifact: 'coverage.out' });
    expect(resolved({ 'pyproject.toml': '[project]\n[project.optional-dependencies]\ntest = ["pytest", "pytest-cov"]\n' })).toEqual({ command: 'pytest -q --cov --cov-report=xml:coverage.xml', artifact: 'coverage.xml' });
    expect(resolved({ 'Cargo.toml': '[package]\n' })).toEqual({ command: 'cargo llvm-cov --lcov --output-path lcov.info', artifact: 'lcov.info' });
    expect(resolved({ 'pubspec.yaml': 'dependencies:\n  flutter:\n    sdk: flutter\n' })).toEqual({ command: 'flutter test --coverage', artifact: 'coverage/lcov.info' });
    expect(resolved({ 'Package.swift': '// swift-tools-version:5.9' })).toEqual({ command: 'swift test --enable-code-coverage', artifact: '.build/debug/codecov/*.json' });
    expect(resolved({ 'build.gradle.kts': 'plugins { jacoco }' })).toEqual({ command: './gradlew test jacocoTestReport', artifact: 'build/reports/jacoco/test/jacocoTestReport.xml' });
    expect(resolved({ 'pom.xml': '<artifactId>jacoco-maven-plugin</artifactId>' })).toEqual({ command: 'mvn -q test jacoco:report', artifact: 'target/site/jacoco/jacoco.xml' });
    expect(resolved({ 'Api.Tests.csproj': '<PackageReference Include="coverlet.collector" />' })).toEqual({ command: 'dotnet test --collect:"XPlat Code Coverage" --results-directory coverage', artifact: 'coverage/*/coverage.cobertura.xml' });
    expect(resolved({ 'composer.json': JSON.stringify({ 'require-dev': { 'phpunit/phpunit': '^11' } }) })).toEqual({ command: 'vendor/bin/phpunit --coverage-cobertura coverage.xml', artifact: 'coverage.xml' });
    expect(resolved({ Gemfile: "gem 'rspec'\ngem 'simplecov'\n" })).toEqual({ command: 'bundle exec rspec', artifact: 'coverage/.last_run.json' });
    // Without a coverage tool the gate has no command (and says how to configure one).
    expect(resolved({ 'requirements.txt': 'flask\n' })).toEqual({ command: null, artifact: 'coverage/coverage-summary.json' });
    expect(resolved({ 'package.json': '{"scripts":{"test:coverage":"vitest run --coverage"}}' })).toEqual({ command: 'npm run test:coverage', artifact: 'coverage/coverage-summary.json' });
  });

  it('should judge an LCOV report and a Cobertura report found through a wildcard', async () => {
    const root = writeTree({
      'lcov.js': 'require("fs").writeFileSync("lcov.info", ["SF:a","LF:10","LH:" + process.argv[2],"end_of_record",""].join("\\n"))',
      'cobertura.js': 'const fs=require("fs");fs.mkdirSync("coverage/3f2a",{recursive:true});fs.writeFileSync("coverage/3f2a/coverage.cobertura.xml","<coverage line-rate=\\"0.95\\" branch-rate=\\"0.6\\"></coverage>")',
    });
    const run = (command: string, artifact: string) =>
      runGates(
        { gates: [], required: ['gate.coverage-80'] },
        {
          runId: 'run-20261125T000000Z-abcdef',
          root,
          project: { name: 'demo', commit: null },
          environment: { platform: process.platform, arch: process.arch, node: process.version, ci: false },
          facts: { ecosystems: [], nodePackageManager: null, scripts: {}, lockfiles: [] },
          config: { gates: { 'gate.coverage-80': { command, artifact } } },
          evidence: { write: (_gate, name, content) => ({ path: name, checksum: `sha256:${'0'.repeat(64)}`, size: content.length }) },
          validate: () => ({ valid: true, errors: [] }),
        },
      );

    expect((await run('node lcov.js 9', 'lcov.info')).records[0]).toMatchObject({ status: 'PASS', reason: 'LCOV: not measured for statements, branches, functions' });
    expect((await run('node lcov.js 5', 'lcov.info')).records[0]).toMatchObject({ status: 'FAIL', reason: 'coverage below 80%: lines 50%' });
    expect((await run('node cobertura.js', 'coverage/*/coverage.cobertura.xml')).records[0]).toMatchObject({ status: 'FAIL', reason: 'coverage below 80%: branches 60%' });
    expect((await run('node lcov.js 9', 'nothing/*.xml')).records[0]).toMatchObject({ status: 'NOT_VERIFIED' });
  });
});

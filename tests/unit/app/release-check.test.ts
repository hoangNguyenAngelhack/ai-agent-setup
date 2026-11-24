import { describe, expect, it } from 'vitest';
import {
  auditGate,
  brokenLinks,
  checkRelease,
  CHECKLIST_FILE,
  enginesGate,
  packageProblems,
  readSignOff,
  renderReleaseReport,
  secretFindings,
  type CommandResult,
  type Runner,
} from '../../../src/app/release-check';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

const ok = (stdout = ''): CommandResult => ({ code: 0, stdout, stderr: '' });
const REQUIRED = ['package.json', 'README.md', 'LICENSE', 'bin/cli.js', 'dist/cli/main.js', 'catalog/schemas/a.json'];

describe('release gates (W2.2-08)', () => {
  it('should require the published essentials and refuse private or removed files', () => {
    expect(packageProblems(REQUIRED)).toEqual([]);
    expect(packageProblems(['package.json'])).toEqual(['missing README.md', 'missing LICENSE', 'missing bin/cli.js', 'missing dist/', 'missing catalog/schemas/']);
    const extra = ['.env', 'templates/x/.env.production', 'templates/x/.env.example', 'certs/server.pem', 'tests/a.test.js', '.ai-agent-setup/runs/x', 'templates/.claude/CLAUDE.md'];
    expect(packageProblems([...REQUIRED, ...extra])).toEqual([
      '.env: environment file',
      'templates/x/.env.production: environment file',
      'certs/server.pem: key material',
      'tests/a.test.js: development files',
      '.ai-agent-setup/runs/x: toolkit run state',
      'templates/.claude/CLAUDE.md: V1 template configuration removed in 2.0 (07 §5)',
    ]);
  });

  it('should find real credentials but not example connection strings or allowed fixtures', () => {
    const token = `ghp_${'Zq7'.repeat(12)}`;
    const root = writeTree({
      'real.txt': 'DB=postgres://admin:s3cret-pass@db.example.com:5432/app\n',
      'example.env': 'DB=postgres://user:password@localhost:5432/app\nURL=mysql://USER:PASSWORD@HOST:3306/db\n',
      'allowed.js': `const fixture = '${token}'; // secret-scan:allow\n`,
      'token.js': `const t = '${token}';\n`,
      'binary.bin': `\0${token}`,
    });
    expect(secretFindings(root, ['real.txt', 'example.env', 'allowed.js', 'token.js', 'binary.bin', 'missing.txt'])).toEqual(['real.txt: 1 url-credentials', 'token.js: 1 github-token']);
  });

  it('should report relative links that point to no file, ignoring URLs, anchors and code blocks', () => {
    const root = writeTree({
      'README.md': '[ok](docs/a.md#part) [web](https://example.com) [top](#intro) [gone](docs/missing.md) [out](../outside.md)\n```\n[code](nowhere.md)\n```\n',
      'docs/a.md': '[back](../README.md) [space](b%20c.md)',
      'docs/b c.md': 'x',
    });
    expect(brokenLinks(root)).toEqual(['README.md: docs/missing.md', 'README.md: ../outside.md']);
    // The repository's own documentation has no broken relative link.
    expect(brokenLinks(REPO_ROOT)).toEqual([]);
  });

  it('should require the lowest accepted Node version to be tested in CI', () => {
    const ci = 'jobs:\n  test:\n    strategy:\n      matrix:\n        node: [20, 22, 24]\n';
    expect(enginesGate('>=20.0.0', ci).status).toBe('PASS');
    expect(enginesGate('>=18.0.0', ci)).toMatchObject({ status: 'FAIL', evidence: expect.stringContaining('decide OQ-07') as unknown });
    expect(enginesGate(undefined, ci).status).toBe('NOT_VERIFIED');
    expect(enginesGate('>=20', 'no matrix').status).toBe('NOT_VERIFIED');
  });

  it('should pass an audit only on a real report without high or critical advisories', () => {
    const report = (vulnerabilities: Record<string, number>) => ok(JSON.stringify({ metadata: { vulnerabilities } }));
    expect(auditGate(report({ critical: 0, high: 0, moderate: 2, low: 1 }))).toMatchObject({ status: 'PASS', evidence: 'npm audit: 0 critical, 0 high, 2 moderate, 1 low' });
    expect(auditGate(report({ high: 1 })).status).toBe('FAIL');
    expect(auditGate({ code: 1, stdout: '', stderr: 'npm ERR! network' })).toMatchObject({ status: 'NOT_VERIFIED', evidence: expect.stringContaining('network') as unknown });
    expect(auditGate(ok(JSON.stringify({ error: { summary: 'registry unreachable' } })))).toMatchObject({ status: 'NOT_VERIFIED', evidence: 'npm audit failed: registry unreachable' });
  });

  it('should read the sign-off list exactly as written', () => {
    expect(readSignOff('- [x] **S1** Version chosen — owner: Maintainer\n- [ ] **S2** CI green — owner: Maintainer\n- [ ] S3 not in the format — owner: x\n')).toEqual([
      { id: 'S1', item: 'Version chosen', owner: 'Maintainer', done: true },
      { id: 'S2', item: 'CI green', owner: 'Maintainer', done: false },
    ]);
  });
});

/** A package tree and a runner that answers every command as a healthy release would. */
function releaseTree(signOff: string): string {
  return writeTree({
    'package.json': JSON.stringify({ name: 'pkg', version: '2.0.0', engines: { node: '>=20' } }),
    'CHANGELOG.md': '## [2.0.0]\n',
    'README.md': '# pkg\n',
    '.github/workflows/ci.yml': '      matrix:\n        node: [20, 22]\n',
    [CHECKLIST_FILE]: signOff,
  });
}

function runner(overrides: Record<string, CommandResult> = {}): Runner {
  return (command, args) => {
    const key = `${command} ${args.join(' ')}`;
    if (overrides[key]) return overrides[key];
    if (key === 'npm audit --json') return ok(JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 0 } } }));
    if (key === 'node bin/cli.js --version') return ok('pkg 2.0.0\n');
    if (key === 'npm pack --dry-run --json') return ok(JSON.stringify([{ files: REQUIRED.map((path) => ({ path })) }]));
    if (key === 'npm run test:coverage') return ok(' Test Files  3 passed (3)\nTests  12 passed (12)\n=====\n');
    return ok('done\n');
  };
}

describe('release check (W2.2-08)', () => {
  it('should be READY only with every gate PASS and every sign-off ticked', () => {
    const ready = checkRelease({ root: releaseTree('- [x] **S1** Version chosen — owner: Maintainer\n'), run: runner() });
    expect(ready).toMatchObject({ status: 'READY', blockers: [], package: { name: 'pkg', version: '2.0.0' } });
    expect(ready.gates.map((item) => item.status).every((status) => status === 'PASS')).toBe(true);
    expect(ready.gates.find((item) => item.id === 'tests')!.evidence).toBe('npm run test:coverage: exit 0; Tests  12 passed (12)');

    const open = checkRelease({ root: releaseTree('- [ ] **S1** Version chosen — owner: Maintainer\n'), run: runner() });
    expect(open).toMatchObject({ status: 'NOT_READY', blockers: ['sign-off S1 open: Version chosen (Maintainer)'] });
    expect(checkRelease({ root: releaseTree('no list'), run: runner() }).blockers).toEqual([`no sign-off list in ${CHECKLIST_FILE}`]);
  });

  it('should not claim gates that could not run after a failed build', () => {
    const report = checkRelease({ root: releaseTree('- [x] **S1** x — owner: y\n'), run: runner({ 'npm run build': { code: 2, stdout: '', stderr: 'error TS1005' } }) });
    const status = Object.fromEntries(report.gates.map((item) => [item.id, item.status]));
    expect(status).toMatchObject({ build: 'FAIL', catalog: 'NOT_VERIFIED', 'eval-regressions': 'NOT_VERIFIED', 'cli-version': 'NOT_VERIFIED' });
    expect(report.status).toBe('NOT_READY');
    expect(renderReleaseReport(report)).toContain('- gate build: FAIL');
  });

  it('should treat a command that never ran and an unreadable pack list as NOT_VERIFIED', () => {
    const report = checkRelease({
      root: releaseTree('- [x] **S1** x — owner: y\n'),
      run: runner({ 'npm run lint': { code: null, stdout: '', stderr: 'spawn npm ENOENT' }, 'npm pack --dry-run --json': { code: 1, stdout: '', stderr: 'pack failed' } }),
    });
    const byId = Object.fromEntries(report.gates.map((item) => [item.id, item]));
    expect(byId.lint).toMatchObject({ status: 'NOT_VERIFIED', evidence: 'npm run lint did not run: spawn npm ENOENT' });
    expect(byId['package-contents']).toMatchObject({ status: 'NOT_VERIFIED', evidence: expect.stringContaining('pack failed') as unknown });
    expect(byId['package-secrets']!.status).toBe('NOT_VERIFIED');
  });

  it('should fail a wrong CLI version or a missing CHANGELOG entry, and not guess without a CI workflow', () => {
    const root = writeTree({
      'package.json': JSON.stringify({ name: 'pkg', version: '2.0.1', engines: { node: '>=20' } }),
      [CHECKLIST_FILE]: '- [x] **S1** x — owner: y\n',
    });
    const byId = Object.fromEntries(checkRelease({ root, run: runner() }).gates.map((item) => [item.id, item]));
    expect(byId['cli-version']).toMatchObject({ status: 'FAIL', evidence: '--version printed "pkg 2.0.0"; package.json 2.0.1' });
    expect(byId.changelog).toMatchObject({ status: 'FAIL', evidence: 'no "## [2.0.1]" heading in CHANGELOG.md' });
    expect(byId.engines!.status).toBe('NOT_VERIFIED');
  });

  it('should keep the sign-off list of the repository readable', () => {
    const report = checkRelease({ root: REPO_ROOT, run: runner() });
    expect(report.signOff.map((item) => item.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']);
  });
});

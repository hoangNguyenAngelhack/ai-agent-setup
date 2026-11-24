import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGateHistory, runQualityGates } from '../../../src/app/gates';
import type { GateCategory } from '../../../src/core/contracts';
import { firstProgram, GATES, type GateRecord, parseCoverageSummary, programExists, parseNpmAudit, resolveCommand, runGates, scanDiffForSecrets, scanFilesForSecrets, validateGateConfig, type GateRunContext } from '../../../src/quality';
import { SchemaValidator } from '../../../src/registry';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

const validator = new SchemaValidator(join(REPO_ROOT, 'catalog', 'schemas'));
const RECORD = 'urn:ai-agent-setup:contracts:v1:gate-record';
const RUN_ID = 'run-20261124T100000Z-abcdef';
const SECRET = `ghp_${'Zx9'.repeat(12)}`; // synthetic

const SCRIPTS = {
  'ok.js': 'console.log("all good")',
  'fail.js': 'console.error("broken"); process.exit(3)',
  'slow.js': 'setTimeout(() => {}, 60000)',
  'leak.js': `console.log("token=${SECRET} mail jane.doe@example.com")`,
  // Writes an Istanbul json-summary; argv: lines pct, optional branches pct (defaults to lines).
  'cov.js': 'const fs=require("fs");const l=Number(process.argv[2]);const a=process.argv[3];const b=a==="Unknown"?{total:0,pct:"Unknown"}:{pct:Number(a??l)};fs.mkdirSync("coverage",{recursive:true});fs.writeFileSync("coverage/coverage-summary.json",JSON.stringify({total:{statements:{pct:l},branches:b,functions:{pct:l},lines:{pct:l}}}))',
};

function project(gates: Record<string, string>, extra: Record<string, string> = {}) {
  const files: Record<string, string> = { ...extra };
  for (const [name, body] of Object.entries(SCRIPTS)) files[`scripts/${name}`] = body;
  const config = { gates: Object.fromEntries(Object.entries(gates).map(([id, command]) => [id, { command }])) };
  files['.ai-agent-setup/gates.json'] = JSON.stringify(config);
  return { root: writeTree(files, 'gates-'), config };
}

function context(root: string, config: GateRunContext['config'], overrides: Partial<GateRunContext> = {}): GateRunContext {
  return {
    runId: RUN_ID,
    root,
    project: { name: 'demo', commit: null },
    environment: { platform: process.platform, arch: process.arch, node: process.version, ci: false },
    facts: { ecosystems: [], nodePackageManager: null, scripts: {}, lockfiles: [] },
    config,
    evidence: {
      write: (gate, name, content) => {
        const file = `evidence-${gate}.${name}`;
        writeFileSync(join(root, file), content);
        return { path: file, checksum: `sha256:${'0'.repeat(64)}` };
      },
    },
    validate: (record) => validator.validate(RECORD, record),
    ...overrides,
  };
}

const node = (script: string, args = '') => `node scripts/${script}${args ? ` ${args}` : ''}`;

describe('gate registry', () => {
  it('should cover every category with an explicit support status', () => {
    const categories: GateCategory[] = ['build', 'unit', 'integration', 'e2e', 'static-analysis', 'security', 'dependency-audit', 'performance', 'accessibility', 'documentation', 'deployment-readiness'];

    expect([...new Set(GATES.map((gate) => gate.category))].sort()).toEqual([...categories].sort());
    for (const gate of GATES) expect(['project-command', 'built-in', 'composite']).toContain(gate.support);
    expect(new Set(GATES.map((gate) => gate.id)).size).toBe(GATES.length);
  });

  it('should resolve config, then script, then stack default', () => {
    const build = GATES.find((gate) => gate.id === 'gate.build')!;
    const facts = { ecosystems: ['node', 'go'] as const, nodePackageManager: 'pnpm', scripts: { build: 'tsc' }, lockfiles: [] };

    expect(resolveCommand(build, { ...facts, ecosystems: [...facts.ecosystems] }, { gates: { 'gate.build': { command: 'make' } } })).toMatchObject({ command: 'make', source: 'config' });
    expect(resolveCommand(build, { ...facts, ecosystems: [...facts.ecosystems] }, {})).toMatchObject({ command: 'pnpm run build', source: 'script' });
    expect(resolveCommand(build, { ...facts, ecosystems: ['go'], scripts: {} }, {})).toMatchObject({ command: 'go build ./...', source: 'default' });
    expect(resolveCommand(build, { ...facts, ecosystems: [], scripts: {} }, {})).toMatchObject({ command: null, source: 'none' });
  });

  it('should reject malformed gate configuration', () => {
    expect(validateGateConfig({ gates: { 'gate.build': { command: '' } }, extra: 1 }).problems).toHaveLength(2);
    expect(validateGateConfig({ required: ['gate.lint'] })).toEqual({ config: { required: ['gate.lint'] }, problems: [] });
  });
});

describe('runGates', () => {
  it('should PASS only with executed evidence and a valid record', async () => {
    const { root, config } = project({ 'gate.build': node('ok.js') });
    const report = await runGates({ gates: [], required: ['gate.build'] }, context(root, config));
    const [record] = report.records;

    expect(report.status).toBe('PASS');
    expect(record).toMatchObject({ gate: 'gate.build', gateVersion: '1.0.0', status: 'PASS', measured: true, exitCode: 0, command: 'node scripts/ok.js', runId: RUN_ID });
    expect(record!.evidence.map((item) => item.type)).toEqual(['command', 'artifact']);
    expect(record!.checksum).toMatch(/^sha256:/);
    expect(validator.validate(RECORD, record).valid).toBe(true);
  });

  it('should FAIL on a non-zero exit and keep the log', async () => {
    const { root, config } = project({ 'gate.build': node('fail.js') });
    const report = await runGates({ gates: [], required: ['gate.build'] }, context(root, config));

    expect(report).toMatchObject({ status: 'FAIL', records: [{ status: 'FAIL', reason: 'exit code 3', exitCode: 3 }] });
    expect(readFileSync(join(root, 'evidence-gate.build.log'), 'utf8')).toContain('broken');
  });

  it('should report a missing command as NOT_VERIFIED with the fix', async () => {
    const report = await runGates({ gates: [], required: ['gate.integration-tests'] }, context(writeTree({}), {}));

    expect(report.status).toBe('NOT_VERIFIED');
    expect(report.records[0]!.reason).toMatch(/add a "test:integration" script/);
  });

  it('should report a tool that is not installed as NOT_VERIFIED', async () => {
    const { root, config } = project({ 'gate.lint': 'definitely-not-a-real-tool-xyz --check' });
    const report = await runGates({ gates: [], required: ['gate.lint'] }, context(root, config));

    expect(report.records[0]).toMatchObject({ status: 'NOT_VERIFIED', measured: false });
    expect(report.records[0]!.reason).toMatch(/command not found/);
  });

  it('should time out a command and report NOT_VERIFIED', async () => {
    const { root } = project({});
    const report = await runGates({ gates: [], required: ['gate.build'] }, context(root, { gates: { 'gate.build': { command: node('slow.js'), timeoutMs: 300 } } }));

    expect(report.records[0]).toMatchObject({ status: 'NOT_VERIFIED', reason: 'timed out after 300 ms', exitCode: null });
  }, 15000);

  it('should cancel a running gate and the remaining ones', async () => {
    const { root, config } = project({ 'gate.build': node('slow.js'), 'gate.lint': node('ok.js') });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 300);
    const report = await runGates({ gates: [], required: ['gate.build', 'gate.lint'] }, context(root, config, { signal: controller.signal }));

    expect(report.records.map((record) => [record.gate, record.status, record.reason])).toEqual([
      ['gate.build', 'NOT_VERIFIED', 'cancelled'],
      ['gate.lint', 'NOT_VERIFIED', 'cancelled'],
    ]);
  }, 15000);

  it('should redact secrets and personal data from stored evidence', async () => {
    const { root, config } = project({ 'gate.build': node('leak.js') });
    await runGates({ gates: [], required: ['gate.build'] }, context(root, config));
    const log = readFileSync(join(root, 'evidence-gate.build.log'), 'utf8');

    expect(log).not.toContain(SECRET);
    expect(log).not.toContain('jane.doe@example.com');
    expect(log).toContain('[REDACTED');
  });

  it('should never turn a skipped required gate into PASS', async () => {
    const { root, config } = project({ 'gate.build': node('ok.js'), 'gate.lint': node('ok.js') });
    const report = await runGates({ gates: [], required: ['gate.build', 'gate.lint'], skip: ['gate.lint'] }, context(root, config));

    expect(report.status).toBe('NOT_VERIFIED');
    expect(report.records[1]!.reason).toBe('skipped by user; a required gate cannot pass without running');
  });

  it('should not PASS when nothing is required', async () => {
    const { root, config } = project({ 'gate.build': node('ok.js') });

    expect((await runGates({ gates: ['gate.build'], required: [] }, context(root, config))).status).toBe('NOT_VERIFIED');
  });

  it('should ignore optional failures in the overall status but report them', async () => {
    const { root, config } = project({ 'gate.build': node('ok.js'), 'gate.lint': node('fail.js') });
    const report = await runGates({ gates: ['gate.lint'], required: ['gate.build'] }, context(root, config));

    expect(report.status).toBe('PASS');
    expect(report.summary).toEqual({ PASS: 1, FAIL: 1, NOT_VERIFIED: 0 });
  });

  it('should say so when a configured command replaces a built-in check', async () => {
    const { root, config } = project({ 'gate.security-scan': node('ok.js') });
    const report = await runGates({ gates: [], required: ['gate.security-scan'] }, context(root, config));

    expect(report.records[0]).toMatchObject({ status: 'PASS', reason: 'built-in secret-scan replaced by the configured command' });
  });

  it('should report unknown gates as NOT_VERIFIED', async () => {
    const report = await runGates({ gates: [], required: ['gate.openapi-lint'] }, context(writeTree({}), {}));

    expect(report.records[0]).toMatchObject({ status: 'NOT_VERIFIED', reason: 'unknown gate gate.openapi-lint: not in the gate registry' });
  });

  it('should downgrade a record that fails contract validation', async () => {
    const { root, config } = project({ 'gate.build': node('ok.js') });
    let calls = 0;
    const report = await runGates(
      { gates: [], required: ['gate.build'] },
      context(root, config, { validate: (record) => (calls++ === 0 ? { valid: false, errors: ['/evidence: forced'] } : validator.validate(RECORD, record)) }),
    );

    expect(report.records[0]).toMatchObject({ status: 'NOT_VERIFIED', reason: 'record failed contract validation: /evidence: forced' });
  });

  it('should derive deployment readiness from the gates it requires', async () => {
    const { root, config } = project({ 'gate.build': node('ok.js'), 'gate.unit-tests': node('ok.js'), 'gate.security-scan': node('ok.js') });
    const report = await runGates({ gates: [], required: ['gate.deployment-readiness'] }, context(root, config));

    expect(report.records.map((record) => record.gate)).toEqual(['gate.build', 'gate.unit-tests', 'gate.security-scan', 'gate.deployment-readiness']);
    expect(report.records.at(-1)).toMatchObject({ status: 'PASS', command: null });
    expect(report.status).toBe('PASS');
  });

  it('should require fresh coverage at or above the threshold', async () => {
    const { root } = project({});
    const run = (pct: number) => runGates({ gates: [], required: ['gate.coverage-80'] }, context(root, { gates: { 'gate.coverage-80': { command: node('cov.js', String(pct)) } } }));

    expect((await run(91.5)).records[0]).toMatchObject({ status: 'PASS' });
    expect((await run(42)).records[0]).toMatchObject({ status: 'FAIL', reason: 'coverage below 80%: statements 42%, branches 42%, functions 42%, lines 42%' });
    const noBranches = await runGates({ gates: [], required: ['gate.coverage-80'] }, context(root, { gates: { 'gate.coverage-80': { command: node('cov.js', '95 Unknown') } } }));
    expect(noBranches.records[0]).toMatchObject({ status: 'PASS', reason: 'nothing to cover for branches (not applicable)' });
    const branchesOnly = await runGates({ gates: [], required: ['gate.coverage-80'] }, context(root, { gates: { 'gate.coverage-80': { command: node('cov.js', '95 68.8') } } }));
    expect(branchesOnly.records[0]).toMatchObject({ status: 'FAIL', reason: 'coverage below 80%: branches 68.8%', gateVersion: '1.1.0' });

    const old = new Date(Date.now() - 60_000);
    utimesSync(join(root, 'coverage', 'coverage-summary.json'), old, old);
    const stale = await runGates({ gates: [], required: ['gate.coverage-80'] }, context(root, { gates: { 'gate.coverage-80': { command: node('ok.js') } } }));
    expect(stale.records[0]!.reason).toMatch(/not updated by this run/);
  });

  it('should report missing coverage output as NOT_VERIFIED', async () => {
    const { root } = project({});
    const report = await runGates({ gates: [], required: ['gate.coverage-95'] }, context(root, { gates: { 'gate.coverage-95': { command: node('ok.js') } } }));

    expect(report.records[0]!.reason).toMatch(/coverage-summary.json not found/);
  });
});

describe('programExists', () => {
  it.each([
    ['npm run build', 'npm'],
    ['FOO=1 BAR=2 node x.js', 'node'],
    ['"C:\\Program Files\\tool.exe" --check', 'C:\\Program Files\\tool.exe'],
    ['./gradlew test', './gradlew'],
    ['   ', null],
  ])('should find the program of %j', (command, program) => {
    expect(firstProgram(command)).toBe(program);
  });

  it('should tell a missing program from a present one, builtins and paths included', () => {
    const root = writeTree({ 'scripts/ok.js': '' });

    expect(programExists('definitely-not-a-real-tool-xyz --check', root)).toBe(false);
    expect(programExists('node scripts/ok.js', root)).toBe(true);
    expect(programExists('cd sub && npm test', root)).toBe(true);
    expect(programExists('./missing-wrapper build', root)).toBe(false);
    expect(programExists('./scripts/ok.js', root)).toBe(true);
  });

  it('should keep a real failure of an existing program as FAIL', async () => {
    const { root, config } = project({ 'gate.lint': node('fail.js') });

    expect((await runGates({ gates: [], required: ['gate.lint'] }, context(root, config))).records[0]).toMatchObject({ status: 'FAIL', reason: 'exit code 3' });
  });
});

describe('built-in checks', () => {
  it('should find secrets in added diff lines with their location and no value', () => {
    const diff = ['+++ b/src/config.ts', '@@ -1,0 +10,2 @@', '+const a = 1;', `+const token = "${SECRET}";`, '+++ b/README.md', '@@ -3 +3 @@', '-old', '+new text'].join('\n');

    expect(scanDiffForSecrets(diff)).toEqual([{ file: 'src/config.ts', line: 11, kinds: ['github-token', 'assignment'] }]);
  });

  it('should not flag ordinary code that mentions secret-like names', () => {
    const files = [{ path: 'a.ts', content: "const SECRET_LABELS = new Set(['jwt']);\nconst map = { secrets: 'credentials' };\nconst token = `${prefix}-x`;\nconst password = process.env.DB_PASSWORD;" }];

    expect(scanFilesForSecrets(files)).toEqual({ findings: [], allowed: [] });
    expect(scanFilesForSecrets([{ path: 'b.ts', content: "const dbPassword = 'hunter2hunter2';" }]).findings).toEqual([{ file: 'b.ts', line: 1, kinds: ['assignment'] }]); // secret-scan:allow synthetic fixture
  });

  it('should parse npm audit reports and refuse anything else', () => {
    expect(parseNpmAudit(JSON.stringify({ metadata: { vulnerabilities: { high: 2, critical: 0, moderate: 1, low: 0 } } }))).toEqual({ critical: 0, high: 2, moderate: 1, low: 0 });
    expect(parseNpmAudit(JSON.stringify({ error: { code: 'ENOTFOUND' } }))).toBeNull();
    expect(parseNpmAudit('npm ERR! network')).toBeNull();
  });

  it('should read only Istanbul json-summary coverage', () => {
    expect(parseCoverageSummary('{"total":{"statements":{"pct":90},"branches":{"pct":81.5},"functions":{"pct":95},"lines":{"pct":88.2}}}')).toEqual({ statements: 90, branches: 81.5, functions: 95, lines: 88.2 });
    expect(parseCoverageSummary('{"total":{"lines":{"pct":88.2}}}')).toBeNull();
    // Older Istanbul writes "Unknown" when there is nothing to cover; newer versions report total 0.
    expect(parseCoverageSummary('{"total":{"statements":{"pct":90},"branches":{"total":0,"pct":"Unknown"},"functions":{"total":0,"pct":100},"lines":{"pct":88}}}')).toEqual({ statements: 90, branches: null, functions: null, lines: 88 });
    expect(parseCoverageSummary('{"total":{"statements":{"pct":90},"branches":{"pct":90},"functions":{"pct":90},"lines":{"total":0,"pct":"Unknown"}}}')).toBeNull();
    // "Unknown" without a stated zero total is missing data, not a free pass.
    expect(parseCoverageSummary('{"total":{"statements":{"pct":90},"branches":{"pct":"Unknown"},"functions":{"pct":90},"lines":{"pct":90}}}')).toBeNull();
    expect(parseCoverageSummary('{"total":{"statements":{"pct":90},"branches":{"total":12,"pct":"Unknown"},"functions":{"pct":90},"lines":{"pct":90}}}')).toBeNull();
    expect(parseCoverageSummary('{"lines":88}')).toBeNull();
  });

  it('should FAIL the secret scan on an uncommitted secret and PASS a clean tree', async () => {
    const root = writeTree({ 'a.txt': 'hello\n' });
    const git = (...args: string[]) => spawnSync('git', ['-C', root, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], { encoding: 'utf8' });
    git('init', '-q');
    git('add', '.');
    git('commit', '-qm', 'init');
    const scan = () => runGates({ gates: [], required: ['gate.security-scan'] }, context(root, {}));

    expect((await scan()).records[0]).toMatchObject({ status: 'PASS' });
    writeFileSync(join(root, 'a.txt'), `hello\nconst key = "${SECRET}";\n`);
    const failed = (await scan()).records[0]!;
    expect(failed).toMatchObject({ status: 'FAIL' });
    expect(failed.reason).toContain('a.txt:2');
    expect(JSON.stringify(failed)).not.toContain(SECRET);

    writeFileSync(join(root, 'a.txt'), 'hello\n');
    writeFileSync(join(root, 'new.ts'), `export const key = "${SECRET}";\n`);
    const untracked = (await scan()).records[0]!;
    expect(untracked).toMatchObject({ status: 'FAIL' });
    expect(untracked.reason).toContain('new.ts:1');

    writeFileSync(join(root, 'new.ts'), `export const key = "${SECRET}"; // secret-scan:allow fake\n`);
    const allowed = (await scan()).records[0]!;
    expect(allowed.status).toBe('PASS');
    expect(allowed.evidence.find((item) => item.type === 'review-note')!.summary).toMatchObject({ allowedByMarker: ['new.ts:1'], untrackedFilesScanned: expect.any(Number) as unknown });
  });

  it('should not verify the secret scan outside a git repository', async () => {
    const report = await runGates({ gates: [], required: ['gate.security-scan'] }, context(writeTree({ 'a.txt': 'x' }), {}));

    expect(report.records[0]!.status).toBe('NOT_VERIFIED');
  });
});

describe('runQualityGates (persistence)', () => {
  it('should store records, report and history in git-ignored folders with matching checksums', async () => {
    const { root } = project({ 'gate.build': node('ok.js'), 'gate.unit-tests': node('fail.js') });
    const outcome = await runQualityGates({ root, profileId: 'profile.starter' });
    const runDir = join(root, '.ai-agent-setup', 'runs', outcome.report.runId);
    const record = JSON.parse(readFileSync(join(root, outcome.recordsDir, 'gate.build.json'), 'utf8')) as GateRecord;
    const log = record.evidence.find((item) => item.type === 'artifact')!;

    expect(outcome.profile).toBe('profile.starter');
    expect(outcome.report.status).toBe('FAIL');
    expect(record).toMatchObject({ project: { name: expect.any(String) as unknown, commit: null }, environment: { node: process.version } });
    expect(`sha256:${createHash('sha256').update(readFileSync(join(root, log.artifact!))).digest('hex')}`).toBe(log.checksum);
    expect(readFileSync(join(root, '.ai-agent-setup', 'runs', '.gitignore'), 'utf8')).toContain('*');
    expect(readFileSync(join(root, '.ai-agent-setup', 'gates', '.gitignore'), 'utf8')).toContain('*');
    expect(outcome.recordsDir).toBe(`.ai-agent-setup/runs/${outcome.report.runId}/gates/g1`);
    expect(readFileSync(join(runDir, 'gates', 'g1', 'report.md'), 'utf8')).toContain('| gate.unit-tests | yes | FAIL |');
    expect(readGateHistory(root, 'gate.build')).toEqual([expect.objectContaining({ runId: outcome.report.runId, status: 'PASS' })]);
  });

  it('should never overwrite the evidence of an earlier invocation in the same run', async () => {
    const { root } = project({ 'gate.build': node('ok.js'), 'gate.unit-tests': node('ok.js') });
    const first = await runQualityGates({ root, profileId: 'profile.starter' });
    const before = readFileSync(join(root, first.recordsDir, 'gate.build.json'), 'utf8');
    const second = await runQualityGates({ root, profileId: 'profile.starter', runId: first.report.runId, skip: ['gate.build'] });

    expect(second.recordsDir).toBe(first.recordsDir.replace(/g1$/, 'g2'));
    expect(readFileSync(join(root, first.recordsDir, 'gate.build.json'), 'utf8')).toBe(before);
  });

  it('should reject malformed gate ids before running anything', async () => {
    await expect(runQualityGates({ root: writeTree({}), gates: ['Build'] })).rejects.toThrow(/Invalid gate id/);
  });

  it('should keep required gates from the profile even if the config lists fewer', async () => {
    const root = writeTree({ '.ai-agent-setup/gates.json': JSON.stringify({ required: ['gate.typecheck'] }) });
    const outcome = await runQualityGates({ root, profileId: 'profile.starter' });

    expect(outcome.report.required).toEqual(['gate.build', 'gate.unit-tests', 'gate.typecheck']);
  });
});


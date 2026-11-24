import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers/v1-cli';

/** `impact` and `plan --changed` on a real git repository (W2.1-02). */
const CLI = join(REPO_ROOT, 'bin', 'cli.js');

function gitProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'impact-'));
  cpSync(join(REPO_ROOT, 'templates', 'backend-nestjs'), root, { recursive: true });
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(root, '..', 'none'), GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e.com' };
  for (const args of [['init', '-q'], ['add', '-A'], ['commit', '-q', '-m', 'init']]) spawnSync('git', args, { cwd: root, env });
  return root;
}

const cli = (cwd: string, args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

describe('impact', () => {
  it('should analyse uncommitted changes, including new and renamed files', () => {
    const root = gitProject();
    writeFileSync(join(root, 'src', 'modules', 'auth', 'auth.service.ts'), '// changed\n');
    writeFileSync(join(root, 'src', 'modules', 'auth', 'auth.service.spec.ts'), '');
    spawnSync('git', ['mv', 'prisma/schema.prisma', 'prisma/schema.renamed.prisma'], { cwd: root });

    const result = cli(root, ['impact', '--json']);

    expect(result.status, result.stderr).toBe(0);
    const impact = JSON.parse(result.stdout);
    expect(impact.files.sort()).toEqual(['prisma/schema.renamed.prisma', 'src/modules/auth/auth.service.spec.ts', 'src/modules/auth/auth.service.ts']);
    expect(impact.risk).toBe('high');
    expect(impact.relatedTests).toEqual(['src/modules/auth/auth.service.spec.ts']);
  });

  it('should accept explicit files and print a readable report', () => {
    const result = cli(gitProject(), ['impact', '.github/workflows/ci.yml', 'src/modules/users/users.controller.ts']);

    expect(result.stdout).toContain('Risk: medium (CI configuration');
    expect(result.stdout).toContain('Capabilities: devops-sre.ci-cd, backend.api-design');
  });

  it('should explain that git is needed when no files are given outside a repository', () => {
    const result = cli(mkdtempSync(join(tmpdir(), 'no-git-')), ['impact']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('pass the changed files instead');
  });

  it('should feed uncommitted changes into plan --changed', () => {
    const root = gitProject();
    writeFileSync(join(root, 'src', 'modules', 'auth', 'auth.controller.ts'), '// changed\n');

    const plan = JSON.parse(cli(root, ['plan', 'Add rate limiting to the login endpoint', '--changed', '--json']).stdout);

    expect(plan.explain.impact.files).toEqual(['src/modules/auth/auth.controller.ts']);
    expect(plan.classification.risk).toBe('high');
    expect(plan.rules).toContain('rule.typescript-patterns');
  });
});

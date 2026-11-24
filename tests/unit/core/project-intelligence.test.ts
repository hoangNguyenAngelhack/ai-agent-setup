import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeImpact, buildProjectModel } from '../../../src/core/project-intelligence';
import { detectProject } from '../../../src/core/project-detection';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

function nestProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'intel-'));
  cpSync(join(REPO_ROOT, 'templates', 'backend-nestjs'), root, { recursive: true });
  writeFileSync(join(root, 'CODEOWNERS'), '# owners\n*.ts @team-backend\n/src/modules/auth/ @team-security\n/prisma/ @team-data\n');
  writeFileSync(join(root, 'src', 'modules', 'auth', 'auth.service.spec.ts'), '');
  return root;
}

const model = (root: string, maxFiles?: number) => buildProjectModel(root, detectProject(root), maxFiles);

describe('buildProjectModel (W2.1-01)', () => {
  const root = nestProject();
  const result = model(root);

  it('should group files into modules', () => {
    expect(result.modules.map((module) => module.path)).toEqual(expect.arrayContaining(['src/modules/auth', 'src/modules/users', 'src/common/guards', 'prisma']));
    expect(result.modules.find((module) => module.path === 'src/modules/auth')).toMatchObject({ languages: ['typescript'] });
  });

  it('should map files to areas and capabilities', () => {
    const byId = Object.fromEntries(result.areas.map((area) => [area.id, area]));

    expect(byId.api?.capabilities).toEqual(['backend.api-design']);
    expect(byId.api?.files).toBeGreaterThanOrEqual(2);
    expect(byId.database?.capabilities).toEqual(['backend.database-design']);
    expect(byId.tests?.files).toBe(1);
  });

  it('should mark risk areas with a reason', () => {
    const auth = result.areas.find((area) => area.id === 'auth');

    expect(auth?.risk).toEqual({ level: 'high', reason: 'authentication and authorization code' });
  });

  it('should not treat .env.example as a secret', () => {
    expect(result.areas.find((area) => area.id === 'secrets')).toBeUndefined();
  });

  it('should read CODEOWNERS rules', () => {
    expect(result.owners.map((rule) => rule.pattern)).toEqual(['*.ts', '/src/modules/auth/', '/prisma/']);
  });

  it('should skip dependency, build and generated AI configuration directories', () => {
    const withNoise = writeTree({ 'src/a.ts': '', 'node_modules/x/index.js': '', 'dist/a.js': '', '.claude/rules/x.md': '', '.git/HEAD': '' });

    expect(model(withNoise).paths).toEqual(['src/a.ts']);
  });

  it('should stop at the file limit and say so', () => {
    const big = writeTree(Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`src/f${index}.ts`, ''])));

    expect(model(big, 5)).toMatchObject({ files: 5, truncated: true });
  });
});

describe('analyzeImpact (W2.1-02)', () => {
  const root = nestProject();
  const projectModel = model(root);

  it('should report areas, capabilities, risk, owners and related tests of changed files', () => {
    const impact = analyzeImpact(projectModel, ['src/modules/auth/auth.service.ts']);

    expect(impact.modules).toEqual(['src/modules/auth']);
    expect(impact.areas.map((area) => area.id)).toEqual(['auth']);
    expect(impact.capabilities).toEqual(['backend.authn-authz', 'security-compliance.authorization-review']);
    expect(impact.domains).toEqual(['backend', 'security-compliance']);
    expect(impact.risk).toBe('high');
    expect(impact.relatedTests).toEqual(['src/modules/auth/auth.service.spec.ts']);
    expect(impact.owners).toEqual([{ owners: ['@team-security'], files: ['src/modules/auth/auth.service.ts'] }]);
  });

  it('should use the last matching CODEOWNERS rule', () => {
    const impact = analyzeImpact(projectModel, ['src/modules/users/users.service.ts', 'prisma/schema.prisma']);

    expect(impact.owners).toEqual([
      { owners: ['@team-backend'], files: ['src/modules/users/users.service.ts'] },
      { owners: ['@team-data'], files: ['prisma/schema.prisma'] },
    ]);
  });

  it('should list files that match no area instead of guessing', () => {
    const impact = analyzeImpact(projectModel, ['nest-cli.json']);

    expect(impact.areas).toEqual([]);
    expect(impact.unmappedFiles).toEqual(['nest-cli.json']);
    expect(impact.risk).toBe('low');
  });

  it('should flag CI and dependency manifests', () => {
    const impact = analyzeImpact(projectModel, ['package.json', '.github/workflows/ci.yml']);

    expect(impact.areas.map((area) => area.id).sort()).toEqual(['ci', 'dependencies']);
    expect(impact.risk).toBe('medium');
  });
});

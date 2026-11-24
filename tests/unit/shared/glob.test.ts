import { describe, expect, it } from 'vitest';
import { matchesGlob } from '../../../src/shared/glob';

describe('matchesGlob', () => {
  it.each([
    ['**/*.ts', 'index.ts', true],
    ['**/*.ts', 'src/a/b.ts', true],
    ['**/*.ts', 'src/a/b.tsx', false],
    ['src/*.ts', 'src/a/b.ts', false],
    ['src/**', 'src/a/b.ts', true],
    ['**/routes/**', 'src/routes/users.ts', true],
    ['**/routes/**', 'routes.ts', false],
    ['**/*.{test,spec}.*', 'src/a.spec.ts', true],
    ['**/Dockerfile', 'Dockerfile', true],
    ['**/Dockerfile', 'docker/Dockerfile', true],
    ['.github/workflows/**', '.github/workflows/ci.yml', true],
    ['file?.md', 'file1.md', true],
    ['a.b', 'axb', false],
  ])('%s against %s → %s', (glob, path, expected) => {
    expect(matchesGlob(path, glob)).toBe(expected);
  });
});

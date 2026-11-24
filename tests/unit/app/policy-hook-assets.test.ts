import { utimesSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compiledDir, loadPolicyHookAssets } from '../../../src/app/policy-hook-assets';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

const RUNTIME = ['adapters/hook-runtime/policy-check', 'core/policy/index', 'core/policy/command-matcher', 'core/policy/policy-engine', 'shared/glob', 'shared/key-location'];

/** A fake package: src/ with the runtime sources, dist/ with or without their build. */
function fakePackage(options: { built: boolean }): string {
  const files: Record<string, string> = {};
  for (const file of RUNTIME) {
    files[`src/${file}.ts`] = 'export {};\n';
    if (options.built) files[`dist/${file}.js`] = '"use strict";\n';
  }
  files['src/app/policy-hook-assets.ts'] = '';
  return writeTree(files, 'hook-assets-');
}

describe('compiledDir', () => {
  it('should use its own tree when it runs from the build output', () => {
    expect(compiledDir(join(REPO_ROOT, 'dist', 'app'))).toBe(join(REPO_ROOT, 'dist'));
  });

  it('should use a fresh dist/ when it runs from sources', () => {
    const root = fakePackage({ built: true });
    const old = new Date(Date.now() - 60_000);
    for (const file of RUNTIME) utimesSync(join(root, 'src', `${file}.ts`), old, old);

    expect(compiledDir(join(root, 'src', 'app'))).toBe(join(root, 'dist'));
  });

  it('should fail clearly when dist/ is missing', () => {
    expect(() => compiledDir(join(fakePackage({ built: false }), 'src', 'app'))).toThrow(/Compiled policy hook not found .*run npm run build/);
  });

  it('should refuse a dist/ older than the sources', () => {
    const root = fakePackage({ built: true });
    const old = new Date(Date.now() - 60_000);
    utimesSync(join(root, 'dist', 'core', 'policy', 'policy-engine.js'), old, old);

    expect(() => compiledDir(join(root, 'src', 'app'))).toThrow(/older than src\/core\/policy\/policy-engine\.ts; run npm run build/);
  });

  it('should build the hook files from the repository build', () => {
    expect(Object.keys(loadPolicyHookAssets().files).sort()).toEqual(['policy-check.cjs', 'policy/command-matcher.cjs', 'policy/glob.cjs', 'policy/index.cjs', 'policy/key-location.cjs', 'policy/policy-engine.cjs']);
  });
});

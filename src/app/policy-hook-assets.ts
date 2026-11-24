import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Compiled runtime files (under dist/) → file name inside the generated hook directory. */
const RUNTIME_FILES: ReadonlyArray<[compiled: string, target: string]> = [
  ['adapters/hook-runtime/policy-check.js', 'policy-check.cjs'],
  ['core/policy/index.js', 'policy/index.cjs'],
  ['core/policy/command-matcher.js', 'policy/command-matcher.cjs'],
  ['core/policy/policy-engine.js', 'policy/policy-engine.cjs'],
  ['shared/glob.js', 'policy/glob.cjs'],
  ['shared/key-location.js', 'policy/key-location.cjs'],
];

/** Relative requires in the compiled files → their location inside the hook directory. */
const REQUIRE_REWRITES: Record<string, Record<string, string>> = {
  'policy-check.cjs': { '../../core/policy': './policy/index.cjs', '../../shared/key-location': './policy/key-location.cjs' },
  'policy/key-location.cjs': {},
  'policy/index.cjs': { './command-matcher': './command-matcher.cjs', './policy-engine': './policy-engine.cjs' },
  'policy/policy-engine.cjs': { './command-matcher': './command-matcher.cjs', '../../shared/glob': './glob.cjs' },
  'policy/glob.cjs': {},
  'policy/command-matcher.cjs': {},
};

/** Self-contained policy hook files keyed by path relative to the hook directory. */
export interface PolicyHookAssets {
  files: Record<string, string>;
}

function rewriteRequires(target: string, source: string): string {
  const rewrites = REQUIRE_REWRITES[target] ?? {};
  return source
    .replace(/require\("(\.[^"]*)"\)/g, (whole, specifier: string) => {
      const replacement = rewrites[specifier];
      if (!replacement) throw new Error(`Policy hook asset ${target} has an unmapped relative require: ${whole}`);
      return `require("${replacement}")`;
    })
    .replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
}

/**
 * Where the compiled hook runtime is read from. Packaged (this module runs from `dist/`): its own
 * tree. From TypeScript sources (in-process tests): `<package>/dist`, which must exist and be at least
 * as new as the sources it was built from; a missing or stale build fails instead of shipping old code.
 */
export function compiledDir(moduleDir: string = __dirname): string {
  const own = join(moduleDir, '..');
  if (existsSync(join(own, RUNTIME_FILES[0]![0]))) return own;
  const dist = join(moduleDir, '..', '..', 'dist');
  for (const [compiled] of RUNTIME_FILES) {
    const built = join(dist, compiled);
    if (!existsSync(built)) throw new Error(`Compiled policy hook not found (${compiled}); run npm run build`);
    const source = join(own, compiled.replace(/\.js$/, '.ts'));
    if (existsSync(source) && statSync(source).mtimeMs > statSync(built).mtimeMs) {
      throw new Error(`Compiled policy hook is older than src/${compiled.replace(/\.js$/, '.ts')}; run npm run build`);
    }
  }
  return dist;
}

/**
 * Builds the policy hook from the compiled Core policy engine so the hook shares the engine's code
 * (no duplicated matching logic). `.cjs` keeps it working in `"type": "module"` projects.
 */
export function loadPolicyHookAssets(distDir: string = compiledDir()): PolicyHookAssets {
  const files = Object.fromEntries(
    RUNTIME_FILES.map(([compiled, target]) => [target, rewriteRequires(target, readFileSync(join(distDir, compiled), 'utf8'))]),
  );
  return { files };
}

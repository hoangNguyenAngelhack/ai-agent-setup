import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Compiled runtime files (under dist/) → file name inside the generated hook directory. */
const RUNTIME_FILES: ReadonlyArray<[compiled: string, target: string]> = [
  ['adapters/hook-runtime/policy-check.js', 'policy-check.cjs'],
  ['core/policy/index.js', 'policy/index.cjs'],
  ['core/policy/command-matcher.js', 'policy/command-matcher.cjs'],
  ['core/policy/policy-engine.js', 'policy/policy-engine.cjs'],
];

/** Relative requires in the compiled files → their location inside the hook directory. */
const REQUIRE_REWRITES: Record<string, Record<string, string>> = {
  'policy-check.cjs': { '../../core/policy': './policy/index.cjs' },
  'policy/index.cjs': { './command-matcher': './command-matcher.cjs', './policy-engine': './policy-engine.cjs' },
  'policy/policy-engine.cjs': { './command-matcher': './command-matcher.cjs' },
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
 * Builds the policy hook from the compiled Core policy engine so the hook shares the engine's code
 * (no duplicated matching logic). `.cjs` keeps it working in `"type": "module"` projects.
 */
export function loadPolicyHookAssets(distDir: string = join(__dirname, '..')): PolicyHookAssets {
  const files = Object.fromEntries(
    RUNTIME_FILES.map(([compiled, target]) => [target, rewriteRequires(target, readFileSync(join(distDir, compiled), 'utf8'))]),
  );
  return { files };
}

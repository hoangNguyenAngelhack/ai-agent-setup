// @ts-check
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint for the toolkit's own code (src, tests, scripts, bin). Not linted: build output, dependencies,
 * and content the toolkit ships to other projects or shows as samples (templates/, examples/, catalog
 * bodies, .claude/, .agents/): it follows the target project's conventions and dependencies, not this
 * repository's.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'templates/**', 'examples/**', 'catalog/**', '.claude/**', '.agents/**', '.codex/**', '.ai-agent-setup/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ['*.mjs', 'bin/*.js', 'scripts/*.cjs', 'scripts/*.js'] }, tsconfigRootDir: dirname(fileURLToPath(import.meta.url)) },
    },
  },
  {
    rules: {
      // `const { a: _a, ...rest } = x` is the idiomatic way to omit a property.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.cjs', 'bin/*.js', 'scripts/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup-env.ts'],
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      // Measured: the toolkit source. Code run in child processes (the CLI launched by end-to-end tests,
      // the policy hook) is not instrumented, so those paths count only through their in-process tests.
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      // Standard profile (gate.coverage-80): every metric, not only lines. Vitest fails the run below it.
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        // Safety-critical code (docs/v2/09 §3.1): the installer writes user files; policy decides what agents may do.
        'src/installer/**': { branches: 95 },
        'src/core/policy/**': { branches: 95 },
      },
    },
  },
});

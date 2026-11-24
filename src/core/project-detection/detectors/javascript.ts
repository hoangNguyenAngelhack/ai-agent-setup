import type { Detector } from '../detection';

const FRAMEWORKS: Record<string, string> = {
  next: 'nextjs',
  react: 'react',
  vue: 'vue',
  '@angular/core': 'angular',
  svelte: 'svelte',
  express: 'express',
  '@nestjs/core': 'nestjs',
  fastify: 'fastify',
  'react-native': 'react-native',
  expo: 'expo',
  '@prisma/client': 'prisma',
  prisma: 'prisma',
  typeorm: 'typeorm',
  '@trpc/server': 'trpc',
};

const TEST_RUNNERS: Record<string, string> = {
  vitest: 'vitest',
  jest: 'jest',
  'jest-expo': 'jest',
  mocha: 'mocha',
  '@playwright/test': 'playwright',
  cypress: 'cypress',
};

const BUILD_TOOLS: Record<string, string> = { vite: 'vite', webpack: 'webpack', turbo: 'turborepo', nx: 'nx' };

const LOCKFILES: Record<string, string> = {
  'package-lock.json': 'npm',
  'npm-shrinkwrap.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
};

function pick(names: string[], table: Record<string, string>): string[] {
  return names.filter((name) => name in table).map((name) => table[name]!);
}

export const detectJavaScript: Detector = (dir) => {
  if (!dir.has('package.json')) return {};
  const manifest = dir.readJson('package.json') ?? {};
  const dependencyNames = ['dependencies', 'devDependencies', 'peerDependencies'].flatMap((field) =>
    Object.keys((manifest[field] as Record<string, unknown> | undefined) ?? {}),
  );
  const declaredManager =
    typeof manifest.packageManager === 'string' ? [manifest.packageManager.split('@')[0]!] : [];

  return {
    languages: [dir.has('tsconfig.json') || dependencyNames.includes('typescript') ? 'typescript' : 'javascript'],
    frameworks: pick(dependencyNames, FRAMEWORKS),
    testRunners: pick(dependencyNames, TEST_RUNNERS),
    buildTools: pick(dependencyNames, BUILD_TOOLS),
    packageManagers: [...Object.keys(LOCKFILES).filter((file) => dir.has(file)).map((file) => LOCKFILES[file]!), ...declaredManager],
  };
};

import { join } from 'node:path';
import type { ProjectProfile } from '../contracts';
import type { Detection, Detector } from './detection';
import { detectDotnet, detectGo, detectJvm, detectPhp, detectPython, detectRuby, detectRust } from './detectors/backend-languages';
import { detectJavaScript } from './detectors/javascript';
import { detectDelivery, detectMobileNative } from './detectors/platform';
import { ProjectDir } from './project-dir';

const DETECTORS: readonly Detector[] = [
  detectJavaScript,
  detectPython,
  detectJvm,
  detectGo,
  detectDotnet,
  detectRust,
  detectRuby,
  detectPhp,
  detectMobileNative,
  detectDelivery,
];

/** Conventional monorepo folders whose direct children are scanned as sub-projects. */
const WORKSPACE_PARENTS = ['apps', 'packages', 'services', 'libs'];

const FRAMEWORK_SIGNALS: Record<string, string> = {
  express: 'http-server',
  nestjs: 'http-server',
  fastify: 'http-server',
  django: 'http-server',
  fastapi: 'http-server',
  flask: 'http-server',
  'spring-boot': 'http-server',
  quarkus: 'http-server',
  micronaut: 'http-server',
  gin: 'http-server',
  echo: 'http-server',
  fiber: 'http-server',
  aspnetcore: 'http-server',
  axum: 'http-server',
  actix: 'http-server',
  rails: 'http-server',
  laravel: 'http-server',
  symfony: 'http-server',
  react: 'web-ui',
  vue: 'web-ui',
  angular: 'web-ui',
  svelte: 'web-ui',
  nextjs: 'web-ui',
  'react-native': 'mobile-app',
  expo: 'mobile-app',
  flutter: 'mobile-app',
  ios: 'mobile-app',
  android: 'mobile-app',
  prisma: 'orm',
  typeorm: 'orm',
  sqlalchemy: 'orm',
};

const LIST_FIELDS = ['languages', 'frameworks', 'packageManagers', 'buildTools', 'testRunners', 'ci', 'linters', 'signals'] as const;

function detectDirectory(dir: ProjectDir): Detection[] {
  return DETECTORS.map((detector) => detector(dir));
}

function isProjectDirectory(findings: Detection[]): boolean {
  return findings.some((finding) => (finding.languages?.length ?? 0) > 0 || (finding.frameworks?.length ?? 0) > 0);
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

/**
 * Deterministic technology-stack detection (docs/v2/05 §5 module 1). Scans the root and the direct
 * children of conventional workspace folders; never guesses values it cannot see.
 */
export function detectProject(root: string): ProjectProfile {
  const rootDir = new ProjectDir(root);
  const findings = detectDirectory(rootDir);
  const workspaces: string[] = [];

  for (const parent of WORKSPACE_PARENTS) {
    for (const child of rootDir.list(parent)) {
      const workspace = `${parent}/${child}`;
      const childFindings = detectDirectory(new ProjectDir(join(root, workspace)));
      if (!isProjectDirectory(childFindings)) continue;
      workspaces.push(workspace);
      findings.push(...childFindings);
    }
  }

  const merged = Object.fromEntries(
    LIST_FIELDS.map((field) => [field, sortedUnique(findings.flatMap((finding) => finding[field] ?? []))]),
  ) as Record<(typeof LIST_FIELDS)[number], string[]>;

  return {
    root,
    ...merged,
    signals: sortedUnique([...merged.signals, ...merged.frameworks.flatMap((framework) => FRAMEWORK_SIGNALS[framework] ?? [])]),
    workspaces: workspaces.sort(),
  };
}

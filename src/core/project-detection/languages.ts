import type { ProjectProfile } from '../contracts';

/** Every language the detectors can report. */
export const LANGUAGES: ReadonlySet<string> = new Set(['javascript', 'typescript', 'python', 'java', 'kotlin', 'go', 'csharp', 'fsharp', 'rust', 'ruby', 'php', 'dart', 'swift', 'c', 'cpp']);

/** Platforms that call for their own guidance on top of the language (an Android app, not any Kotlin). */
export const PLATFORMS: ReadonlySet<string> = new Set(['android', 'ios', 'flutter']);

/**
 * Stack signals (docs/v2/16): a catalog entry naming any of them in `requiredContext.projectSignals`
 * is installed only for a project with one of them.
 */
export const STACKS: ReadonlySet<string> = new Set([...LANGUAGES, ...PLATFORMS]);

/** The project's languages and platforms. */
export function projectStacks(project: Pick<ProjectProfile, 'languages' | 'frameworks'>): string[] {
  return [...project.languages, ...project.frameworks.filter((framework) => PLATFORMS.has(framework))];
}

import type { ProjectDir } from './project-dir';

/** Partial findings of one detector for one directory; merged into a ProjectProfile. */
export interface Detection {
  languages?: string[];
  frameworks?: string[];
  packageManagers?: string[];
  buildTools?: string[];
  testRunners?: string[];
  ci?: string[];
  signals?: string[];
}

export type Detector = (dir: ProjectDir) => Detection;

/** Returns the values whose keyword appears in `haystack`. */
export function matchKeywords(haystack: string, keywords: Record<string, string>): string[] {
  return Object.entries(keywords)
    .filter(([keyword]) => haystack.includes(keyword))
    .map(([, value]) => value);
}

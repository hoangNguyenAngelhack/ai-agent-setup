/**
 * Every language the detectors can report. A catalog entry that names one of them in
 * `requiredContext.projectSignals` is language-specific (docs/v2/16): installed only where used.
 */
export const LANGUAGES: ReadonlySet<string> = new Set(['javascript', 'typescript', 'python', 'java', 'kotlin', 'go', 'csharp', 'fsharp', 'rust', 'ruby', 'php', 'dart']);

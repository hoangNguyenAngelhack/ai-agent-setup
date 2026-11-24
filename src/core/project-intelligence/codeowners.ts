import { matchesAnyGlob } from '../../shared/glob';
import type { OwnerRule } from '../contracts';

export const CODEOWNERS_LOCATIONS = ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'];

export function parseCodeowners(text: string): OwnerRule[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/);
      return { pattern: pattern!, owners };
    });
}

/** CODEOWNERS patterns follow gitignore rules: no slash matches anywhere, a slash anchors to the root. */
function ownerGlobs(pattern: string): string[] {
  const directory = pattern.endsWith('/');
  const trimmed = pattern.replace(/^\//, '').replace(/\/$/, '');
  const anchored = pattern.startsWith('/') || trimmed.includes('/');
  const base = anchored ? trimmed : `**/${trimmed}`;
  return directory ? [`${base}/**`] : [base, `${base}/**`];
}

/** Owners of a path: the last matching rule wins, as on GitHub and GitLab. */
export function ownersOf(path: string, rules: readonly OwnerRule[]): string[] {
  let owners: string[] = [];
  for (const rule of rules) if (matchesAnyGlob(path, ownerGlobs(rule.pattern))) owners = rule.owners;
  return owners;
}

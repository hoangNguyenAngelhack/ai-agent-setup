import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogSummary, SUMMARY_BEGIN, SUMMARY_END } from '../../src/app/catalog-summary';
import { validateCatalog } from '../../src/registry';
import { REPO_ROOT } from '../helpers/v1-cli';

/** README numbers come from the catalog (TD-17); unmeasured performance claims stay out (F-28). */
const summary = catalogSummary(validateCatalog(join(REPO_ROOT, 'catalog')));

describe.each(['README.md', 'README.vi.md'])('%s', (name) => {
  const readme = readFileSync(join(REPO_ROOT, name), 'utf8');

  it('should contain the current generated catalog summary (run npm run docs:summary)', () => {
    const block = readme.slice(readme.indexOf(SUMMARY_BEGIN), readme.indexOf(SUMMARY_END) + SUMMARY_END.length);

    expect(block).toBe(summary);
  });

  it.each(['57% fewer', '35% cheaper', '46% faster', '71% fewer', '30+ AI'])('should not repeat the unmeasured claim "%s"', (claim) => {
    expect(readme).not.toContain(claim);
  });

  it('should link to the V1 migration guide', () => {
    expect(readme).toContain('docs/guides/migrating-from-v1.md');
  });
});

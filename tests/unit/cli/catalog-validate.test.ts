import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCatalogValidate } from '../../../src/cli/catalog-validate';
import { fixtures, minimalValidEntries, writeCatalog } from '../../helpers/catalog-fixture';
import { REPO_ROOT } from '../../helpers/v1-cli';

function capture(catalogDir: string): { exitCode: number; output: string } {
  const lines: string[] = [];
  const exitCode = runCatalogValidate(catalogDir, (line) => lines.push(line));
  return { exitCode, output: lines.join('\n') };
}

describe('catalog validate command', () => {
  it('should exit 0 and summarize counts for the bundled catalog', () => {
    const { exitCode, output } = capture(join(REPO_ROOT, 'catalog'));

    expect(exitCode).toBe(0);
    expect(output).toContain('Domain: 12');
    expect(output).toContain('Capability: 123');
    expect(output).toContain('Agent: 19'); // 9 canonical + 10 V1 compatibility aliases
    expect(output).toContain('0 errors');
    expect(output).toMatch(/Context T0 profile\.standard: \d+ bytes \(measured\); claude-code budget not set; codex budget 24576: within/);
  });

  it('should exit 1 and print each error with code and file', () => {
    const entries = [...minimalValidEntries(), fixtures.skill('skill.old', { status: 'deprecated' })];

    const { exitCode, output } = capture(writeCatalog(entries));

    expect(exitCode).toBe(1);
    expect(output).toMatch(/error E_DEPRECATION_INFO skill\.old .*skill\.old\.yaml/);
    expect(output).toContain('1 errors');
  });
});

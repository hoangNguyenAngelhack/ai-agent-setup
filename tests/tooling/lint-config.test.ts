import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers/v1-cli';

/** The lint configuration covers the toolkit's own code and its type-aware rules are active. */
const eslint = new ESLint({ cwd: REPO_ROOT });

describe('eslint.config.mjs', () => {
  it.each(['src/cli/main.ts', 'tests/unit/cli/main.test.ts', 'scripts/update-readme-summary.cjs', 'bin/cli.js', 'eslint.config.mjs'])('should lint %s', async (file) => {
    expect(await eslint.isPathIgnored(file)).toBe(false);
  });

  it.each(['dist/cli/main.js', 'templates/backend/src/index.ts', 'examples/backend/db.ts', 'catalog/skills/x.ts', 'node_modules/x/index.js', 'coverage/x.js'])(
    'should not lint shipped or generated content: %s',
    async (file) => {
      expect(await eslint.isPathIgnored(file)).toBe(true);
    },
  );

  it('should report unsafe use of any in source files (type-aware rules on)', async () => {
    // The real file plus one unsafe line, so the shared type program keeps the file's exports.
    const file = join(REPO_ROOT, 'src', 'shared', 'redact.ts');
    const text = `${readFileSync(file, 'utf8')}\nexport const port = JSON.parse('{}').port;\n`;
    const [result] = await new ESLint({ cwd: REPO_ROOT }).lintText(text, { filePath: file });

    expect(result!.messages.map((message) => message.ruleId)).toContain('@typescript-eslint/no-unsafe-member-access');
  });

  it('should keep the repository free of lint errors and warnings', async () => {
    const results = await new ESLint({ cwd: REPO_ROOT }).lintFiles(['src', 'tests', 'scripts', 'bin']);
    const problems = results.flatMap((result) => result.messages.map((message) => `${result.filePath}:${message.line} ${message.ruleId ?? ''} ${message.message}`));

    expect(problems).toEqual([]);
  }, 120_000);
});

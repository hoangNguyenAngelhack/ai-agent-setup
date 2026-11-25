import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { judge, snapshotTree } from '../../src/app/benchmark/oracle';
import { loadSuite } from '../../src/app/benchmark/tasks';
import { REPO_ROOT } from '../helpers/v1-cli';

/**
 * Finding 10 of docs/v2/15: correct work written another valid way was REJECTED. Each case takes the
 * reference solution, rewrites it in an equivalent form the old checks refused, and expects it to be
 * accepted; a broken variant of the same form must still be rejected.
 */
const SUITE = join(REPO_ROOT, 'benchmarks', 'suite');
const tasks = loadSuite(SUITE);

function variant(id: string, change: (workspace: string) => void) {
  const task = tasks.find((item) => item.id === id)!;
  const workspace = mkdtempSync(join(tmpdir(), 'variant-'));
  cpSync(join(SUITE, task.fixture), workspace, { recursive: true });
  const before = snapshotTree(workspace);
  cpSync(join(SUITE, 'solutions', id), workspace, { recursive: true });
  change(workspace);
  return judge(task, SUITE, workspace, before);
}

const edit = (file: string, replace: (text: string) => string) => (workspace: string) => writeFileSync(join(workspace, file), replace(readFileSync(join(workspace, file), 'utf8')));

describe.skipIf(process.platform === 'win32')('benchmark checks accept equivalent correct work (finding 10)', () => {
  it('fe-01: should accept single-quoted and unquoted attributes, and still require a label', () => {
    const singleQuoted = edit('public/signup.html', (html) => html.replace(/"/g, "'"));
    expect(variant('fe-01-accessible-form', singleQuoted)).toMatchObject({ verdict: 'ACCEPTED' });
    expect(variant('fe-01-accessible-form', edit('public/signup.html', (html) => html.replace(/type="email"/, 'type=email')))).toMatchObject({ verdict: 'ACCEPTED' });

    const unlabelled = (workspace: string) => {
      singleQuoted(workspace);
      edit('public/signup.html', (html) => html.replace(/<label[^>]*for='email'[^>]*>[^<]*<\/label>/, ''))(workspace);
    };
    expect(variant('fe-01-accessible-form', unlabelled)).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' } });
  }, 60000);

  it('se-03: should accept numeric character references, and still reject unescaped output', () => {
    expect(variant('se-03-xss', edit('src/render.js', (code) => code.replace("'&quot;'", "'&#34;'").replace("'&lt;'", "'&#60;'")))).toMatchObject({ verdict: 'ACCEPTED' });
    expect(variant('se-03-xss', edit('src/render.js', (code) => code.replace("'&quot;'", '\'"\'')))).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' } });
  }, 60000);

  it('do-01: should parse the workflow as YAML: any trigger form, a Node matrix, npm ci; and reject invalid YAML', () => {
    const workflow = (text: string) => (workspace: string) => {
      mkdirSync(join(workspace, '.github', 'workflows'), { recursive: true });
      writeFileSync(join(workspace, '.github', 'workflows', 'ci.yml'), text);
    };
    const matrix = [
      'name: CI',
      'on: [push, pull_request]',
      'jobs:',
      '  test:',
      '    runs-on: ubuntu-latest',
      '    strategy:',
      '      matrix:',
      '        node: [20, 22]',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - uses: actions/setup-node@v4',
      '        with:',
      '          node-version: ${{ matrix.node }}',
      '      - run: npm ci',
      '      - run: npm test',
      '',
    ].join('\n');
    expect(variant('do-01-ci-pipeline', workflow(matrix))).toMatchObject({ verdict: 'ACCEPTED' });
    expect(variant('do-01-ci-pipeline', workflow(matrix.replace('node: [20, 22]', 'node: [22]')))).toMatchObject({ verdict: 'REJECTED' });
    expect(variant('do-01-ci-pipeline', workflow(`${matrix}  bad: [unclosed\n`))).toMatchObject({ verdict: 'REJECTED', hiddenTests: { status: 'FAIL' } });
  }, 60000);
});

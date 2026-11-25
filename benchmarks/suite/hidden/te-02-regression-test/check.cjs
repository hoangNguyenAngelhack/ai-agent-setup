const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { observe, runTests } = require('./runtime/isolate.cjs');

const root = process.cwd();
const testFile = path.join(root, 'test', 'dates.test.js');
assert.ok(fs.existsSync(testFile), 'no test/dates.test.js');
const run = (implementation) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.mkdirSync(path.join(dir, 'test'));
  fs.copyFileSync(path.join(__dirname, implementation), path.join(dir, 'src', 'dates.js'));
  fs.copyFileSync(testFile, path.join(dir, 'test', 'dates.test.js'));
  return runTests(dir, 'test/dates.test.js');
};
assert.notStrictEqual(run('buggy.js'), 0, 'the test does not reproduce the bug');
assert.strictEqual(run('fixed.js'), 0, 'the test fails on a correct implementation');
const seen = observe(`
  const { parseDate } = load('src/dates.js');
  return [parseDate('2026-03-15').toISOString(), parseDate('2026-12-31').toISOString()];
`);
assert.deepStrictEqual(seen, ['2026-03-15T00:00:00.000Z', '2026-12-31T00:00:00.000Z']);

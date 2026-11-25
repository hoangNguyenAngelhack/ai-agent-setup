const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const app = () => require(path.join(root, 'src', 'app.js'));
const get = (url, headers = {}) => app().handle({ method: 'GET', url, headers });
const bob = { authorization: 'Bearer token-bob' };
const ada = { authorization: 'Bearer token-ada' };
const runTests = (cwd, file) => spawnSync(process.execPath, ['--test', file], { cwd, encoding: 'utf8' }).status;

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
const { parseDate } = require(path.join(root, 'src', 'dates.js'));
assert.strictEqual(parseDate('2026-03-15').toISOString(), '2026-03-15T00:00:00.000Z');
assert.strictEqual(parseDate('2026-12-31').toISOString(), '2026-12-31T00:00:00.000Z');

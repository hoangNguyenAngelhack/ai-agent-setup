const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { observe, runTests } = require('./runtime/isolate.cjs');

const root = process.cwd();
const seen = observe(`
  const { isEmail, isPositiveInt } = load('src/validate.js');
  const { handle } = load('src/app.js');
  const get = (url) => handle({ method: 'GET', url, headers: {} }).status;
  return {
    ints: ['1', '42', '0', '-1', '1.5', 'x'].map((value) => isPositiveInt(value)),
    emails: ['a@b.co', 'no-at', 'a@b', '', undefined].map((value) => isEmail(value)),
    statuses: [get('/users/abc'), get('/users/2'), get('/users?email=bad'), get('/users?email=bob@example.com')],
  };
`);
assert.deepStrictEqual(seen.ints, [true, true, false, false, false, false]);
assert.deepStrictEqual(seen.emails, [true, false, false, false, false]);
const source = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
assert.doesNotMatch(source, /function (isEmail|isPositiveInt)\b/, 'helpers still defined in app.js');
assert.match(source, /require\(['"]\.\/validate(\.js)?['"]\)/);
assert.deepStrictEqual(seen.statuses, [400, 200, 400, 200]);
assert.strictEqual(runTests(root, 'test/app.test.js'), 0, 'existing tests fail');

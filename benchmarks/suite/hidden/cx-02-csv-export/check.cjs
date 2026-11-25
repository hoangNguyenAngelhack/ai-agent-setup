const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { observe, runTests } = require('./runtime/isolate.cjs');

const root = process.cwd();
const seen = observe(`
  const { handle } = load('src/app.js');
  const get = (url, headers = {}) => handle({ method: 'GET', url, headers });
  const csv = get('/orders.csv', { authorization: 'Bearer token-bob' });
  return { status: csv.status, contentType: String(csv.headers && csv.headers['content-type']), body: String(csv.body), anonymous: get('/orders.csv').status };
`);
assert.strictEqual(seen.status, 200);
assert.match(seen.contentType, /text\/csv/);
const lines = seen.body.trim().split(/\r?\n/);
assert.strictEqual(lines[0], 'id,total,status');
assert.strictEqual(lines.length, 16);
assert.ok(lines.slice(1).every((line) => /^\d+,\d+(\.\d+)?,(pending|shipped)$/.test(line)));
assert.strictEqual(seen.anonymous, 401);
assert.match(fs.readFileSync(path.join(root, 'public', 'orders.html'), 'utf8'), /href=["']?\/orders\.csv["']?/);
assert.ok(fs.existsSync(path.join(root, 'test', 'orders-csv.test.js')), 'no test/orders-csv.test.js');
assert.strictEqual(runTests(root, 'test/orders-csv.test.js'), 0, 'test/orders-csv.test.js fails');
assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /csv/i);

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { observe, runTests } = require('./runtime/isolate.cjs');

const root = process.cwd();
const seen = observe(`
  const { handle } = load('src/app.js');
  const get = (url, headers = {}) => handle({ method: 'GET', url, headers });
  const bob = { authorization: 'Bearer token-bob' };
  return { shipped: get('/orders?status=shipped', bob), invalid: get('/orders?status=lost', bob), all: get('/orders', bob).body };
`);
assert.strictEqual(seen.shipped.status, 200);
const rows = seen.shipped.body.data || seen.shipped.body;
assert.ok(rows.length > 0 && rows.every((order) => order.status === 'shipped' && order.userId === 2));
assert.strictEqual(seen.invalid.status, 400);
assert.strictEqual(seen.invalid.body.error.code, 'INVALID_STATUS');
assert.strictEqual(((seen.all && seen.all.data) || []).length, 15);
const html = fs.readFileSync(path.join(root, 'public', 'orders.html'), 'utf8');
const select = (/<select[^>]*id=["']?status-filter["']?[^>]*>([\s\S]*?)<\/select>/.exec(html) || [])[1];
assert.ok(select, 'no select#status-filter');
for (const value of ['all', 'pending', 'shipped']) assert.match(select, new RegExp(`<option[^>]*>\\s*${value}\\s*<`, 'i'));
assert.ok(fs.existsSync(path.join(root, 'test', 'orders-status.test.js')), 'no test/orders-status.test.js');
assert.strictEqual(runTests(root, 'test/orders-status.test.js'), 0, 'test/orders-status.test.js fails');
assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /status/i);

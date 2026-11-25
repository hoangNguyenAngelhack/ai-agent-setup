const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { handle } = load('src/app.js');
  const get = (url, headers = {}) => handle({ method: 'GET', url, headers });
  const bob = { authorization: 'Bearer token-bob' };
  return {
    first: get('/orders?page=1&limit=10', bob),
    second: get('/orders?page=2&limit=10', bob),
    defaults: get('/orders', bob),
    capped: get('/orders?limit=500', bob),
    pageZero: get('/orders?page=0', bob).status,
    badLimit: get('/orders?limit=abc', bob).status,
    anonymous: get('/orders?page=1').status,
  };
`);
assert.strictEqual(seen.first.status, 200);
assert.deepStrictEqual(seen.first.body.pagination, { page: 1, limit: 10, total: 15, totalPages: 2 });
assert.strictEqual(seen.first.body.data.length, 10);
assert.ok(seen.first.body.data.every((order) => order.userId === 2));
assert.deepStrictEqual(seen.first.body.data.map((order) => order.id), [...seen.first.body.data.map((order) => order.id)].sort((a, b) => a - b));
assert.strictEqual(seen.second.body.data.length, 5);
assert.deepStrictEqual(seen.defaults.body.pagination, { page: 1, limit: 20, total: 15, totalPages: 1 });
assert.strictEqual(seen.capped.body.pagination.limit, 100);
assert.strictEqual(seen.pageZero, 400);
assert.strictEqual(seen.badLimit, 400);
assert.strictEqual(seen.anonymous, 401);

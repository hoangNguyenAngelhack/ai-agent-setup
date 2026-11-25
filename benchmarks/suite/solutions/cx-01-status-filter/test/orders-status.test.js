const test = require('node:test');
const assert = require('node:assert');
const { handle } = require('../src/app');

const bob = { authorization: 'Bearer token-bob' };

test('filters orders by status', () => {
  const shipped = handle({ method: 'GET', url: '/orders?status=shipped', headers: bob }).body.data;
  assert.ok(shipped.length > 0 && shipped.every((order) => order.status === 'shipped'));
});

test('rejects an unknown status', () => {
  assert.strictEqual(handle({ method: 'GET', url: '/orders?status=lost', headers: bob }).status, 400);
});

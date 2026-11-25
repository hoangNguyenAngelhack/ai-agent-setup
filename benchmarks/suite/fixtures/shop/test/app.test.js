const test = require('node:test');
const assert = require('node:assert');
const { handle } = require('../src/app');

test('health', () => {
  const response = handle({ method: 'GET', url: '/health' });
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(response.body, { status: 'ok' });
});

test('orders need a token', () => {
  assert.strictEqual(handle({ method: 'GET', url: '/orders' }).status, 401);
  assert.strictEqual(handle({ method: 'GET', url: '/orders', headers: { authorization: 'Bearer token-bob' } }).status, 200);
});

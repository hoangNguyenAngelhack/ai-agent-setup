const test = require('node:test');
const assert = require('node:assert');
const { handle } = require('../src/app');

test('exports the orders of the signed-in user as CSV', () => {
  const response = handle({ method: 'GET', url: '/orders.csv', headers: { authorization: 'Bearer token-bob' } });
  assert.strictEqual(response.headers['content-type'], 'text/csv');
  assert.ok(response.body.startsWith('id,total,status\n'));
});

test('needs a token', () => {
  assert.strictEqual(handle({ method: 'GET', url: '/orders.csv', headers: {} }).status, 401);
});

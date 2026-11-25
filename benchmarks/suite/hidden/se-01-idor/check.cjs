const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { handle } = load('src/app.js');
  const get = (url, headers = {}) => handle({ method: 'GET', url, headers });
  const bob = { authorization: 'Bearer token-bob' };
  const ada = { authorization: 'Bearer token-ada' };
  return {
    other: get('/orders/1', bob),
    own: get('/orders/2', bob).status,
    asAda: get('/orders/2', ada).status,
    missing: get('/orders/999', bob).status,
    anonymous: get('/orders/2').status,
  };
`);
assert.strictEqual(seen.other.status, 403);
assert.strictEqual(seen.other.body.error.code, 'FORBIDDEN');
assert.strictEqual(seen.own, 200);
assert.strictEqual(seen.asAda, 200);
assert.strictEqual(seen.missing, 404);
assert.strictEqual(seen.anonymous, 401);

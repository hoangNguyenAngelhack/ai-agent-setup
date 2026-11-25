const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { handle } = load('src/app.js');
  const get = (url) => handle({ method: 'GET', url, headers: {} });
  let missing = null;
  let threw = null;
  try {
    missing = get('/users/99');
  } catch (error) {
    threw = String((error && error.message) || error);
  }
  return { threw, missing, bob: get('/users/2').body, invalid: get('/users/abc').status };
`);
assert.strictEqual(seen.threw, null, `GET /users/99 threw: ${seen.threw}`);
assert.strictEqual(seen.missing.status, 404);
assert.strictEqual(seen.missing.body.error.code, 'NOT_FOUND');
assert.deepStrictEqual(seen.bob, { id: 2, name: 'Bob', email: 'bob@example.com' });
assert.strictEqual(seen.invalid, 400);
